namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Event subscription for messages that originate inside the NUI page.
/// </summary>
public interface INuiEventRouter
{
    /// <summary>
    /// Subscribes to NUI events.
    /// </summary>
    IDisposable Subscribe<T>(string eventName, Action<T> handler);
}
