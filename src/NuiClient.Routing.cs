namespace FiveM.Nui;

// Callback registration (INuiCallbackServer) and event subscription
// (INuiEventRouter). Split out of NuiClient.cs to keep each file small.
public partial class NuiClient
{
    /// <summary>
    /// Registers a callback the NUI page can invoke and receive a response from.
    /// </summary>
    /// <typeparam name="TRequest">The request payload type produced from the page.</typeparam>
    /// <typeparam name="TResponse">The response payload type returned to the page.</typeparam>
    /// <param name="eventName">The callback event name the page invokes.</param>
    /// <param name="handler">Invoked with the request; returns the response to send back.</param>
    /// <param name="options">
    /// Optional per callback settings (for example, serializing executions that
    /// mutate shared state) when <see langword="null"/> the callback runs
    /// unserialized.
    /// </param>
    public void RegisterCallback<TRequest, TResponse>(
        string eventName,
        Func<TRequest, CancellationToken, Task<NuiResult<TResponse>>> handler,
        NuiCallbackOptions? options = null)
    {
        ThrowIfDisposed();
        ValidateEventName(eventName);
        ArgumentNullException.ThrowIfNull(handler);
        _logger.LogDebug("Registering callback '{Event}' as {Request} -> {Response}",
            eventName, typeof(TRequest).Name, typeof(TResponse).Name);

        _callbackRegistry.Register(eventName, handler, options);
    }

    /// <summary>
    /// Removes the callback registered for <paramref name="eventName"/>.
    /// </summary>
    /// <param name="eventName">The callback event name to remove.</param>
    /// <returns><see langword="true"/> if a callback was removed; otherwise <see langword="false"/>.</returns>
    public bool UnregisterCallback(string eventName)
    {
        ThrowIfDisposed();
        ValidateEventName(eventName);
        return _callbackRegistry.Unregister(eventName);
    }

    /// <summary>
    /// Subscribes to events forwarded from the NUI page.
    /// </summary>
    /// <typeparam name="T">The payload type the handler expects.</typeparam>
    /// <param name="eventName">The event name to listen for.</param>
    /// <param name="handler">The callback invoked for each matching event.</param>
    /// <returns>An <see cref="IDisposable"/> that unsubscribes the handler.</returns>
    public IDisposable Subscribe<T>(string eventName, Action<T> handler)
    {
        ThrowIfDisposed();
        ValidateEventName(eventName);
        ArgumentNullException.ThrowIfNull(handler);
        _logger.LogDebug("Subscribing to '{Event}' as {Payload}", eventName, typeof(T).Name);
        return _eventManager.Subscribe(eventName, handler);
    }
}
