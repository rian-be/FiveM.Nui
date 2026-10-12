using System.Collections.Concurrent;
using System.Text.Json;
using FiveM.Nui.Common;

namespace FiveM.Nui.Hosting;

/// <summary>
/// Manages event subscriptions and publications.
/// </summary>
public sealed class EventManager(INuiLogger logger) : INuiEventBus
{
    private readonly ConcurrentDictionary<string, ConcurrentBag<Subscription>> _subscribers = new();

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
        var subscription = new Subscription(typeof(T), handler);

        var bag = _subscribers.GetOrAdd(eventName, _ => []);
        bag.Add(subscription);

        logger.LogDebug("Subscribed to '{Event}' as {Payload} (subscribers={Count})",
            eventName, typeof(T).Name, bag.Count);

        return new DisposableAction(() =>
        {
            if (!_subscribers.TryGetValue(eventName, out var handlers)) return;
           
            var newBag = new ConcurrentBag<Subscription>();
            foreach (var existing in handlers)
            {
                if (!ReferenceEquals(existing, subscription))
                {
                    newBag.Add(existing);
                }
            }
            _subscribers.TryUpdate(eventName, newBag, handlers);

            logger.LogDebug("Unsubscribed from '{Event}' (subscribers={Count})",
                eventName, newBag.Count);
        });
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
        if (!_subscribers.TryGetValue(eventName, out var handlers))
        {
            logger.LogDebug("No subscribers for '{Event}'; dropping payload", eventName);
            return;
        }

        logger.LogDebug("Publishing '{Event}' to {Count} subscriber(s)", eventName, handlers.Count);

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

                subscription.Handler.DynamicInvoke(payload);
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

    private sealed record Subscription(Type PayloadType, Delegate Handler);
}
