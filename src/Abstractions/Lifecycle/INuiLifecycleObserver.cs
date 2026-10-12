namespace FiveM.Nui.Abstractions.Lifecycle;

/// <summary>
/// Observes and drives the NUI page lifecycle state machine.
/// </summary>
public interface INuiLifecycleObserver
{
    /// <summary>
    /// Gets the validated lifecycle state of the NUI surface.
    /// </summary>
    NuiLifecycleState LifecycleState { get; }

    /// <summary>
    /// Reports that the NUI page has loaded and is ready to receive messages.
    /// </summary>
    void MarkNuiReady();

    /// <summary>
    /// Reports that the NUI page began loading, e.g. after a reconnect.
    /// </summary>
    void MarkNuiLoading();
}
