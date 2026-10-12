namespace FiveM.Nui.Callbacks;

/// <summary>
/// Typed adapter that turns a strongly typed callback delegate into the
/// <see cref="INuiCallbackHandler"/> contract the inbound dispatcher calls.
/// </summary>
/// <typeparam name="TRequest">Type the request payload is deserialized into.</typeparam>
/// <typeparam name="TResponse">Type carried by a successful result.</typeparam>
/// <param name="handler">User callback, invoked with the deserialized request and cancellation token.</param>
/// <param name="logger">Logger for failure, cancellation and exception diagnostics.</param>
/// <param name="eventName">Registered callback name, used only in log messages.</param>
/// <remarks>
/// Each registration produces one of these, capturing the request/response
/// types at construction time, so dispatch never needs to reflect on the
/// delegate's declaring type.
/// </remarks>
internal sealed class CallbackHandler<TRequest, TResponse>(
    Func<TRequest, CancellationToken, Task<NuiResult<TResponse>>> handler,
    INuiLogger logger,
    string eventName)
    : INuiCallbackHandler
{
    /// <summary>
    /// Deserializes the payload, runs the typed handler, and serializes the
    /// outcome into a response envelope.
    /// </summary>
    /// <remarks>
    /// A handler failure or cancellation is turned into a failure response
    /// (<c>CANCELLED</c> / <c>CALLBACK_ERROR</c>) instead of an unhandled
    /// exception, so the page always receives a reply rather than timing out.
    /// </remarks>
    /// <param name="payload">Deserialized request payload (typically a <c>JsonElement</c>).</param>
    /// <param name="serializer">Serializer for the request and response.</param>
    /// <param name="cancellationToken">Cancellation token for the handler invocation.</param>
    /// <returns>The serialized response envelope.</returns>
    public async Task<string> ExecuteAsync(
        object? payload,
        INuiSerializer serializer,
        CancellationToken cancellationToken)
    {
        try
        {
            var request = serializer.Deserialize<TRequest>(payload);
            var result = await handler(request!, cancellationToken);

            if (!result.Success)
            {
                logger.LogWarning("Callback '{Event}' returned failure: {Code} - {Message}",
                    eventName,
                    result.Error?.Code ?? "-",
                    result.Error?.Message ?? "-");
            }

            var responseMessage = result.Success
                ? NuiMessage.CreateResponse(string.Empty, true, result.Value)
                : NuiMessage.CreateResponse(string.Empty, false, error: result.Error);

            return serializer.Serialize(responseMessage);
        }
        catch (OperationCanceledException)
        {
            logger.LogWarning("Callback '{Event}' was cancelled", eventName);

            var cancelled = NuiMessage.CreateResponse(
                string.Empty,
                false,
                error: new NuiError("CANCELLED", "The request was cancelled"));
            return serializer.Serialize(cancelled);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Callback '{Event}' threw while handling {Request}",
                eventName, typeof(TRequest).Name);

            var errorResponse = NuiMessage.CreateResponse(
                string.Empty,
                false,
                error: new NuiError("CALLBACK_ERROR", "Failed to process request"));
            return serializer.Serialize(errorResponse);
        }
    }
}