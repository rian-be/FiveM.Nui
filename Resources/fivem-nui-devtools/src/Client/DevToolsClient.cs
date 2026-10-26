using CitizenFX.FiveM.Shared;
using CitizenFX.FiveM.Shared.Script;
using FiveM.Nui;
using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;
using FiveM.Nui.DevTools.Client.Alerting;
using FiveM.Nui.DevTools.Client.Commands;
using FiveM.Nui.DevTools.Client.Messaging;
using FiveM.Nui.DevTools.Client.Overlay;
using FiveM.Nui.DevTools.Client.Platform;
using FiveM.Nui.DevTools.Client.Providers;
using FiveM.Nui.DevTools.Client.Recording;
using FiveM.Nui.DevTools.Client.Resources;
using FiveM.Nui.Transport;

namespace FiveM.Nui.DevTools.Client;

/// <summary>
/// Entry point coordinating the DevTools client overlay, diagnostic telemetry ingestion, and in-game commands.
/// </summary>
public sealed class DevToolsClient : IScript
{
    private readonly NuiGateway _gateway;
    private readonly IDevToolsPlatform _platform;
    private readonly IProviderManager _providers;
    private readonly IResourceInspector _resources;
    private readonly IAlertEngine _alerts;
    private readonly ISessionRecorder _recorder;
    private readonly IDevToolsMessenger _messenger;
    private readonly IDevToolsOverlay _overlay;
    private readonly IDevToolsCommandHandler _commands;

    /// <summary>
    /// Initializes a new instance of the <see cref="DevToolsClient"/> class with default production platform and gateway bindings.
    /// </summary>
    public DevToolsClient() : this(
        new FiveMDevToolsPlatform(),
        new NuiGateway("fivem-nui-devtools", new NuiOptions
        {
            DefaultTimeout = TimeSpan.FromSeconds(5),
            MaxPayloadSize = 256 * 1024,
            EnableDiagnostics = false,
            EnableDebugLogging = false,
            Runtime = new FiveMNuiRuntime()
        }))
    {
    }

