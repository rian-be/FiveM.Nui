namespace FiveM.Nui.Abstractions.Windows;

/// <summary>
/// Abstraction for NUI window management.
/// </summary>
public interface INuiWindowManager
{
    /// <summary>
    /// Opens an NUI window.
    /// </summary>
    /// <param name="windowName">Name of the window.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task OpenAsync(string windowName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Closes an NUI window.
    /// </summary>
    /// <param name="windowName">Name of the window.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task CloseAsync(string windowName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Sets focus to an NUI window.
    /// </summary>
    /// <param name="windowName">Name of the window.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task FocusAsync(string windowName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Removes focus from an NUI window.
    /// </summary>
    /// <param name="windowName">Name of the window.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task UnfocusAsync(string windowName, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the currently focused window.
    /// </summary>
    /// <returns>Name of the focused window, or null if none.</returns>
    string? GetFocusedWindow();

    /// <summary>
    /// Checks if a window has keyboard ownership.
    /// </summary>
    /// <param name="windowName">Name of the window.</param>
    /// <returns>True if the window has keyboard ownership.</returns>
    bool HasKeyboardOwnership(string windowName);
}
