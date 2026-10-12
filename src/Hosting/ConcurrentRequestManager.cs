using System.Collections.Concurrent;

namespace FiveM.Nui.Hosting;

/// <summary>
/// Manages pending requests with correlation IDs.
/// </summary>
public sealed class ConcurrentRequestManager(INuiLogger logger) : INuiRequestCoordinator
{
    private readonly ConcurrentDictionary<string, TaskCompletionSource<string>> _pendingRequests = new();

    /// <summary>
    /// Tracks an in-flight request so the matching response can complete it.
    /// </summary>
    /// <param name="correlationId">Correlation id assigned to the outgoing request.</param>
    /// <param name="tcs">Completion source completed when the response arrives.</param>
    public void RegisterPendingRequest(string correlationId, TaskCompletionSource<string> tcs)
    {
        if (!_pendingRequests.TryAdd(correlationId, tcs))
        {
            logger.LogWarning("Duplicate correlation ID registered: {CorrelationId}", correlationId);
            return;
        }

        logger.LogDebug("Registered pending request {CorrelationId} (pending={Count})",
            correlationId, _pendingRequests.Count);
    }

    /// <summary>
    /// Stops tracking the request with the given correlation id.
    /// </summary>
    /// <param name="correlationId">Correlation id of the request to remove.</param>
    public void UnregisterPendingRequest(string correlationId)
    {
        if (_pendingRequests.TryRemove(correlationId, out _))
        {
            logger.LogDebug("Unregistered pending request {CorrelationId} (pending={Count})",
                correlationId, _pendingRequests.Count);
        }
    }

    /// <summary>
    /// Completes the pending request matching the inbound response envelope.
    /// </summary>
    /// <param name="correlationId">Correlation id carried by the response.</param>
    /// <param name="message">The inbound response envelope.</param>
    /// <param name="serializer">Serializer used to read the response payload.</param>
    public void CompleteRequest(string correlationId, NuiMessage message, INuiSerializer serializer)
    {
        if (_pendingRequests.TryRemove(correlationId, out var tcs))
        {
            try
            {
                if (message.Success)
                {
                    logger.LogDebug("Completing {CorrelationId} successfully", correlationId);
                    var json = message.Payload is null
                        ? "null"
                        : serializer.Serialize(message.Payload);
                    tcs.TrySetResult(json);
                }
                else
                {
                    var error = message.Error ?? new NuiError("UNKNOWN_ERROR", "Unknown error");
                    logger.LogWarning("Completing {CorrelationId} with failure: {Code} - {Message}",
                        correlationId, error.Code, error.Message);
                    tcs.TrySetException(new NuiException(error.Code, error.Message));
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error completing request: {CorrelationId}", correlationId);
                tcs.TrySetException(ex);
            }
        }
        else
        {
            logger.LogWarning("Received response for unknown request: {CorrelationId}", correlationId);
        }
    }

    /// <summary>
    /// Cancels every request still awaiting response and clears the pending set.
    /// </summary>
    /// <remarks>
    /// Called on client shutdown: a caller blocked in NUI round trip must not
    /// hang forever once the page can no longer answer, so outstanding operations
    /// are canceled instead of left dangling.
    /// </remarks>
    public ValueTask DisposeAsync()
    {
        logger.LogDebug("Canceling {Count} pending request(s) on dispose", _pendingRequests.Count);

        foreach (var (_, tcs) in _pendingRequests)
        {
            tcs.TrySetCanceled();
        }
        _pendingRequests.Clear();
        return ValueTask.CompletedTask;
    }
}
