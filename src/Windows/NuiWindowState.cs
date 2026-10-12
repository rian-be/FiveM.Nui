namespace FiveM.Nui.Windows;

/// <summary>
/// Represents the state of an NUI window.
/// </summary>
internal sealed class NuiWindowState
{
    public string Name { get; init; } = string.Empty;
    public bool IsOpen { get; set; }
    public bool HasFocus { get; set; }
}
