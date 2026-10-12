namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Host bindings the library needs from the FiveM client runtime.
/// Implement this in the resource and pass it via <see cref="NuiOptions.Runtime"/>
/// so <c>NuiClient</c> can actually reach NUI.
/// </summary>
public interface INuiRuntime
{
    /// <summary>
    /// Name of the resource serving the NUI page. Used for focus ownership.
    /// </summary>
    string ResourceName { get; }

    /// <summary>
    /// Delivers a JSON envelope to the NUI page.
    /// </summary>
    void SendNuiMessage(string json);

    /// <summary>
    /// Sets or clears NUI focus.
    /// </summary>
    /// <param name="focus">True to take focus, false to release it.</param>
    void SetNuiFocus(bool focus);
}
