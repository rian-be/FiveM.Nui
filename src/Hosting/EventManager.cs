using System.Text.Json;

namespace FiveM.Nui.Hosting;

/// <summary>
/// Manages event subscriptions and publications.
/// </summary>
public sealed class EventManager(INuiLogger logger) : INuiEventBus
{
    private readonly Dictionary<string, Subscription[]> _subscribers = new();
    private readonly Lock _gate = new();

    /// <summary>
    /// Registers <paramref name="handler"/> for <paramref name="eventName"/> and
    /// returns a handle that removes it again.
    /// </summary>
    /// <typeparam name="T">The payload type the handler expects.</typeparam>
    /// <param name="eventName">The event name to listen for.</param>
    /// <param name="handler">The callback invoked for each matching event.</param>
    /// <returns>
    /// An <see cref="IDisposable"/> whose disposal unsubscribes the handler. The
    /// same handler may be registered more than once, and each handle removes only
    /// its own registration.
    /// </returns>
    public IDisposable Subscribe<T>(string eventName, Action<T> handler)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(eventName);
        ArgumentNullException.ThrowIfNull(handler);
        var subscription = new Subscription<T>(handler);

        int count;
        lock (_gate)
        {
            _subscribers.TryGetValue(eventName, out var handlers);
            handlers ??= [];
            var updated = new Subscription[handlers.Length + 1];
            handlers.CopyTo(updated, 0);
            updated[^1] = subscription;
            _subscribers[eventName] = updated;
            count = updated.Length;
        }

        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Subscribed to '{Event}' as {Payload} (subscribers={Count})",
                eventName, typeof(T).Name, count);

        return new SubscriptionHandle(this, eventName, subscription);
    }

    /// <summary>
    /// Delivers an event payload to every subscriber registered for
    /// <paramref name="eventName"/>.
    /// </summary>
    /// <remarks>
    /// The payload arrives as raw JSON because the envelope is untyped. It is
    /// deserialized per subscriber: passing the boxed object straight through
    /// would silently skip every <c>Action&lt;T&gt;</c> that expects a specific
    /// record instead of <c>object</c>.
    /// </remarks>
    public void Publish(string eventName, string payloadJson, INuiSerializer serializer)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(eventName);
        ArgumentNullException.ThrowIfNull(payloadJson);
        ArgumentNullException.ThrowIfNull(serializer);

        Subscription[] handlers;
        lock (_gate)
            handlers = _subscribers.TryGetValue(eventName, out var current) ? current : [];
        if (handlers.Length == 0)
        {
            if (logger.IsEnabled(NuiLogLevel.Debug))
                logger.LogDebug("No subscribers for '{Event}'; dropping payload", eventName);
            return;
        }

        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Publishing '{Event}' to {Count} subscriber(s)", eventName, handlers.Length);

        foreach (var subscription in handlers)
        {
            try
            {
                var payload = serializer.Deserialize(payloadJson, subscription.PayloadType);

                if (payload is null)
                {
                    logger.LogWarning(
                        "Subscriber for '{Event}' as {Payload} received null; skipped",
                        eventName, subscription.PayloadType.Name);
                    continue;
                }

                subscription.Invoke(payload);
            }
            catch (JsonException ex)
            {
                logger.LogError(ex, "Cannot deserialize '{Event}' payload as {Type}",
                    eventName, subscription.PayloadType.Name);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error in event handler for: {Event}", eventName);
            }
        }
    }

    private void Unsubscribe(string eventName, Subscription subscription)
    {
        int count;
        lock (_gate)
        {
            if (!_subscribers.TryGetValue(eventName, out var handlers))
                return;

            var index = Array.IndexOf(handlers, subscription);
            if (index < 0)
                return;

            count = handlers.Length - 1;
            if (count == 0)
            {
                _subscribers.Remove(eventName);
            }
            else
            {
                var updated = new Subscription[count];
                if (index > 0)
                    Array.Copy(handlers, 0, updated, 0, index);
                if (index < count)
                    Array.Copy(handlers, index + 1, updated, index, count - index);
                _subscribers[eventName] = updated;
            }
        }

        if (logger.IsEnabled(NuiLogLevel.Debug))
            logger.LogDebug("Unsubscribed from '{Event}' (subscribers={Count})", eventName, count);
    }

    private abstract class Subscription
    {
        public abstract Type PayloadType { get; }
        public abstract void Invoke(object payload);
    }

    private sealed class Subscription<T>(Action<T> handler) : Subscription
    {
        public override Type PayloadType => typeof(T);
        public override void Invoke(object payload) => handler((T)payload);
    }

    private sealed class SubscriptionHandle(
        EventManager owner,
        string eventName,
        Subscription subscription) : IDisposable
    {
        private EventManager? _owner = owner;

        public void Dispose() =>
            Interlocked.Exchange(ref _owner, null)?.Unsubscribe(eventName, subscription);
    }
}
