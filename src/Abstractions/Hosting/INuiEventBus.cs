namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Internal event bus for routing inbound NUI events to subscribers.
/// </summary>
public interface INuiEventBus
{
    /// <summary>
    /// Subscribes to an event with a typed handler.
    /// </summary>
    IDisposable Subscribe<T>(string eventName, Action<T> handler);

    /// <summary>
    /// Publishes a payload to all subscribers of the event.
    /// </summary>
    void Publish(string eventName, string payloadJson, INuiSerializer serializer);
}
