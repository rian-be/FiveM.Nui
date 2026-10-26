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
    private readonly INuiLogger _logger = logger ?? NullNuiLogger.Instance;
    private int _current;

    /// <summary>
    /// The current state. Safe to read from any thread.
    /// </summary>
    /// <remarks>
    /// Reads are volatile and transitions use compare-exchange, so observers
    /// always see a complete enum value without taking a lock.
    /// </remarks>
    public NuiLifecycleState Current => (NuiLifecycleState)Volatile.Read(ref _current);

    /// <summary>
    /// True, once the client has been disposed of. Useful as a guard in long-running
    /// work that must not start after shutdown.
    /// </summary>
    public bool IsDisposed => Current == NuiLifecycleState.Disposed;

    /// <summary>
    /// Raised after a transition is applied. Handlers run after the atomic state
    /// update, so one that throws cannot prevent the transition and re-entry is safe.
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
        => TryTransition(target, reason, repeatedResult: true);

    private bool TryTransition(
        NuiLifecycleState target,
        string reason,
        bool repeatedResult)
    {
        NuiLifecycleState previous;

        while (true)
        {
            previous = Current;
            if (previous == target)
            {
                return repeatedResult;
            }

            if (!IsAllowed(previous, target))
            {
                if (_logger.IsEnabled(NuiLogLevel.Warning))
                {
                    _logger.LogWarning(
                        "Refused NUI lifecycle transition {From} -> {To}{Reason}. " +
                        "The reported state would not match what the runtime did.",
                        previous, target, string.IsNullOrEmpty(reason) ? "." : $" ({reason})");
                }
                return false;
            }

            if (Interlocked.CompareExchange(ref _current, (int)target, (int)previous) == (int)previous)
                break;
        }

        if (_logger.IsEnabled(NuiLogLevel.Debug))
        {
            _logger.LogDebug("NUI lifecycle {From} -> {To}{Reason}",
                previous, target, string.IsNullOrEmpty(reason) ? "." : $" ({reason})");
        }

        // After the atomic update: a handler that throws must not strand the
        // machine, and a handler may safely re-enter it.
        foreach (var handler in StateChanged?.GetInvocationList() ?? [])
        {
            try
            {
                ((Action<NuiLifecycleState, NuiLifecycleState>)handler)(previous, target);
            }
            catch (Exception exception)
            {
                if (_logger.IsEnabled(NuiLogLevel.Error))
                    _logger.LogError(exception, "A NuiLifecycleStateChanged handler threw on {To}", target);
            }
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
        => TryTransition(NuiLifecycleState.Disposed, reason, repeatedResult: false);

    /// <summary>
    /// Defines the legal transition graph without dictionary lookups or arrays
    /// on the hot path. Any pair absent from this switch is refused.
    /// </summary>
    private static bool IsAllowed(NuiLifecycleState from, NuiLifecycleState to) => from switch
    {
        NuiLifecycleState.Created => to is NuiLifecycleState.Ready or NuiLifecycleState.Loading or NuiLifecycleState.Disposed,
        NuiLifecycleState.Loading => to is NuiLifecycleState.Ready or NuiLifecycleState.Disposed,
        NuiLifecycleState.Ready => to is NuiLifecycleState.Visible or NuiLifecycleState.Hidden or NuiLifecycleState.Disposed,
        NuiLifecycleState.Visible => to is NuiLifecycleState.Hidden or NuiLifecycleState.Loading or NuiLifecycleState.Disposed,
        NuiLifecycleState.Hidden => to is NuiLifecycleState.Visible or NuiLifecycleState.Ready or NuiLifecycleState.Loading or NuiLifecycleState.Disposed,
        _ => false
    };

    /// <summary>
    /// Returns the current state as its name.
    /// </summary>
    /// <returns>The name of the current <see cref="NuiLifecycleState"/>.</returns>
    public override string ToString() => Current.ToString();
}
