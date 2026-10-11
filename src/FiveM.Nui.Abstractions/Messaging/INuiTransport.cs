namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Abstraction for NUI message transport.
/// </summary>
public interface INuiTransport
{
    /// <summary>
    /// Sends a message to NUI.
    /// </summary>
    /// <param name="message">Message to send.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task SendAsync(NuiMessage message, CancellationToken cancellationToken = default);

    /// <summary>
    /// Subscribes to incoming messages from NUI.
    /// </summary>
    /// <param name="handler">Message handler.</param>
    /// <returns>Disposable to unsubscribe.</returns>
    IDisposable Subscribe(Action<NuiMessage> handler);

    /// <summary>
    /// Forwards a raw JSON envelope received from the NUI page into the
    /// transport's subscriber pipeline.
    /// </summary>
    /// <param name="json">Raw JSON envelope as posted by the UI.</param>
    void OnMessageReceived(string json);
}
