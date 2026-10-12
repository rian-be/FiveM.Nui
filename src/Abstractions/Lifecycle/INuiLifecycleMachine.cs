namespace FiveM.Nui.Abstractions.Lifecycle;

/// <summary>
/// Internal state machine driving the NUI page lifecycle.
/// </summary>
public interface INuiLifecycleMachine
{
    /// <summary>
    /// The current state.
    /// </summary>
    NuiLifecycleState Current { get; }

    /// <summary>
    /// True once the machine has reached the disposed state.
    /// </summary>
    bool IsDisposed { get; }

    /// <summary>
    /// Raised after every accepted state transition.
    /// </summary>
    event Action<NuiLifecycleState, NuiLifecycleState>? StateChanged;

    /// <summary>
    /// Attempts a transition.
    /// </summary>
    bool TryTransition(NuiLifecycleState target, string reason = "");

    /// <summary>
    /// Reports that the NUI page has loaded and is ready to receive messages.
    /// </summary>
    bool MarkReady(string reason = "page signalled ready");

    /// <summary>
    /// Reports that the NUI page began loading, e.g. after a reconnect.
    /// </summary>
    bool MarkLoading(string reason = "page reload");

    /// <summary>
    /// Marks the window visible, e.g. after a successful focus.
    /// </summary>
    bool MarkVisible(string reason = "window focused");

    /// <summary>
    /// Marks the window hidden.
    /// </summary>
    bool MarkHidden(string reason = "focus released");

    /// <summary>
    /// Marks the client disposed. Terminal.
    /// </summary>
    bool MarkDisposed(string reason = "client disposed");
}
