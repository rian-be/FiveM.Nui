namespace FiveM.Nui.Windows;

/// <summary>
/// Manages NUI window lifecycle and focus.
/// </summary>
public sealed class NuiWindowManager(INuiLogger logger, INuiRuntime runtime, INuiSerializer serializer)
    : INuiWindowManager
{
    private readonly Lock _gate = new();
    private readonly Dictionary<string, NuiWindowState> _windows = [];
    private string? _focusedWindow;

    /// <summary>
    /// Opens the named window and takes NUI focus for it.
    /// </summary>
    /// <remarks>
    /// The <c>open</c> envelope is posted before focus is set, so the page can begin
    /// loading and drop its closed class before the cursor appears, avoiding a flash
    /// of the game behind the panel.
    /// </remarks>
    /// <param name="windowName">The window to open; created on first use.</param>
    /// <param name="cancellationToken">Cancellation token; the operation is synchronous.</param>
    /// <returns>A completed task.</returns>
    public Task OpenAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ValidateWindowName(windowName);
        if (cancellationToken.IsCancellationRequested)
            return Task.FromCanceled(cancellationToken);

        lock (_gate)
        {
            if (!_windows.TryGetValue(windowName, out var state))
            {
                state = new NuiWindowState { Name = windowName };
                _windows.Add(windowName, state);
            }

            Post(windowName, "open");
            state.IsOpen = true;

            runtime.SetNuiFocus(true);
            ClearPreviousFocus(windowName);
            _focusedWindow = windowName;
            state.HasFocus = true;

            logger.LogInformation("Opened window: {Window} (focused={Focused})",
                windowName, _focusedWindow);
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Closes the named window and releases focus if it owned it.
    /// </summary>
    /// <remarks>
    /// Closing an unknown window is logged as a warning rather than throwing, so a
    /// mis-timed close after a reload cannot break the caller.
    /// </remarks>
    /// <param name="windowName">The window to close.</param>
    /// <param name="cancellationToken">Cancellation token; the operation is synchronous.</param>
    /// <returns>A completed task.</returns>
    public Task CloseAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ValidateWindowName(windowName);
        if (cancellationToken.IsCancellationRequested)
            return Task.FromCanceled(cancellationToken);

        lock (_gate)
        {
            if (!_windows.TryGetValue(windowName, out var state))
            {
                logger.LogWarning("Close requested for unknown window: {Window}", windowName);
                return Task.CompletedTask;
            }

            Post(windowName, "close");

            if (_focusedWindow == windowName)
            {
                runtime.SetNuiFocus(false);
                _focusedWindow = null;
            }

            state.IsOpen = false;
            state.HasFocus = false;
            logger.LogInformation("Closed window: {Window}", windowName);
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Focuses an already-open window, posting the <c>focus</c> envelope before
    /// taking NUI focus.
    /// </summary>
    /// <remarks>
    /// Focusing on a window that is not open is refused and logged: claiming focus for
    /// a window that is not on screen would desynchronize the host and the page.
    /// </remarks>
    /// <param name="windowName">The window to focus; must already be open.</param>
    /// <param name="cancellationToken">Cancellation token; the operation is synchronous.</param>
    /// <returns>A completed task.</returns>
    public Task FocusAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ValidateWindowName(windowName);
        if (cancellationToken.IsCancellationRequested)
            return Task.FromCanceled(cancellationToken);

        lock (_gate)
        {
            if (_windows.TryGetValue(windowName, out var state) && state.IsOpen)
            {
                Post(windowName, "focus");
                runtime.SetNuiFocus(true);

                ClearPreviousFocus(windowName);
                _focusedWindow = windowName;
                state.HasFocus = true;

                logger.LogInformation("Focused window: {Window}", windowName);
            }
            else
            {
                logger.LogWarning("Cannot focus '{Window}': not open", windowName);
            }
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Releases focus from the named window and posts the <c>unfocus</c> envelope.
    /// </summary>
    /// <remarks>
    /// NUI focus is only released when the named window actually held it, so
    /// unfocusing a background window cannot steal focus from the visible one.
    /// </remarks>
    /// <param name="windowName">The window to unfocus.</param>
    /// <param name="cancellationToken">Cancellation token; the operation is synchronous.</param>
    /// <returns>A completed task.</returns>
    public Task UnfocusAsync(string windowName, CancellationToken cancellationToken = default)
    {
        ValidateWindowName(windowName);
        if (cancellationToken.IsCancellationRequested)
            return Task.FromCanceled(cancellationToken);

        lock (_gate)
        {
            if (!_windows.TryGetValue(windowName, out var state))
            {
                logger.LogWarning("Unfocus requested for unknown window: {Window}", windowName);
                return Task.CompletedTask;
            }

            Post(windowName, "unfocus");

            if (_focusedWindow == windowName)
            {
                runtime.SetNuiFocus(false);
                _focusedWindow = null;
            }

            state.HasFocus = false;
            logger.LogInformation("Unfocused window: {Window}", windowName);
        }

        return Task.CompletedTask;
    }

    /// <summary>
    /// Sends a lifecycle envelope to the UI. Kept separate from payload
    /// messages so the frontend can treat <c>open</c>/<c>close</c> as a window
    /// state rather than as a domain event.
    /// </summary>
    private void Post(string windowName, string type)
    {
        try
        {
            runtime.SendNuiMessage(serializer.Serialize(new NuiMessage
            {
                Type = type,
                Event = windowName,
            }));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to post '{Type}' for window {Window}", type, windowName);
            throw;
        }
    }

    private void ClearPreviousFocus(string nextWindow)
    {
        if (_focusedWindow is not null &&
            _focusedWindow != nextWindow &&
            _windows.TryGetValue(_focusedWindow, out var previous))
        {
            previous.HasFocus = false;
        }
    }

    private static void ValidateWindowName(string windowName)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(windowName);
    }

    /// <summary>
    /// Gets the currently focused window.
    /// </summary>
    public string? GetFocusedWindow()
    {
        lock (_gate)
            return _focusedWindow;
    }

    /// <summary>
    /// Checks if a window has keyboard ownership.
    /// </summary>
    public bool HasKeyboardOwnership(string windowName)
    {
        ValidateWindowName(windowName);
        lock (_gate)
            return _focusedWindow == windowName;
    }
}

