namespace FiveM.Nui.Abstractions.Diagnostics;

/// <summary>
/// Snapshot of NUI diagnostic metrics.
/// </summary>
public sealed class NuiDiagnosticsSnapshot
{
    /// <summary>
    /// Gets the counter values.
    /// </summary>
    public Dictionary<string, long> Counters { get; init; } = new();

    /// <summary>
    /// Gets the timing values.
    /// </summary>
    public Dictionary<string, long> Timings { get; init; } = new();

    /// <summary>
    /// Gets the total payload size in bytes.
    /// </summary>
    public long TotalPayloadSize { get; init; }

    /// <summary>
    /// Gets the largest payload size in bytes.
    /// </summary>
    public long LargestPayload { get; init; }

    /// <summary>
    /// Renders the snapshot as a compact, single-line summary suitable for log output.
    /// </summary>
    /// <returns>
    /// A one-line summary listing the counter, timing and payload counts.
    /// </returns>
    public override string ToString()
    {
        return $"Counters: {Counters.Count}, Timings: {Timings.Count}, TotalPayload: {TotalPayloadSize}, LargestPayload: {LargestPayload}";
    }
}
