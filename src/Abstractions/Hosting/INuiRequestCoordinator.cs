namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Coordinates pending NUI requests identified by correlation IDs.
/// </summary>
public interface INuiRequestCoordinator : IAsyncDisposable
{
    /// <summary>
    /// Registers a pending request with its correlation ID.
    /// The <see cref="TaskCompletionSource{T}"/> stores the serialized JSON
    /// payload so the caller can deserialize it directly to the expected type
    /// without a redundant serialize/deserialize round-trip.
    /// </summary>
    void RegisterPendingRequest(string correlationId, TaskCompletionSource<string> tcs);

    /// <summary>
    /// Unregisters a pending request.
    /// </summary>
    void UnregisterPendingRequest(string correlationId);

    /// <summary>
    /// Completes a pending request with the response message.
    /// </summary>
    void CompleteRequest(string correlationId, NuiMessage message, INuiSerializer serializer);

    /// <summary>
    /// Removes all requests older than the specified timeout from tracking.
    /// </summary>
    /// <param name="timeout">Maximum age of requests to keep.</param>
    int CleanupExpired(TimeSpan timeout);
}
