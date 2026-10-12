using FiveM.Nui.Hosting;

namespace FiveM.Nui.Lifecycle;

/// <summary>
/// Validated <see cref="NuiLifecycleState"/> machine for a single NUI surface.
/// </summary>
/// <remarks>
/// <para>
/// The enum alone documents nothing. This class is what makes the states
/// enforceable: an illegal transition is refused and reported, so a caller that
/// focuses on a window that was never opened fails loudly instead of leaving the
/// client and the page disagreeing about reality.
/// </para>
/// <para>
/// Transitions are driven by things that actually happened - a page confirming
/// readiness, a window being focused - never from a UI toggle or an optimistic
/// guess. An unrecognized state change is ignored rather than accepted, because
/// the alternative is a machine that claims to be
/// <see cref="NuiLifecycleState.Visible"/> while nothing is on screen.
/// </para>
/// </remarks>
public sealed class NuiStateMachine(INuiLogger? logger = null) : INuiLifecycleMachine
{
    /// <summary>
    /// Legal transitions. Anything absent here is refused.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <c>Created - Ready</c> and <c>Hidden - Ready</c> are the page
    /// booting on its own, without the host opening window first: inbound
    /// traffic is proof the page is up, and a resource that never calls
    /// <c>OpenAsync</c> must still reach a truthful state.
    /// </para>
    /// <para>
    /// <c>Ready - Visible</c> and back are the normal focus cycle;
    /// <c>Visible|Hidden - Loading</c> covers a page that reloads underneath
    /// us, which happens when a client reconnects. Every state reaches
    /// <c>Disposed</c> because a resource can stop at any point, and
    /// <c>Disposed</c> is terminal - a client that has been disposed must not be
    /// resurrected, since its cancellation token and pending requests are gone.
    /// </para>
    /// <para>
    /// <c>Ready - Ready</c> is deliberately absent: a late or duplicate
    /// readiness signal after focus is a symptom worth seeing, not noise to
    /// absorb. <c>TryTransition</c> still no-ops on a repeat of the current
    /// state, so only a genuine rewind is reported.
    /// </para>
    /// </remarks>
    private static readonly Dictionary<NuiLifecycleState, NuiLifecycleState[]> Allowed = new()
    {
        [NuiLifecycleState.Created] =
            [NuiLifecycleState.Ready, NuiLifecycleState.Loading, NuiLifecycleState.Disposed],
        [NuiLifecycleState.Loading] =
            [NuiLifecycleState.Ready, NuiLifecycleState.Disposed],
        [NuiLifecycleState.Ready] =
            [NuiLifecycleState.Visible, NuiLifecycleState.Hidden, NuiLifecycleState.Disposed],
        [NuiLifecycleState.Visible] =
            [NuiLifecycleState.Hidden, NuiLifecycleState.Loading, NuiLifecycleState.Disposed],
        [NuiLifecycleState.Hidden] =
            [NuiLifecycleState.Visible, NuiLifecycleState.Ready, NuiLifecycleState.Loading,
             NuiLifecycleState.Disposed],
        [NuiLifecycleState.Disposed] = []
    };

    private readonly INuiLogger _logger = logger ?? NullNuiLogger.Instance;
    private readonly Lock _gate = new();

    /// <summary>
    /// The current state. Safe to read from any thread.
    /// </summary>
    /// <remarks>
    /// Backed by the C# 14 <see langword="field"/> keyword instead of a
    /// handwritten <c>_current</c> field; both accessors still take
    /// <see cref="_gate"/> (which is reentrant), so reads and writes stay atomic.
    /// </remarks>
    public NuiLifecycleState Current
    {
        get
        {
            lock (_gate)
            {
                return field;
            }
        }
        private set
        {
            lock (_gate)
            {
                field = value;
            }
        }
    }

    /// <summary>
    /// True, once the client has been disposed of. Useful as a guard in long-running
    /// work that must not start after shutdown.
    /// </summary>
    public bool IsDisposed => Current == NuiLifecycleState.Disposed;

    /// <summary>
    /// Raised after a transition is applied. Handlers run outside the lock, so
    /// one that throws cannot deadlock the machine, and one that re-enters is
    /// safe.
    /// </summary>
    public event Action<NuiLifecycleState, NuiLifecycleState>? StateChanged;

    /// <summary>
    /// Attempts a transition. A no-op when already in <paramref name="target"/>,
    /// which keeps repeated focus calls from spamming the log.
    /// </summary>
    /// <param name="target">Requested state.</param>
    /// <param name="reason">Logged at the debug level to explain the transition.</param>
    /// <returns>True when the state changed or was already <paramref name="target"/>.</returns>
    public bool TryTransition(NuiLifecycleState target, string reason = "")
    {
        NuiLifecycleState previous;

        lock (_gate)
        {
            if (Current == target)
            {
                return true;
            }

            if (!Allowed.TryGetValue(Current, out var permitted) || !permitted.Contains(target))
            {
                _logger.LogWarning(
                    "Refused NUI lifecycle transition {From} -> {To}{Reason}. " +
                    "The reported state would not match what the runtime did.",
                    Current, target, string.IsNullOrEmpty(reason) ? "." : $" ({reason})");
                return false;
            }

            previous = Current;
            Current = target;
        }

        _logger.LogDebug("NUI lifecycle {From} -> {To}{Reason}",
            previous, target, string.IsNullOrEmpty(reason) ? "." : $" ({reason})");

        // Outside the lock: a handler that throws must not strand the machine,
        // and one that re-enters would otherwise deadlock.
        try
        {
            StateChanged?.Invoke(previous, target);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "A NuiLifecycleStateChanged handler threw on {To}", target);
        }

        return true;
    }

    /// <summary>
    /// Marks the page as loaded and ready to receive messages.
    /// </summary>
    public bool MarkReady(string reason = "page signalled ready") =>
        TryTransition(NuiLifecycleState.Ready, reason);

    /// <summary>
    /// Marks the page as loading, e.g., when a client reconnects and the NUI page
    /// is torn down and rebuilt.
    /// </summary>
    public bool MarkLoading(string reason = "page reload") =>
        TryTransition(NuiLifecycleState.Loading, reason);

    /// <summary>
    /// Marks the window as visible, e.g., after successful focus.
    /// </summary>
    public bool MarkVisible(string reason = "window focused") =>
        TryTransition(NuiLifecycleState.Visible, reason);

    /// <summary>
    /// Marks the window as hidden. Accepts both <c>Visible</c> and <c>Ready</c>
    /// as the previous state: focused then released window goes
    /// <c>Visible - Hidden</c>, while unfocusing window that never had
    /// focus leaves it in <c>Ready</c>.
    /// </summary>
    public bool MarkHidden(string reason = "focus released") =>
        TryTransition(NuiLifecycleState.Hidden, reason);

    /// <summary>
    /// Marks the client as disposed. Terminal - returns false once disposed, so
    /// disposing twice is visible rather than silent.
    /// </summary>
    public bool MarkDisposed(string reason = "client disposed")
    {
        lock (_gate)
        {
            if (Current == NuiLifecycleState.Disposed)
            {
                return false;
            }
        }

        return TryTransition(NuiLifecycleState.Disposed, reason);
    }

    /// <summary>
    /// Returns the current state as its name.
    /// </summary>
    /// <returns>The name of the current <see cref="NuiLifecycleState"/>.</returns>
    public override string ToString() => Current.ToString();
}
