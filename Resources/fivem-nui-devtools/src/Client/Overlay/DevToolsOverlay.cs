using CitizenFX.FiveM.Shared;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Overlay;

/// <summary>
/// Controls presentation visibility, mouse cursor, and keyboard input focus of the DevTools overlay.
/// </summary>
/// <param name="platform">Platform abstraction providing runtime convar, permission, and focus natives.</param>
/// <param name="onStateChanged">Optional callback invoked whenever visibility or interaction state changes.</param>
public sealed class DevToolsOverlay(IDevToolsPlatform platform, Action<bool, bool>? onStateChanged = null) : IDevToolsOverlay
{
    private readonly IDevToolsPlatform _platform = platform ?? throw new ArgumentNullException(nameof(platform));
    private readonly Action<bool, bool>? _onStateChanged = onStateChanged;

    private bool _visible;
    private bool _interactive;

    /// <summary>Gets a value indicating whether the overlay is currently visible.</summary>
    public bool IsVisible => _visible;

    /// <summary>Gets a value indicating whether the overlay currently captures cursor and keyboard input.</summary>
    public bool IsInteractive => _interactive;

    /// <summary>Shows the overlay, maintaining the previous interaction mode.</summary>
    public void Show()
    {
        _visible = true;
        _onStateChanged?.Invoke(_visible, _interactive);
    }

    /// <summary>Hides the overlay and releases any captured focus or cursor.</summary>
    public void Hide()
    {
        _visible = false;
        SetInteraction(false);
        _onStateChanged?.Invoke(_visible, _interactive);
    }

    /// <summary>Toggles overlay visibility.</summary>
    public void Toggle()
    {
        _visible = !_visible;
        if (!_visible)
        {
            SetInteraction(false);
        }

        _onStateChanged?.Invoke(_visible, _interactive);
    }

    /// <summary>Sets whether mouse cursor and keyboard focus are directed to the NUI overlay.</summary>
    /// <param name="enabled">Whether interaction is enabled.</param>
    public void SetInteraction(bool enabled)
    {
        _interactive = enabled;
        _platform.SetNuiFocus(enabled, enabled);
        _platform.SetNuiFocusKeepInput(false);
    }

    /// <summary>Toggles interactive focus mode if the player has authorization.</summary>
    /// <returns><see langword="true"/> if interaction state was updated; <see langword="false"/> if permission was denied.</returns>
    public bool ToggleInteraction()
    {
        if (!_platform.HasDevToolsPermission())
        {
            SharedAPI.Log.Warn("[fivem-nui-devtools] Access denied to /nui_devtools_focus.");
            return false;
        }

        _visible = true;
        SetInteraction(!_interactive);
        _onStateChanged?.Invoke(_visible, _interactive);
        return true;
    }
}
