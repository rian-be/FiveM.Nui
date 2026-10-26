namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Registers and coordinates DevTools console commands with the FiveM runtime.</summary>
public interface IDevToolsCommandHandler
{
    /// <summary>Registers all DevTools console commands with the FiveM command system.</summary>
    void RegisterCommands();
}
