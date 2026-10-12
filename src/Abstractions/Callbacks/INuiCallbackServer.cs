namespace FiveM.Nui.Abstractions.Callbacks;

/// <summary>
/// Server side NUI callback registration and removal.
/// </summary>
public interface INuiCallbackServer
{
    /// <summary>
    /// Registers callback handler for NUI requests.
    /// </summary>
    /// <param name="eventName">The callback event name the page invokes.</param>
    /// <param name="handler">Invoked with the request; returns the response to send back.</param>
    /// <param name="options">
    /// Optional per-callback settings (for example serializing executions that
    /// mutate shared state); when <see langword="null"/> the callback runs
    /// unserialized.
    /// </param>
    void RegisterCallback<TRequest, TResponse>(
        string eventName,
        Func<TRequest, CancellationToken, Task<NuiResult<TResponse>>> handler,
        NuiCallbackOptions? options = null);

    /// <summary>
    /// Removes previously registered callback.
    /// </summary>
    bool UnregisterCallback(string eventName);
}
