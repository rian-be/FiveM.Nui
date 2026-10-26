namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Controls DevTools overlay visibility, mouse cursor, and keyboard input focus.</summary>
public interface IDevToolsOverlay
{
    /// <summary>Gets a value indicating whether the overlay is currently visible.</summary>
    bool IsVisible { get; }

    /// <summary>Gets a value indicating whether the overlay currently captures cursor and keyboard input.</summary>
    bool IsInteractive { get; }

    /// <summary>Shows the overlay, maintaining the previous interaction mode.</summary>
    void Show();

    /// <summary>Hides the overlay and releases any captured focus or cursor.</summary>
    void Hide();

    /// <summary>Toggles overlay visibility.</summary>
    void Toggle();

    /// <summary>Sets whether mouse cursor and keyboard focus are directed to the NUI overlay.</summary>
    /// <param name="enabled">Whether interaction is enabled.</param>
    void SetInteraction(bool enabled);

    /// <summary>Toggles interactive focus mode if the player has authorization.</summary>
    /// <returns><see langword="true"/> if interaction state was updated; <see langword="false"/> if permission was denied.</returns>
    bool ToggleInteraction();
}
