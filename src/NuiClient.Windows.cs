using FiveM.Nui.Lifecycle;

namespace FiveM.Nui;

// Window management (INuiWindowManager), lifecycle observation
// (INuiLifecycleObserver) and diagnostics (INuiDiagnosticsProvider).
// Split out of NuiClient.cs to keep each file small.
public partial class NuiClient
{
    /// <summary>
    /// Opens <paramref name="windowName"/> and moves the lifecycle into the loading state.
    /// </summary>
    /// <param name="windowName">The window to open.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes once the open envelope has been posted.</returns>
    public async Task OpenAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await _windowManager.OpenAsync(windowName, cancellationToken);

        // Opening a window means the page has to exist, but it is not proof the
        // page finished booting; that is what MarkNuiReady reports.
        _lifecycle.MarkLoading($"'{windowName}' opened");
    }

    /// <summary>
    /// Closes <paramref name="windowName"/> and moves the lifecycle to hidden.
    /// </summary>
    /// <param name="windowName">The window to close.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes once the close envelope has been posted.</returns>
    public async Task CloseAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await _windowManager.CloseAsync(windowName, cancellationToken);

        if (!_lifecycle.IsDisposed && _windowManager.GetFocusedWindow() is null)
        {
            _lifecycle.TryTransition(NuiLifecycleState.Hidden, $"'{windowName}' closed");
        }
    }

    /// <summary>
    /// Focuses <paramref name="windowName"/> and marks the lifecycle visible once it
    /// actually owns the keyboard.
    /// </summary>
    /// <param name="windowName">The window to focus.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes once focus has been attempted.</returns>
    public async Task FocusAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await _windowManager.FocusAsync(windowName, cancellationToken);

        // Focus only succeeded if the window manager now reports it as the
        // keyboard owner; otherwise the machine would claim a visible window
        // that never took focus.
        if (_windowManager.GetFocusedWindow() == windowName)
        {
            _lifecycle.MarkVisible($"'{windowName}' focused");
        }
    }

    /// <summary>
    /// Releases focus from <paramref name="windowName"/> and marks the lifecycle hidden
    /// once focus was actually released.
    /// </summary>
    /// <param name="windowName">The window to unfocus.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    /// <returns>A task that completes once the unfocusing has been attempted.</returns>
    public async Task UnfocusAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ThrowIfDisposed();
        await _windowManager.UnfocusAsync(windowName, cancellationToken);
        if (_windowManager.GetFocusedWindow() is null)
        {
            _lifecycle.MarkHidden($"'{windowName}' unfocused");
        }
    }

    /// <summary>
    /// The window, which currently owns the keyboard, if any.
    /// </summary>
    /// <returns>The focused window name, or <see langword="null"/> when no window holds focus.</returns>
    public string? GetFocusedWindow() => _windowManager.GetFocusedWindow();

    /// <summary>
    /// Reports whether <paramref name="windowName"/> is the current keyboard owner.
    /// </summary>
    /// <param name="windowName">The window to check.</param>
    /// <returns><see langword="true"/> when the window holds NUI focus.</returns>
    public bool HasKeyboardOwnership(string windowName) => _windowManager.HasKeyboardOwnership(windowName);
    
    /// <summary>
    /// The client's current lifecycle state.
    /// </summary>
    public NuiLifecycleState LifecycleState => _lifecycle.Current;

    /// <summary>
    /// Validated lifecycle machine, exposed so a host can observe transitions.
    /// </summary>
    public NuiStateMachine Lifecycle => _lifecycle;

    /// <summary>
    /// Marks the NUI page as fully loaded and ready to receive traffic.
    /// </summary>
    public void MarkNuiReady()
    {
        if (_lifecycle.MarkReady())
        {
            _diagnostics.IncrementCounter("lifecycle_ready");
        }
    }

    /// <summary>
    /// Marks the NUI page as loading: its shell exists, but it is not ready yet.
    /// </summary>
    public void MarkNuiLoading()
    {
        if (_lifecycle.MarkLoading())
        {
            _diagnostics.IncrementCounter("lifecycle_loading");
        }
    }
    
    /// <summary>
    /// The collector behind <see cref="GetDiagnostics"/>.
    /// </summary>
    /// <remarks>
    /// Exposed so a host can record its own counters and timings, log a snapshot
    /// on demand, or clear the metrics explicitly, none of which the read-only
    /// <see cref="GetDiagnostics"/> can do.
    /// </remarks>
    public INuiDiagnosticsCollector Diagnostics => _diagnostics;

    /// <summary>
    /// Captures a point-in-time snapshot of the client's counters, timings, and payload sizes.
    /// </summary>
    /// <returns>The current diagnostics snapshot.</returns>
    public NuiDiagnosticsSnapshot GetDiagnostics()
    {
        return _diagnostics.GetDiagnostics();
    }
}
