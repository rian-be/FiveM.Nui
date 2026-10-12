using CitizenFX.FiveM.Client;

namespace FiveM.Nui.Transport;

/// <summary>
/// <see cref="INuiRuntime"/> bound to the FiveM client natives.
/// </summary>
/// <remarks>
/// <para>
/// This is the only place in the library that calls <c>Native.SendNuiMessage</c>
/// and <c>Native.SetNuiFocus</c>. A resource passes one of these to
/// <c>NuiOptions.Runtime</c> and never touches a NUI native itself.
/// </para>
/// <para>
/// The resource name is read from the runtime rather than hardcoded, so the same
/// adapter works for every resource - a value hardcoded in a template silently
/// breaks the moment someone renames the folder.
/// </para>
/// </remarks>
public sealed class FiveMNuiRuntime(string resourceName) : INuiRuntime
{
    /// <summary>Uses the running resource, resolved from the runtime.</summary>
    public FiveMNuiRuntime()
        : this(CurrentResourceName())
    {
    }

    /// <summary>
    /// The resource this runtime is bound to, used to address the NUI surface.
    /// </summary>
    /// <remarks>
    /// Resolved from the running resource unless an explicit name was supplied, so
    /// the adapter keeps working after the resource folder is renamed.
    /// </remarks>
    public string ResourceName { get; } = string.IsNullOrWhiteSpace(resourceName)
        ? CurrentResourceName()
        : resourceName;

    /// <summary>
    /// Posts a raw NUI envelope to the client page through <c>SendNuiMessage</c>.
    /// </summary>
    /// <param name="json">The serialized envelope to deliver to the page.</param>
    public void SendNuiMessage(string json) => Native.SendNuiMessage(json);

    /// <summary>
    /// The second argument of <c>SetNuiFocus</c> is cursorVisible, not a gameplay
    /// flag. It follows the focus: a focused UI needs the cursor, and an unfocused
    /// one must hide it, otherwise the arrow keeps floating over the game.
    /// </summary>
    /// <remarks>
    /// <c>KeepInput</c> must stay off while NUI owns the cursor: with it on, game
    /// input keeps running and the pointer never hands over to the page.
    /// </remarks>
    public void SetNuiFocus(bool focus)
    {
        Native.SetNuiFocus(focus, focus);
        Native.SetNuiFocusKeepInput(false);
    }

    private static string CurrentResourceName()
    {
        try
        {
            return Native.GetCurrentResourceName();
        }
        catch (Exception)
        {
            // Outside resource (unit tests, tooling) there is nothing to resolve.
            return "unknown_resource";
        }
    }
}
