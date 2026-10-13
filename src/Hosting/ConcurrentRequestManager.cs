using System.Collections.Concurrent;

namespace FiveM.Nui.Hosting;

/// <summary>
/// Manages pending requests with correlation IDs and automatic cleanup
/// of expired entries that never received a response.
/// </summary>
public sealed class ConcurrentRequestManager(INuiLogger logger) : INuiRequestCoordinator
{
    private readonly ConcurrentDictionary<string, PendingRequestInfo> _pendingRequests = new();

    private sealed class PendingRequestInfo(TaskCompletionSource<string> tcs)
    {
        public readonly TaskCompletionSource<string> Tcs = tcs;
        public readonly DateTimeOffset RegisteredAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Tracks an in-flight request so the matching response can complete it.
    /// </summary>
    /// <param name="correlationId">Correlation id assigned to the outgoing request.</param>
    /// <param name="tcs">Completion source completed when the response arrives.</param>
    public void RegisterPendingRequest(string correlationId, TaskCompletionSource<string> tcs)
    {
        if (!_pendingRequests.TryAdd(correlationId, new PendingRequestInfo(tcs)))
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
        if (_pendingRequests.TryRemove(correlationId, out var info))
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
        if (_pendingRequests.TryRemove(correlationId, out var info))
        {
            try
            {
                if (message.Success)
                {
                    logger.LogDebug("Completing {CorrelationId} successfully", correlationId);
                    var json = message.Payload is null
                        ? "null"
                        : serializer.Serialize(message.Payload);
                    info.Tcs.TrySetResult(json);
                }
                else
                {
                    var error = message.Error ?? new NuiError("UNKNOWN_ERROR", "Unknown error");
                    logger.LogWarning("Completing {CorrelationId} with failure: {Code} - {Message}",
                        correlationId, error.Code, error.Message);
                    info.Tcs.TrySetException(new NuiException(error.Code, error.Message));
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error completing request: {CorrelationId}", correlationId);
                info.Tcs.TrySetException(ex);
            }
        }
        else
        {
            logger.LogWarning("Received response for unknown request: {CorrelationId}", correlationId);
        }
    }

    /// <summary>
    /// Removes all requests older than the specified timeout from tracking.
    /// Returns the count of removed entries.
    /// </summary>
    /// <remarks>
    /// This is a lazy cleanup mechanism: expired entries are only removed when
    /// <see cref="RegisterPendingRequest"/> calls <c>CleanupExpired</c> before
    /// registering a new pending request. If no new requests arrive, expired
    /// entries will remain until the client is disposed.
    ///
    /// Cleanup removes expired entries from tracking without canceling their
    /// TaskCompletionSources. This allows individual request timeouts (set via
    /// the CancellationTokenSource in RequestAsync) to properly signal cancellation
    /// to callers, while still preventing memory leaks from orphaned entries.
    ///
    /// <para>
    /// IMPORTANT: This method should NOT be used as a replacement for request timeouts.
    /// RequestAsync always creates its own timeout via CancellationTokenSource.CancelAfter().
    /// The PendingRequestTimeout only cleans up tracking entries when no new request
    /// arrives for a while. If a request times out via its own timeout, it is properly
    /// unregistered in the finally block of RequestAsync.
    /// </para>
    ///
    /// <para>
    /// Use <c>PendingRequestTimeout = TimeSpan.Zero</c> to disable this cleanup entirely.
    /// </para>
    /// </remarks>
    /// <param name="timeout">Maximum age of requests to keep. Use <= TimeSpan.Zero to disable.</param>
    public int CleanupExpired(TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
        {
            return 0;
        }

        var now = DateTimeOffset.UtcNow;
        var cutoff = now - timeout;
        var removed = 0;

        foreach (var kvp in _pendingRequests)
        {
            if (kvp.Value.RegisteredAt < cutoff)
            {
                if (_pendingRequests.TryRemove(kvp.Key, out var info))
                {
                    // Log warning for expired but not-yet-canceled requests
                    // Do NOT call TrySetCanceled() here - let the request's own
                    // timeout (from RequestAsync's CancelAfter) handle cancellation.
                    // We just clean up the stale dictionary entry to prevent memory leaks.
                    logger.LogWarning(
                        "Expired pending request {CorrelationId} (registered at {RegisteredAt}, age={Age}) was not cleaned up by its owner",
                        kvp.Key, info.RegisteredAt, now - info.RegisteredAt);
                    removed++;
                }
            }
        }

        if (removed > 0)
        {
            logger.LogDebug("Cleaned up {Count} expired pending request(s), {Remaining} remaining",
                removed, _pendingRequests.Count);
        }

        return removed;
    }

    /// <summary>
    /// Cancels every request still awaiting response and clears the pending set.
    /// </summary>
    /// <remarks>
    /// Called on client shutdown: a caller blocked in NUI round trip must not
    /// hang forever once the page can no longer answer, so outstanding operations
    /// are canceled instead of being left dangling.
    /// </remarks>
    public ValueTask DisposeAsync()
    {
        logger.LogDebug("Canceling {Count} pending request(s) on dispose", _pendingRequests.Count);

        foreach (var (_, info) in _pendingRequests)
        {
            info.Tcs.TrySetCanceled();
        }
        _pendingRequests.Clear();
        return ValueTask.CompletedTask;
    }
}
