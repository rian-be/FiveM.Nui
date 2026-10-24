using System.Text;

namespace FiveM.Nui.Messaging;

/// <summary>
/// Handles inbound NUI message dispatch: routing envelopes to callback
/// handlers, pending request completions, and event subscribers.
/// </summary>
/// <remarks>
/// Principle: NuiClient is a facade this class is the inbound pipeline worker.
/// The handler is subscribed to the transport and invoked for every
/// deserialized envelope.
/// </remarks>
/// <param name="serializer">Serializer used to read payloads and envelopes.</param>
/// <param name="logger">Logger for inbound routing and failures.</param>
/// <param name="callbackRegistry">Registry that resolves request callbacks.</param>
/// <param name="transport">Transport used to post callback responses.</param>
/// <param name="requestManager">Coordinator that completes pending outbound requests.</param>
/// <param name="eventManager">Event bus that fans published events out to subscribers.</param>
/// <param name="diagnostics">Metrics collector for counters, timings, and payload sizes.</param>
/// <param name="options">Client options, including the payload-logging switch.</param>
/// <param name="cancellationToken">Token canceled when the owning client is disposed of.</param>
internal sealed class NuiInboundHandler(
    INuiSerializer serializer,
    INuiLogger logger,
    INuiCallbackRegistry callbackRegistry,
    INuiTransport transport,
    INuiRequestCoordinator requestManager,
    INuiEventBus eventManager,
    INuiDiagnosticsCollector diagnostics,
    NuiOptions options,
    CancellationToken cancellationToken)
{
    /// <summary>
    /// Entry point for inbound messages: deserialized envelopes arrive here
    /// from the transport's subscriber pipeline.
    /// </summary>
    /// <remarks>
    /// Dispatches on <see cref="NuiMessage.Type"/>: requests run a registered
    /// callback, responses complete a pending request, and events are published
    /// to subscribers. Anything else is dropped with a warning.
    /// </remarks>
    /// <param name="message">The deserialized envelope to dispatch.</param>
    public void HandleIncomingMessage(NuiMessage message)
    {
        diagnostics.IncrementCounter("messages_received");

        if (logger.IsEnabled(NuiLogLevel.Debug))
        {
            logger.LogDebug("<- INBOUND type={Type} event='{Event}' id={CorrelationId}",
                message.Type,
                message.Event,
                message.Id ?? "-");
        }

        LogPayload("<-", message);

        switch (message.Type)
        {
            case "request":
                _ = ExecuteRequestAsync(message);
                break;

            case "response":
                HandleResponse(message);
                break;

            case "event":
                HandleEvent(message);
                break;

            default:
                logger.LogWarning("Dropping message with unknown type '{Type}'", message.Type);
                break;
        }
    }
    
    /// <summary>
    /// Runs the callback registered for the request and posts its response.
    /// </summary>
    /// <param name="message">The request envelope to service.</param>
    /// <returns>A task that completes once the response has been posted.</returns>
    private async Task ExecuteRequestAsync(NuiMessage message)
    {
        if (string.IsNullOrEmpty(message.Id))
        {
            logger.LogWarning("Received request without correlation ID");
            return;
        }

        diagnostics.IncrementCounter("callbacks_received");

        var handler = callbackRegistry.GetHandler(message.Event);
        if (handler == null)
        {
            logger.LogWarning("No handler registered for event: {Event}", message.Event);
            diagnostics.IncrementCounter("callbacks_unknown");

            await SendResponseAsync(NuiMessage.CreateResponse(
                message.Id,
                false,
                error: new NuiError("UNKNOWN_CALLBACK", $"No handler for {message.Event}")));
            return;
        }

        var startedAt = Environment.TickCount64;
        NuiMessage response;

        try
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("Executing callback '{Event}' id={CorrelationId}",
                    message.Event, message.Id);

            var responseJson = await handler.ExecuteAsync(message.Payload, serializer, cancellationToken);
            response = serializer.Deserialize<NuiMessage>(responseJson)
                ?? throw new InvalidOperationException(
                    $"Callback '{message.Event}' returned an empty response envelope.");

            response = response with { Id = message.Id };

            diagnostics.IncrementCounter(response.Success ? "callbacks_succeeded" : "callbacks_failed");
            diagnostics.RecordTiming($"callback:{message.Event}", Environment.TickCount64 - startedAt);

            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("Callback '{Event}' id={CorrelationId} finished success={Success} in {Elapsed}ms",
                    message.Event, message.Id, response.Success, Environment.TickCount64 - startedAt);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("Callback '{Event}' id={CorrelationId} stopped because the client is shutting down",
                    message.Event, message.Id);
            return;
        }
        catch (Exception ex)
        {
            diagnostics.IncrementCounter("callbacks_threw");
            logger.LogError(ex, "Error executing callback for event: {Event}", message.Event);

            response = NuiMessage.CreateResponse(
                message.Id,
                false,
                error: new NuiError("CALLBACK_ERROR", "An error occurred processing the request"));
        }

        await SendResponseAsync(response);
    }

    /// <summary>
    /// Delivers a callback response without allowing a transport failure to
    /// escape the fire-and-forget inbound dispatch path.
    /// </summary>
    private async Task SendResponseAsync(NuiMessage response)
    {
        try
        {
            await transport.SendAsync(response, cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("Response id={CorrelationId} was not sent because the client is shutting down",
                    response.Id ?? "-");
        }
        catch (Exception ex)
        {
            diagnostics.IncrementCounter("callback_responses_failed");
            logger.LogError(ex, "Failed to send callback response id={CorrelationId}",
                response.Id ?? "-");
        }
    }

    /// <summary>
    /// Completes the pending outbound request identified by the response's
    /// correlation id.
    /// </summary>
    /// <param name="message">The response envelope.</param>
    private void HandleResponse(NuiMessage message)
    {
        if (string.IsNullOrEmpty(message.Id))
        {
            logger.LogWarning("Received response without correlation ID");
            return;
        }

        requestManager.CompleteRequest(message.Id, message, serializer);
    }

    /// <summary>
    /// Publishes the envelope's payload to subscribers of its event name.
    /// </summary>
    /// <param name="message">The event envelope.</param>
    private void HandleEvent(NuiMessage message)
    {
        if (string.IsNullOrEmpty(message.Event))
        {
            logger.LogWarning("Received event without a name; dropping");
            return;
        }

        diagnostics.IncrementCounter("events_received");
        eventManager.Publish(message.Event, serializer.Serialize(message.Payload), serializer);
    }

    /// <summary>
    /// Feeds a raw JSON envelope into the dispatch pipeline.
    /// </summary>
    /// <remarks>
    /// Deserialization failures and null envelopes are logged and dropped
    /// rather than thrown, so a malformed POST cannot break the transport
    /// subscriber.
    /// </remarks>
    /// <param name="json">The raw JSON envelope received from the page.</param>
    public void TraceIncoming(string json)
    {
        NuiMessage? message;

        try
        {
            message = serializer.Deserialize<NuiMessage>(json);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not deserialize inbound envelope");
            return;
        }

        if (message is null)
        {
            logger.LogWarning("Inbound envelope deserialized to null");
            return;
        }

        HandleIncomingMessage(message);
    }

    /// <summary>
    /// Records an outbound envelope in the diagnostics stream.
    /// </summary>
    /// <remarks>
    /// A failing payload measurement is logged and skipped, so diagnostics can
    /// never block an outbound sending.
    /// </remarks>
    /// <param name="message">The outbound envelope to record.</param>
    public void TraceOutgoing(NuiMessage message)
    {
        diagnostics.IncrementCounter("messages_sent");

        try
        {
            diagnostics.RecordPayload(Encoding.UTF8.GetByteCount(serializer.Serialize(message)));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not measure payload for outgoing '{Event}'",
                message.Event);
        }

        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("-> OUTGOING type={Type} event='{Event}' id={CorrelationId}",
                message.Type, message.Event, message.Id ?? "-");

        LogPayload("->", message);
    }

    /// <summary>
    /// Logs an envelope payload at debug level when payload logging is enabled.
    /// </summary>
    /// <param name="direction">Arrow marking the payload as inbound or outbound.</param>
    /// <param name="message">The envelope whose payload is logged.</param>
    private void LogPayload(string direction, NuiMessage message)
    {
        if (!options.LogPayloads)
        {
            return;
        }

        try
        {
            logger.LogDebug("{Direction} payload: {Payload}",
                direction, serializer.Serialize(message.Payload));
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Could not serialize payload for logging");
        }
    }
}
