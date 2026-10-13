using FiveM.Nui.Hosting;

namespace FiveM.Nui;

// Outbound messaging (INuiMessenger), inbound tracing and the payload helpers
// those paths share. Split out of NuiClient.cs to keep each file small.
public partial class NuiClient
{
    /// <summary>
    /// Sends fire and forget event to the NUI page.
    /// </summary>
    /// <typeparam name="T">The payload type.</typeparam>
    /// <param name="eventName">The event name the page listens for.</param>
    /// <param name="payload">The payload to deliver.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes once the event has been posted.</returns>
    public async Task SendAsync<T>(string eventName, T payload, CancellationToken cancellationToken = default)
    {
        var message = NuiMessage.CreateEvent(eventName, payload);
        var json = _serializer.Serialize(message);

        EnsureWithinPayloadLimit(json.Length, eventName);
        _diagnostics.IncrementCounter("messages_sent");
        _diagnostics.RecordPayload(json.Length);

        _logger.LogDebug("-> EVENT '{Event}' ({Bytes} bytes)", eventName, json.Length);
        LogPayload("->", message);

        await _transport.SendAsync(message, cancellationToken);
    }

    /// <summary>
    /// Sends a request to the NUI page and awaits its response.
    /// </summary>
    /// <typeparam name="TRequest">The request payload type.</typeparam>
    /// <typeparam name="TResponse">The response payload type.</typeparam>
    /// <param name="eventName">The request event name the page answers.</param>
    /// <param name="request">The request payload.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>The deserialized response.</returns>
    /// <exception cref="OperationCanceledException">
    /// The request was canceled, timed out, or the client was disposed of.
    /// </exception>
    public async Task<TResponse> RequestAsync<TRequest, TResponse>(
        string eventName,
        TRequest request,
        CancellationToken cancellationToken = default)
    {
        using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(
            cancellationToken,
            _cts.Token);

        var timeout = _options.DefaultTimeout;
        if (timeout != Timeout.InfiniteTimeSpan)
        {
            linkedCts.CancelAfter(timeout);
        }
        
        var correlationId = Guid.CreateVersion7().ToString();
        var message = NuiMessage.CreateRequest(correlationId, eventName, request);

        EnsureWithinPayloadLimit(_serializer.Serialize(message).Length, eventName);

        // RunContinuationsAsynchronously keeps the awaiting caller (and its
        // continuation) off the transport/inbound thread that completes the
        // response, so user code never runs inline on the callback thread.
        var tcs = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        _requestManager.RegisterPendingRequest(correlationId, tcs);

        var startedAt = Environment.TickCount64;

        _logger.LogDebug("-> REQUEST '{Event}' id={CorrelationId}", eventName, correlationId);
        LogPayload("->", message);

        try
        {
            await _transport.SendAsync(message, linkedCts.Token);

            var responseJson = await tcs.Task.WaitAsync(linkedCts.Token);
            var elapsed = Environment.TickCount64 - startedAt;

            _diagnostics.RecordTiming($"request:{eventName}", elapsed);
            _diagnostics.IncrementCounter("requests_completed");
            _logger.LogDebug("<- RESPONSE for '{Event}' id={CorrelationId} in {Elapsed}ms",
                eventName, correlationId, elapsed);

            return _serializer.Deserialize<TResponse>(responseJson)!;
        }
        catch (OperationCanceledException) when (_cts.IsCancellationRequested)
        {
            _diagnostics.IncrementCounter("requests_cancelled");
            _logger.LogWarning("Request '{Event}' id={CorrelationId} canceled (client disposed)",
                eventName, correlationId);
            throw;
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // The caller aborted their own token: a deliberate stop, not a
            // deadline. Reporting it as a timeout would poison the timeout
            // counter and mislead diagnosis.
            _diagnostics.IncrementCounter("requests_cancelled");
            _logger.LogWarning("Request '{Event}' id={CorrelationId} canceled by caller",
                eventName, correlationId);
            throw;
        }
        catch (OperationCanceledException)
        {
            _diagnostics.IncrementCounter("requests_timeout");
            _logger.LogError("Request '{Event}' id={CorrelationId} timed out after {Timeout}s",
                eventName, correlationId, timeout.TotalSeconds);
            throw;
        }
        catch (Exception ex)
        {
            _diagnostics.IncrementCounter("requests_failed");
            _logger.LogError(ex, "Request '{Event}' id={CorrelationId} failed",
                eventName, correlationId);
            throw;
        }
        finally
        {
            _requestManager.UnregisterPendingRequest(correlationId);
        }
    }

