using CitizenFX.FiveM.Client;
using CitizenFX.FiveM.Shared;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Commands;

/// <summary>
/// Registers and coordinates DevTools console commands with authorization checks and session recording controls.
/// </summary>
/// <param name="platform">Platform abstraction providing permission checks and command dispatch.</param>
/// <param name="overlay">DevTools overlay service controlling visibility and interaction.</param>
/// <param name="recorder">Session recorder service managing frame capture buffers.</param>
/// <param name="onSessionStateChanged">Callback invoked when session recording state changes.</param>
public sealed class DevToolsCommandHandler(
    IDevToolsPlatform platform,
    IDevToolsOverlay overlay,
    ISessionRecorder recorder,
    Action onSessionStateChanged) : IDevToolsCommandHandler
{
    private readonly IDevToolsPlatform _platform = platform ?? throw new ArgumentNullException(nameof(platform));
    private readonly IDevToolsOverlay _overlay = overlay ?? throw new ArgumentNullException(nameof(overlay));
    private readonly ISessionRecorder _recorder = recorder ?? throw new ArgumentNullException(nameof(recorder));
    private readonly Action _onSessionStateChanged = onSessionStateChanged ?? throw new ArgumentNullException(nameof(onSessionStateChanged));
    
    public void RegisterCommands()
    {
        API.Commands.RegisterCommand("nui_devtools", false, new Action(ToggleOverlay));
        API.Commands.RegisterCommand("fivem_nui_devtools", false, new Action(ToggleOverlay));
        API.Commands.RegisterCommand("nui_devtools_focus", false, new Action(ToggleFocus));
        API.Commands.RegisterCommand("nui_devtools_record", false, new Action(StartRecording));
        API.Commands.RegisterCommand("nui_devtools_stop", false, new Action(StopRecording));
        API.Commands.RegisterCommand("nui_devtools_clear", false, new Action(ClearRecording));
    }

    private void ToggleOverlay() =>
        _overlay.Toggle();

    private void ToggleFocus() =>
        _overlay.ToggleInteraction();

    private void StartRecording()
    {
        if (!_platform.HasDevToolsPermission())
        {
            SharedAPI.Log.Warn("[fivem-nui-devtools] Access denied to /nui_devtools_record.");
            return;
        }

        _recorder.Start();
        _onSessionStateChanged();
        SharedAPI.Log.Info("[fivem-nui-devtools] Recording session started.");
    }

    private void StopRecording()
    {
        var count = _recorder.Stop();
        _onSessionStateChanged();
        SharedAPI.Log.Info($"[fivem-nui-devtools] Recording stopped. Captured {count} frames.");
    }

    private void ClearRecording()
    {
        _recorder.Clear();
        _onSessionStateChanged();
        SharedAPI.Log.Info("[fivem-nui-devtools] Recording buffer cleared.");
    }
}
