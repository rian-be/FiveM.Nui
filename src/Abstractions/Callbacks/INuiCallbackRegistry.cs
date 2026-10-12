namespace FiveM.Nui.Abstractions.Callbacks;

/// <summary>
/// Registry for NUI callback handlers.
/// </summary>
public interface INuiCallbackRegistry
{
    /// <summary>
    /// Registers a callback handler.
    /// </summary>
    /// <typeparam name="TRequest">Type of the request payload.</typeparam>
    /// <typeparam name="TResponse">Type of the response payload.</typeparam>
    /// <param name="eventName">Name of the event.</param>
    /// <param name="handler">Handler function.</param>
    /// <param name="options">
    /// Optional per-callback settings; when <see langword="null"/> the callback
    /// runs unserialized.
    /// </param>
    void Register<TRequest, TResponse>(
        string eventName,
        Func<TRequest, CancellationToken, Task<NuiResult<TResponse>>> handler,
        NuiCallbackOptions? options = null);

    /// <summary>
    /// Unregisters a callback handler.
    /// </summary>
    /// <param name="eventName">Name of the event.</param>
    /// <returns>True if a handler was removed.</returns>
    bool Unregister(string eventName);

    /// <summary>
    /// Gets a callback handler.
    /// </summary>
    /// <param name="eventName">Name of the event.</param>
    /// <returns>Handler delegate if found, null otherwise.</returns>
    INuiCallbackHandler? GetHandler(string eventName);
}