    /// <summary>
    /// Queues an event for fire-and-forget delivery without awaiting the page.
    /// </summary>
    /// <typeparam name="T">The payload type.</typeparam>
    /// <param name="eventName">The event name the page listens for.</param>
    /// <param name="payload">The payload to deliver.</param>
    public void Publish<T>(string eventName, T payload)
    {
        _diagnostics.IncrementCounter("events_published");

        var message = NuiMessage.CreateEvent(eventName, payload);
        _logger.LogDebug("-> PUBLISH '{Event}'", eventName);
        LogPayload("->", message);

        _ = _transport.SendAsync(message, _cts.Token);
    }

    /// <summary>
    /// Logs an inbound envelope for diagnostics.
    /// </summary>
    /// <param name="json">The raw envelope received from the page.</param>
    public void TraceIncoming(string json) =>
        _inboundHandler.TraceIncoming(json);

    /// <summary>
    /// Logs an outbound envelope for diagnostics.
    /// </summary>
    /// <param name="message">The envelope being sent to the page.</param>
    public void TraceOutgoing(NuiMessage message) =>
        _inboundHandler.TraceOutgoing(message);
    
    /// <summary>
    /// NUI is untrusted input and the CEF bridge has a hard size ceiling, so an
    /// oversized envelope is rejected before it reaches the transport.
    /// </summary>
    /// <param name="size">The serialized envelope size, in bytes.</param>
    /// <param name="eventName">The event name reported in the rejection message.</param>
    /// <exception cref="NuiException">
    /// <paramref name="size"/> exceeds <see cref="NuiOptions.MaxPayloadSize"/>.
    /// </exception>
    private void EnsureWithinPayloadLimit(int size, string eventName)
    {
        if (size <= _options.MaxPayloadSize)
        {
            return;
        }

        _diagnostics.IncrementCounter("payloads_rejected");

        throw new NuiException(
            "PAYLOAD_TOO_LARGE",
            $"'{eventName}' serialized to {size} bytes, limit is {_options.MaxPayloadSize}");
    }

    /// <summary>
    /// Logs the serialized payload at debug level when <see cref="NuiOptions.LogPayloads"/>
    /// is enabled. Failures are swallowed, so a malformed payload never crashes
    /// an outbound message.
    /// </summary>
    /// <param name="direction">Direction marker for the log line, for example</param>
    /// <param name="message">The envelope whose payload is logged.</param>
    private void LogPayload(string direction, NuiMessage message)
    {
        if (!_options.LogPayloads)
        {
            return;
        }

        try
        {
            _logger.LogDebug("{Direction} payload: {Payload}",
                direction, _serializer.Serialize(message.Payload));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not serialize payload for logging");
        }
    }

    /// <summary>
    /// Uses the caller-supplied logger, unless debug logging is on and no real
    /// logger was provided; otherwise, debug output would be swallowed. The
    /// upgraded logger writes to the FiveM client console.
    /// </summary>
    /// <param name="options">Options supplying the logger and the debug-logging flag.</param>
    /// <returns>The logger to use for this client.</returns>
    private static INuiLogger ResolveLogger(NuiOptions options)
    {
        var logger = options.Logger;

        if (options.EnableDebugLogging && logger is null or NullNuiLogger)
        {
            return new FiveMNuiLogger { IncludeDebug = true };
        }

        return logger ?? NullNuiLogger.Instance;
    }
}
