namespace FiveM.Nui.Abstractions.DevTools;

/// <summary>
/// Detailed metadata, capabilities, and runtime execution state of an installed FiveM resource.
/// </summary>
/// <remarks>
/// <para>
/// Resource metadata is discovered dynamically from the FiveM client runtime and resource manifests (<c>fxmanifest.lua</c>).
/// </para>
/// <para>
/// In addition to core attributes, this descriptor flags whether the resource registers a NUI user interface
/// (<see cref="HasNui"/>) and whether it actively publishes FiveM.Nui diagnostic telemetry (<see cref="IsDiagnosticsProvider"/>).
/// </para>
/// </remarks>
public sealed record NuiResourceInfo(
    string Name,
    string State,
    string? Version,
    string? Author,
    string? Description,
    IReadOnlyList<string> Dependencies,
    bool HasNui,
    bool IsDiagnosticsProvider);

/// <summary>
/// Represents an observed resource lifecycle state transition (e.g. started, stopped, restarted).
/// </summary>
/// <remarks>
/// <para>
/// Tracking lifecycle transitions enables the DevTools aggregator to correlate performance anomalies,
/// message timeouts, or connection teardowns with specific resource reloads.
/// </para>
/// </remarks>
public sealed record NuiResourceLifecycleEntry(
    long Timestamp,
    string Resource,
    string State);

/// <summary>
/// Comprehensive inventory snapshot containing all discovered FiveM resources and recent lifecycle history.
/// </summary>
/// <remarks>
/// <para>
/// Dispatched to the DevTools frontend via <see cref="NuiDevToolsProtocol.EventResources"/> during initial
/// synchronization and following resource state changes.
/// </para>
/// <para>
/// Enables the DevTools dashboard to display resource capabilities, monitor provider availability,
/// and contextualize telemetry graphs with resource start and stop events.
/// </para>
/// </remarks>
public sealed record NuiResourceInventory(
    long Timestamp,
    IReadOnlyList<NuiResourceInfo> Resources,
    IReadOnlyList<NuiResourceLifecycleEntry> Lifecycle);
