using System.Collections.Concurrent;

namespace FiveM.Nui.Callbacks;

/// <summary>
/// Implementation of the NUI callback registry.
/// </summary>
public sealed class NuiCallbackRegistry(INuiLogger logger) : INuiCallbackRegistry
{
    private readonly ConcurrentDictionary<string, INuiCallbackHandler> _handlers = new();

    /// <summary>
    /// Gates shared by serialized callbacks, keyed by serialization group.
    /// A gate with a given name is created on first use and reused, so several
    /// callbacks that name the same group serialize against each other.
    /// </summary>
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _gates = new();

    /// <summary>
    /// Registers <paramref name="handler"/> to answer callbacks named
    /// <paramref name="eventName"/>.
    /// </summary>
    /// <typeparam name="TRequest">The request payload type produced from the page.</typeparam>
    /// <typeparam name="TResponse">The response payload type returned to the page.</typeparam>
    /// <param name="eventName">The callback event name the page invokes.</param>
    /// <param name="handler">Invoked with the deserialized request; returns the response to send back.</param>
    /// <param name="options">
    /// Optional per callback settings when serialization is requested, the
    /// handler is wrapped so at most one execution runs at a time.
    /// </param>
    /// <exception cref="InvalidOperationException">
    /// A handler is already registered for <paramref name="eventName"/>.
    /// </exception>
    public void Register<TRequest, TResponse>(
        string eventName,
        Func<TRequest, CancellationToken, Task<NuiResult<TResponse>>> handler,
        NuiCallbackOptions? options = null)
    {
        INuiCallbackHandler callbackHandler =
            new CallbackHandler<TRequest, TResponse>(handler, logger, eventName);

        if (options is { Serialize: true })
        {
            var group = options.SerializationGroup ?? eventName;
            var gate = _gates.GetOrAdd(group, _ => new SemaphoreSlim(1, 1));
            callbackHandler = new SerializedCallbackHandler(callbackHandler, gate);
        }

        // Atomic add: a separate ContainsKey check would race with concurrent
        // registration of the same name and silently drop one of the two.
        if (!_handlers.TryAdd(eventName, callbackHandler))
        {
            throw new InvalidOperationException($"Callback for event '{eventName}' is already registered");
        }
    }

    /// <summary>
    /// Removes the handler registered for <paramref name="eventName"/>.
    /// </summary>
    /// <param name="eventName">The callback event name to remove.</param>
    /// <returns><see langword="true"/> if a handler was removed; otherwise <see langword="false"/>.</returns>
    public bool Unregister(string eventName)
    {
        var removed = _handlers.TryRemove(eventName, out _);

        if (removed)
        {
            logger.LogInformation("Unregistered callback '{Event}'", eventName);
        }
        else
        {
            logger.LogWarning("Unregister requested for unknown callback '{Event}'", eventName);
        }

        return removed;
    }

    /// <summary>
    /// Removes the handler registered for <paramref name="eventName"/> and
    /// returns the removed handler, or <c>null</c> when none is registered.
    /// </summary>
    public INuiCallbackHandler? UnregisterAndGetHandler(string eventName)
    {
        if (_handlers.TryRemove(eventName, out var handler))
        {
            logger.LogInformation("Unregistered callback '{Event}'", eventName);
            return handler;
        }

        logger.LogWarning("Unregister requested for unknown callback '{Event}'", eventName);
        return null;
    }

    /// <summary>
    /// Looks up the handler registered for <paramref name="eventName"/>.
    /// </summary>
    /// <param name="eventName">The callback event name to look up.</param>
    /// <returns>The registered handler, or <see langword="null"/> when none is registered.</returns>
    public INuiCallbackHandler? GetHandler(string eventName)
    {
        _handlers.TryGetValue(eventName, out var handler);
        return handler;
    }
}
