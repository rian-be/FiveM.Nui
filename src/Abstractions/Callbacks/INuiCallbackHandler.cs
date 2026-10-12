namespace FiveM.Nui.Abstractions.Callbacks;

/// <summary>
/// Abstraction for callback handler.
/// </summary>
public interface INuiCallbackHandler
{
    /// <summary>
    /// Executes the handler with deserialized request payload.
    /// </summary>
    /// <param name="payload">Deserialized request payload (typically a <c>JsonElement</c>).</param>
    /// <param name="serializer">Serializer to use.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>Serialized response.</returns>
    Task<string> ExecuteAsync(object? payload, INuiSerializer serializer, CancellationToken cancellationToken);
}
