namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Outbound messaging: one-way sends, request/response, and publish for
/// events that the local runtime pushes into the NUI page.
/// </summary>
public interface INuiMessenger
{
    /// <summary>
    /// Sends a one-way message to NUI.
    /// </summary>
    Task SendAsync<T>(string eventName, T payload, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends a request and waits for a response.
    /// </summary>
    Task<TResponse> RequestAsync<TRequest, TResponse>(
        string eventName,
        TRequest request,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Publishes an event to NUI subscribers.
    /// </summary>
    void Publish<T>(string eventName, T payload);
}
