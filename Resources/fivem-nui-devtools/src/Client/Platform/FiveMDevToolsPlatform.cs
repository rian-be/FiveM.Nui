using CitizenFX.FiveM.Client;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Platform;

/// <summary>
/// Platform service providing direct access to FiveM client runtime natives and input focus.
/// </summary>
public sealed class FiveMDevToolsPlatform : IDevToolsPlatform
{
    /// <summary>Reads an integer console variable from the runtime environment.</summary>
    /// <param name="name">Name of the console variable.</param>
    /// <param name="fallback">Fallback value to return if the convar does not exist.</param>
    /// <returns>The integer value of the convar, or <paramref name="fallback"/>.</returns>
    public int GetConvarInt(string name, int fallback) =>
        Native.GetConvarInt(name, fallback);

    /// <summary>Checks whether the local client has permission to open or interact with the DevTools overlay.</summary>
    /// <returns><see langword="true"/> if the command ace permission is allowed; otherwise, <see langword="false"/>.</returns>
    public bool HasDevToolsPermission() =>
        Native.IsAceAllowed("command.nui_devtools");

    /// <summary>Gets the current lifecycle state of a FiveM resource.</summary>
    /// <param name="name">Name of the resource to query.</param>
    /// <returns>A string representation of the state (e.g., "started", "stopped", "missing").</returns>
    public string GetResourceState(string name) =>
        Native.GetResourceState(name) ?? "unknown";

    /// <summary>Gets the name of the current running resource hosting the DevTools client.</summary>
    /// <returns>The resource name.</returns>
    public string GetCurrentResourceName() =>
        Native.GetCurrentResourceName() ?? "fivem-nui-devtools";

    /// <summary>Gets the total count of discovered resources on the client.</summary>
    /// <returns>Number of resources.</returns>
    public int GetNumResources() =>
        Native.GetNumResources();

    /// <summary>Finds a resource name by its sequential index.</summary>
    /// <param name="index">Zero-based resource index.</param>
    /// <returns>The resource name, or <see langword="null"/> if not found.</returns>
    public string? GetResourceByFindIndex(int index) =>
        Native.GetResourceByFindIndex(index);

    /// <summary>Retrieves manifest metadata for a resource by key and optional index.</summary>
    /// <param name="resourceName">Name of the resource to query.</param>
    /// <param name="key">Metadata key name.</param>
    /// <param name="index">Zero-based occurrence index for repeated keys.</param>
    /// <returns>The metadata string value, or <see langword="null"/> if not defined.</returns>
    public string? GetResourceMetadata(string resourceName, string key, int index = 0)
    {
        var value = Native.GetResourceMetadata(resourceName, key, index);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }

    /// <summary>Gets the count of metadata entries for a specific key in a resource manifest.</summary>
    /// <param name="resourceName">Name of the resource to query.</param>
    /// <param name="key">Metadata key name.</param>
    /// <returns>The number of metadata entries for the key.</returns>
    public int GetNumResourceMetadata(string resourceName, string key) =>
        Native.GetNumResourceMetadata(resourceName, key);

    /// <summary>Controls whether the NUI overlay has focus and cursor visibility.</summary>
    /// <param name="hasFocus">Whether keyboard focus is directed to NUI.</param>
    /// <param name="hasCursor">Whether mouse cursor is shown and directed to NUI.</param>
    public void SetNuiFocus(bool hasFocus, bool hasCursor) =>
        Native.SetNuiFocus(hasFocus, hasCursor);

    /// <summary>Controls whether game input is retained while NUI focus is active.</summary>
    /// <param name="keepInput">When <see langword="true"/>, game controls remain active alongside NUI.</param>
    public void SetNuiFocusKeepInput(bool keepInput) =>
        Native.SetNuiFocusKeepInput(keepInput);
}
