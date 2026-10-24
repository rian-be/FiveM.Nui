using System.Collections.Concurrent;

namespace FiveM.Nui.Hosting;

/// <summary>
/// Manages pending requests with correlation IDs and automatic cleanup
/// of expired entries that never received a response.
/// </summary>
public sealed class ConcurrentRequestManager(INuiLogger logger) : INuiRequestCoordinator
{
    private readonly ConcurrentDictionary<string, PendingRequestInfo> _pendingRequests = new();
    private long _nextAutomaticCleanup;

    private abstract class PendingRequestInfo
    {
        public readonly long RegisteredAt = Environment.TickCount64;

        public abstract void Complete(NuiMessage message, INuiSerializer serializer);
        public abstract void Fail(Exception exception);
        public abstract void Cancel();
    }

    private sealed class JsonPendingRequest(TaskCompletionSource<string> completion) : PendingRequestInfo
    {
        public override void Complete(NuiMessage message, INuiSerializer serializer) =>
            completion.TrySetResult(message.Payload is null ? "null" : serializer.Serialize(message.Payload));

        public override void Fail(Exception exception) => completion.TrySetException(exception);
        public override void Cancel() => completion.TrySetCanceled();
    }

    private sealed class TypedPendingRequest<T>(TaskCompletionSource<T> completion) : PendingRequestInfo
    {
        public override void Complete(NuiMessage message, INuiSerializer serializer) =>
            completion.TrySetResult(serializer.Deserialize<T>(message.Payload)!);

        public override void Fail(Exception exception) => completion.TrySetException(exception);
        public override void Cancel() => completion.TrySetCanceled();
    }

    /// <summary>
    /// Tracks an in-flight request so the matching response can complete it.
    /// </summary>
    /// <param name="correlationId">Correlation id assigned to the outgoing request.</param>
    /// <param name="tcs">Completion source completed when the response arrives.</param>
    public void RegisterPendingRequest(string correlationId, TaskCompletionSource<string> tcs)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(correlationId);
        ArgumentNullException.ThrowIfNull(tcs);

        RegisterPendingRequest(correlationId, new JsonPendingRequest(tcs));
    }

    /// <summary>
    /// Registers a typed completion for the built-in client path. The response
    /// payload can then be read directly from its JsonElement without creating
    /// an intermediate JSON string.
    /// </summary>
    internal void RegisterPendingRequest<T>(string correlationId, TaskCompletionSource<T> tcs)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(correlationId);
        ArgumentNullException.ThrowIfNull(tcs);
        RegisterPendingRequest(correlationId, new TypedPendingRequest<T>(tcs));
    }

    private void RegisterPendingRequest(string correlationId, PendingRequestInfo request)
    {
        if (!_pendingRequests.TryAdd(correlationId, request))
        {
            throw new InvalidOperationException(
                $"A pending request with correlation ID '{correlationId}' is already registered.");
        }

        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Registered pending request {CorrelationId} (pending={Count})",
                correlationId, _pendingRequests.Count);
    }

    /// <summary>
    /// Stops tracking the request with the given correlation id.
    /// </summary>
    /// <param name="correlationId">Correlation id of the request to remove.</param>
    public void UnregisterPendingRequest(string correlationId)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(correlationId);
        if (_pendingRequests.TryRemove(correlationId, out var info))
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
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
        ArgumentException.ThrowIfNullOrWhiteSpace(correlationId);
        ArgumentNullException.ThrowIfNull(message);
        ArgumentNullException.ThrowIfNull(serializer);

        if (_pendingRequests.TryRemove(correlationId, out var info))
        {
            try
            {
                if (message.Success)
                {
                    if (logger.IsEnabled(NuiLogLevel.Debug))
                        logger.LogDebug("Completing {CorrelationId} successfully", correlationId);
                    info.Complete(message, serializer);
                }
                else
                {
                    var error = message.Error ?? new NuiError("UNKNOWN_ERROR", "Unknown error");
                    logger.LogWarning("Completing {CorrelationId} with failure: {Code} - {Message}",
                        correlationId, error.Code, error.Message);
                    info.Fail(new NuiException(error.Code, error.Message));
                }
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error completing request: {CorrelationId}", correlationId);
                info.Fail(ex);
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
    /// This is a lazy cleanup mechanism: the client requests cleanup before
    /// registering new pending work. If no new requests arrive, expired entries
    /// remain until the coordinator is disposed.
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
    /// <param name="timeout">Maximum age of requests to keep. Use &lt;= TimeSpan.Zero to disable.</param>
    public int CleanupExpired(TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
        {
            return 0;
        }

        var now = Environment.TickCount64;
        var timeoutMilliseconds = (long)Math.Min(timeout.TotalMilliseconds, long.MaxValue);
        var removed = 0;

        foreach (var kvp in _pendingRequests)
        {
            var ageMilliseconds = now - kvp.Value.RegisteredAt;
            if (ageMilliseconds <= timeoutMilliseconds) continue;
            if (!_pendingRequests.TryRemove(kvp.Key, out _)) continue;
            
            // Log warning for expired but not-yet-canceled requests
            // Do NOT call TrySetCanceled() here - let the request's own
            // timeout (from RequestAsync's CancelAfter) handle cancellation.
            // We just clean up the stale dictionary entry to prevent memory leaks.
            logger.LogWarning(
                "Expired pending request {CorrelationId} (age={Age}) was not cleaned up by its owner",
                kvp.Key, TimeSpan.FromMilliseconds(ageMilliseconds));
            removed++;
        }

        if (removed <= 0) return removed;
        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Cleaned up {Count} expired pending request(s), {Remaining} remaining",
                removed, _pendingRequests.Count);

        return removed;
    }

    /// <summary>
    /// Runs the client's opportunistic cleanup at most once every 30 seconds.
    /// Individual requests unregister themselves, so scanning the dictionary on
    /// every healthy request only adds contention and cannot find useful work.
    /// </summary>
    internal int CleanupExpiredIfDue(TimeSpan timeout)
    {
        if (timeout <= TimeSpan.Zero)
            return 0;

        var now = Environment.TickCount64;
        var next = Volatile.Read(ref _nextAutomaticCleanup);
        if (now < next)
            return 0;

        var interval = Math.Min(timeout.TotalMilliseconds, 30_000d);
        var scheduled = now + Math.Max(1L, (long)interval);
        return Interlocked.CompareExchange(ref _nextAutomaticCleanup, scheduled, next) != next
            ? 0
            : CleanupExpired(timeout);
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
        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Canceling {Count} pending request(s) on dispose", _pendingRequests.Count);

        foreach (var (_, info) in _pendingRequests)
        {
            info.Cancel();
        }
        _pendingRequests.Clear();
        return ValueTask.CompletedTask;
    }
}