    /// <summary>
    /// Initializes a new instance of the <see cref="DevToolsClient"/> class with custom or mock collaborator dependencies.
    /// </summary>
    /// <param name="platform">Platform abstraction for runtime convar and native bindings.</param>
    /// <param name="gateway">NUI gateway used for UI event delivery and callback routing.</param>
    /// <param name="providers">Optional provider manager instance.</param>
    /// <param name="resources">Optional resource inspector instance.</param>
    /// <param name="alerts">Optional alert engine instance.</param>
    /// <param name="recorder">Optional session recorder instance.</param>
    /// <param name="messenger">Optional NUI messenger instance.</param>
    /// <param name="overlay">Optional overlay controller instance.</param>
    /// <param name="commands">Optional command handler instance.</param>
    public DevToolsClient(
        IDevToolsPlatform platform,
        NuiGateway gateway,
        IProviderManager? providers = null,
        IResourceInspector? resources = null,
        IAlertEngine? alerts = null,
        ISessionRecorder? recorder = null,
        IDevToolsMessenger? messenger = null,
        IDevToolsOverlay? overlay = null,
        IDevToolsCommandHandler? commands = null)
    {
        _platform = platform ?? throw new ArgumentNullException(nameof(platform));
        _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));
        _providers = providers ?? new ProviderManager(_platform);
        _resources = resources ?? new ResourceInspector(_platform);
        _alerts = alerts ?? new AlertEngine();
        _recorder = recorder ?? new SessionRecorder();
        _messenger = messenger ?? new DevToolsMessenger(_gateway);
        _overlay = overlay ?? new DevToolsOverlay(_platform, OnOverlayStateChanged);
        _commands = commands ?? new DevToolsCommandHandler(
            _platform,
            _overlay,
            _recorder,
            () => NuiGateway.Run(PushSessionStateAsync));
    }

    /// <summary>
    /// Bootstraps the DevTools client subsystem: registers NUI callbacks, event listeners, console commands, and periodic maintenance timers.
    /// </summary>
    public void Initialize()
    {
        _gateway.Bootstrap(onReady: OnNuiReadyAsync, onClose: OnNuiCloseAsync);
        RegisterNuiCallbacks();
        RegisterEventHandlers();
        _commands.RegisterCommands();
        _resources.DiscoverInitial();

        var refreshInterval = _platform.GetConvarInt(
            NuiDevToolsProtocol.ConVarRefreshMs,
            NuiDevToolsProtocol.DefaultRefreshIntervalMs);

        CitizenFX.FiveM.Client.API.SetInterval(MaintainState, refreshInterval);
        SharedAPI.Log.Info("[fivem-nui-devtools] Ready. Use /nui_devtools to toggle overlay.");
    }

    // ------------------------------------------------------------------
    // Event & NUI Callback Registrations
    // ------------------------------------------------------------------

    private void RegisterEventHandlers()
    {
        CitizenFX.FiveM.Client.API.OnEvent(NuiDevToolsProtocol.DiagnosticsEvent, new Action<string>(OnDiagnostics), false);
        CitizenFX.FiveM.Client.API.OnEvent("onClientResourceStart", new Action<string>(OnResourceStarted), false);
        CitizenFX.FiveM.Client.API.OnEvent("onResourceStart", new Action<string>(OnResourceStarted), false);
        CitizenFX.FiveM.Client.API.OnEvent("onClientResourceStop", new Action<string>(OnResourceStopped), false);
        CitizenFX.FiveM.Client.API.OnEvent("onResourceStop", new Action<string>(OnResourceStopped), false);
    }

    private void RegisterNuiCallbacks()
    {
        NuiGateway.RegisterCallbackAsync("devtools:toggleRecord", _ =>
        {
            if (_recorder.IsRecording)
            {
                _recorder.Stop();
            }
            else
            {
                _recorder.Start();
            }

            NuiGateway.Run(PushSessionStateAsync);
            return Task.CompletedTask;
        });

        NuiGateway.RegisterCallbackAsync("devtools:exportSession", async _ =>
        {
            var export = _recorder.Export(_providers.GetSnapshots());
            SharedAPI.Log.Info($"[fivem-nui-devtools] Exporting session: {export.FrameCount} frame(s).");
            await _messenger.PushExportDataAsync(export);
        });
    }

    // ------------------------------------------------------------------
    // Ingestion & Lifecycle Handlers
    // ------------------------------------------------------------------

    private void OnDiagnostics(string json)
    {
        if (!_providers.Ingest(json, out var sample) || sample is null)
        {
            return;
        }

        _alerts.Evaluate(sample);

        if (_recorder.IsRecording)
        {
            _recorder.RecordFrame(sample);
        }

        if (_overlay.IsVisible)
        {
            NuiGateway.Run(async () =>
            {
                await _messenger.PushSnapshotAsync(sample);
                await _messenger.PushAlertsAsync(_alerts.GetAlerts());
            });
        }
    }

    private void OnResourceStarted(string resourceName)
    {
        var entry = _resources.RecordLifecycle(resourceName, "started");
        if (entry is not null && _overlay.IsVisible)
        {
            NuiGateway.Run(() => _messenger.PushResourceLifecycleAsync(entry));
        }
    }

    private void OnResourceStopped(string resourceName)
    {
        var entry = _resources.RecordLifecycle(resourceName, "stopped");

        // Clean up focus when DevTools itself is stopped
        var currentResource = _platform.GetCurrentResourceName();
        if (string.Equals(resourceName, currentResource, StringComparison.OrdinalIgnoreCase))
        {
            _overlay.Hide();
            return;
        }

        var removed = _providers.Remove(resourceName);
        _resources.InvalidateMetadata(resourceName);

        if (_overlay.IsVisible)
        {
            NuiGateway.Run(async () =>
            {
                if (entry is not null)
                {
                    await _messenger.PushResourceLifecycleAsync(entry);
                }

                if (removed)
                {
                    await _messenger.PushProviderRemovedAsync(resourceName, "stopped");
                    await PushVisibilityAsync();
                    await PushProviderHealthAsync();
                }

                await PushResourcesAsync();
            });
        }
    }

    private void MaintainState()
    {
        var timeoutMs = _platform.GetConvarInt(
            NuiDevToolsProtocol.ConVarProviderTimeoutMs,
            NuiDevToolsProtocol.DefaultProviderTimeoutMs);

        var staleThresholdMs = _platform.GetConvarInt(
            NuiDevToolsProtocol.ConVarProviderStaleMs,
            NuiDevToolsProtocol.DefaultProviderStaleMs);

        var removedProviders = _providers.PruneExpired(timeoutMs);
        foreach (var source in removedProviders)
        {
            _resources.InvalidateMetadata(source);
            _resources.RecordLifecycle(source, "timeout");
        }

        _providers.EvaluateStale(staleThresholdMs, _alerts.AddAlert);

        if (!_overlay.IsVisible) return;

        NuiGateway.Run(async () =>
        {
            foreach (var source in removedProviders)
            {
                await _messenger.PushProviderRemovedAsync(source, "timeout");
            }

            if (removedProviders.Count > 0)
            {
                await PushVisibilityAsync();
            }

            await PushProviderHealthAsync();
            await PushResourcesAsync();
            await _messenger.PushAlertsAsync(_alerts.GetAlerts());

            if (_recorder.IsRecording)
            {
                await PushSessionStateAsync();
            }
        });
    }

    // ------------------------------------------------------------------
    // Overlay Coordination & NUI Sync
    // ------------------------------------------------------------------

    private void OnOverlayStateChanged(bool visible, bool interactive)
    {
        SharedAPI.Log.Info($"[fivem-nui-devtools] Overlay {(visible ? "shown" : "hidden")}; providers={_providers.ProviderCount}.");
        NuiGateway.Run(async () =>
        {
            await PushVisibilityAsync();
            if (visible)
            {
                await PushAllAsync();
            }
        });
    }

    private async Task OnNuiReadyAsync()
    {
        await PushVisibilityAsync();
        if (_overlay.IsVisible)
        {
            await PushAllAsync();
        }
    }

    private Task OnNuiCloseAsync()
    {
        _overlay.Hide();
        return Task.CompletedTask;
    }

    private async Task PushAllAsync()
    {
        await _messenger.PushSnapshotsAsync(_providers.GetSnapshots());
        await PushResourcesAsync();
        await _messenger.PushAlertsAsync(_alerts.GetAlerts());
        await PushSessionStateAsync();
        await PushProviderHealthAsync();
    }

    private Task PushVisibilityAsync() =>
        _messenger.PushVisibilityAsync(_overlay.IsVisible, _overlay.IsInteractive, _providers.ProviderCount);

    private Task PushResourcesAsync() =>
        _messenger.PushResourcesAsync(_resources.ScanResources(_providers.HasProvider));

    private Task PushSessionStateAsync() =>
        _messenger.PushSessionStateAsync(_recorder.GetSessionState());

    private Task PushProviderHealthAsync()
    {
        var staleThresholdMs = _platform.GetConvarInt(
            NuiDevToolsProtocol.ConVarProviderStaleMs,
            NuiDevToolsProtocol.DefaultProviderStaleMs);

        return _messenger.PushProviderHealthAsync(_providers.GetProviderHealth(staleThresholdMs));
    }
}
