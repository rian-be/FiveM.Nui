namespace FiveM.Nui.Abstractions.Lifecycle;

/// <summary>
/// Represents the lifecycle state of NUI.
/// </summary>
public enum NuiLifecycleState
{
    /// <summary>
    /// NUI client has been created but not initialized.
    /// </summary>
    Created,

    /// <summary>
    /// NUI is loading resources.
    /// </summary>
    Loading,

    /// <summary>
    /// NUI is ready to receive messages.
    /// </summary>
    Ready,

    /// <summary>
    /// NUI window is visible.
    /// </summary>
    Visible,

    /// <summary>
    /// NUI window is hidden but still loaded.
    /// </summary>
    Hidden,

    /// <summary>
    /// NUI client has been disposed.
    /// </summary>
    Disposed
}
