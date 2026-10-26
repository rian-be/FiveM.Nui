using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Models;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Dispatches diagnostic state and telemetry events to the NUI frontend.</summary>
public interface IDevToolsMessenger
{
    /// <summary>Pushes the current visibility and interactive focus state to NUI.</summary>
    /// <param name="visible">Whether the overlay is currently visible.</param>
    /// <param name="interactive">Whether the overlay currently captures mouse and keyboard focus.</param>
    /// <param name="providerCount">Total number of active providers.</param>
    Task PushVisibilityAsync(bool visible, bool interactive, int providerCount);

    /// <summary>Pushes a batch of provider sample snapshots to NUI.</summary>
    /// <param name="snapshots">List of provider samples to deliver.</param>
    Task PushSnapshotsAsync(IReadOnlyList<NuiDevToolsSample> snapshots);

    /// <summary>Pushes a single live telemetry sample to NUI.</summary>
    /// <param name="sample">The live diagnostic sample.</param>
    Task PushSnapshotAsync(NuiDevToolsSample sample);

    /// <summary>Pushes the current resource inventory to NUI.</summary>
    /// <param name="inventory">The resource inventory snapshot.</param>
    Task PushResourcesAsync(NuiResourceInventory inventory);

    /// <summary>Pushes a resource lifecycle transition entry to NUI.</summary>
    /// <param name="entry">The lifecycle event record.</param>
    Task PushResourceLifecycleAsync(NuiResourceLifecycleEntry entry);

    /// <summary>Notifies NUI that a provider was removed.</summary>
    /// <param name="source">Name of the removed provider resource.</param>
    /// <param name="reason">Reason for removal (e.g., "stopped", "timeout").</param>
    Task PushProviderRemovedAsync(string source, string reason);

    /// <summary>Pushes the active alert list to NUI.</summary>
    /// <param name="alerts">List of diagnostic alerts.</param>
    Task PushAlertsAsync(IReadOnlyList<NuiDiagnosticAlert> alerts);

    /// <summary>Pushes the current recording session state to NUI.</summary>
    /// <param name="sessionState">The current recording session state record.</param>
    Task PushSessionStateAsync(SessionState sessionState);

    /// <summary>Pushes provider health and staleness metrics to NUI.</summary>
    /// <param name="health">Collection of provider health records.</param>
    Task PushProviderHealthAsync(IReadOnlyList<ProviderHealth> health);

    /// <summary>Pushes exported recording session data to NUI.</summary>
    /// <param name="export">The exported session package.</param>
    Task PushExportDataAsync(RecordedSessionExport export);
}
