using FiveM.Nui;
using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Messaging;

/// <summary>
/// Dispatches diagnostic telemetry envelopes and lifecycle notifications to the NUI frontend over the NUI gateway.
/// </summary>
/// <param name="gateway">NUI gateway instance providing asynchronous transport dispatch.</param>
public sealed class DevToolsMessenger(NuiGateway gateway) : IDevToolsMessenger
{
    private readonly NuiGateway _gateway = gateway ?? throw new ArgumentNullException(nameof(gateway));

    /// <summary>Pushes the current visibility and interactive focus state to NUI.</summary>
    /// <param name="visible">Whether the overlay is currently visible.</param>
    /// <param name="interactive">Whether the overlay currently captures mouse and keyboard focus.</param>
    /// <param name="providerCount">Total number of active providers.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushVisibilityAsync(bool visible, bool interactive, int providerCount) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventVisibility, new VisibilityState(
            visible,
            providerCount > 0,
            interactive,
            providerCount));

    /// <summary>Pushes a batch of provider sample snapshots to NUI.</summary>
    /// <param name="snapshots">List of provider samples to deliver.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushSnapshotsAsync(IReadOnlyList<NuiDevToolsSample> snapshots) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventSnapshots, new SnapshotsBatch(
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            snapshots));

    /// <summary>Pushes a single live telemetry sample to NUI.</summary>
    /// <param name="sample">The live diagnostic sample.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushSnapshotAsync(NuiDevToolsSample sample) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventSnapshot, sample);

    /// <summary>Pushes the current resource inventory to NUI.</summary>
    /// <param name="inventory">The resource inventory snapshot.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushResourcesAsync(NuiResourceInventory inventory) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventResources, inventory);

    /// <summary>Pushes a resource lifecycle transition entry to NUI.</summary>
    /// <param name="entry">The lifecycle event record.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushResourceLifecycleAsync(NuiResourceLifecycleEntry entry) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventResourceLifecycle, entry);

    /// <summary>Notifies NUI that a provider was removed.</summary>
    /// <param name="source">Name of the removed provider resource.</param>
    /// <param name="reason">Reason for removal (e.g., "stopped", "timeout").</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushProviderRemovedAsync(string source, string reason) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventProviderRemoved, new ProviderRemoved(source, reason));

    /// <summary>Pushes the active alert list to NUI.</summary>
    /// <param name="alerts">List of diagnostic alerts.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushAlertsAsync(IReadOnlyList<NuiDiagnosticAlert> alerts) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventAlerts, alerts);

    /// <summary>Pushes the current recording session state to NUI.</summary>
    /// <param name="sessionState">The current recording session state record.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushSessionStateAsync(SessionState sessionState) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventSessionState, sessionState);

    /// <summary>Pushes provider health and staleness metrics to NUI.</summary>
    /// <param name="health">Collection of provider health records.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushProviderHealthAsync(IReadOnlyList<ProviderHealth> health) =>
        _gateway.SendAsync(NuiDevToolsProtocol.EventProviderHealth, health);

    /// <summary>Pushes exported recording session data to NUI.</summary>
    /// <param name="export">The exported session package.</param>
    /// <returns>A task representing the asynchronous send operation.</returns>
    public Task PushExportDataAsync(RecordedSessionExport export) =>
        _gateway.SendAsync("devtools:exportData", export);
}
