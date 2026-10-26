using FiveM.Nui.Abstractions.DevTools;

namespace FiveM.Nui.DevTools.Client.Models;

/// <summary>Represents the current presentation and interaction state of the DevTools overlay.</summary>
/// <param name="Visible">Whether the overlay is currently visible on screen.</param>
/// <param name="Connected">Whether at least one diagnostics provider is actively sending telemetry.</param>
/// <param name="Interactive">Whether mouse cursor and keyboard focus are captured by NUI.</param>
/// <param name="ProviderCount">Total count of currently tracked diagnostic providers.</param>
public sealed record VisibilityState(bool Visible, bool Connected, bool Interactive, int ProviderCount);

/// <summary>Wire envelope payload dispatched when a diagnostics provider is removed or pruned.</summary>
/// <param name="Source">Name of the resource provider that was removed.</param>
/// <param name="Reason">Reason why the provider was removed (e.g., "stopped", "timeout").</param>
public sealed record ProviderRemoved(string Source, string Reason);

/// <summary>Diagnostic health summary for a single telemetry provider.</summary>
/// <param name="Source">Name of the provider resource.</param>
/// <param name="AgeMs">Elapsed milliseconds since the most recent telemetry sample was received.</param>
/// <param name="Stale">Whether the provider has exceeded the staleness threshold.</param>
public sealed record ProviderHealth(string Source, long AgeMs, bool Stale);

/// <summary>Batch envelope delivering current telemetry snapshots from all active providers.</summary>
/// <param name="Timestamp">Unix millisecond timestamp when the batch was created.</param>
/// <param name="Providers">List of provider sample snapshots.</param>
public sealed record SnapshotsBatch(long Timestamp, IReadOnlyList<NuiDevToolsSample> Providers);

/// <summary>Current state of a diagnostic telemetry recording session.</summary>
/// <param name="IsRecording">Whether recording is currently in progress.</param>
/// <param name="FrameCount">Number of frames captured in the current recording buffer.</param>
/// <param name="DurationMs">Elapsed recording duration in milliseconds.</param>
public sealed record SessionState(bool IsRecording, int FrameCount, long DurationMs);

/// <summary>A discrete captured timeline frame in a recorded session.</summary>
/// <param name="Timestamp">Unix millisecond timestamp of the captured frame.</param>
/// <param name="Snapshots">Collection of provider samples recorded in this frame.</param>
public sealed record RecordedDiagnosticsFrame(long Timestamp, IReadOnlyList<NuiDevToolsSample> Snapshots);

/// <summary>Empty NUI callback request payload.</summary>
public sealed record EmptyRequest();

/// <summary>Response emitted following a toggle-record NUI callback.</summary>
/// <param name="IsRecording">The new recording state after toggling.</param>
public sealed record ToggleRecordResponse(bool IsRecording);

/// <summary>Exportable data structure representing a completed diagnostic recording session.</summary>
/// <param name="StartedAt">Unix millisecond timestamp when recording began.</param>
/// <param name="EndedAt">Unix millisecond timestamp when export occurred.</param>
/// <param name="FrameCount">Total count of frames included in this export.</param>
/// <param name="Frames">List of recorded diagnostics frames.</param>
public sealed record RecordedSessionExport(
    long StartedAt,
    long EndedAt,
    int FrameCount,
    IReadOnlyList<RecordedDiagnosticsFrame> Frames);
