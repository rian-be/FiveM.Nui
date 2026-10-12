using System.Collections.Concurrent;

namespace FiveM.Nui.Diagnostics;

/// <summary>
/// Tracks NUI diagnostic metrics: named counters, accumulated timings, and
/// running payload-size totals.
/// </summary>
/// <remarks>
/// Recording is enabled by <see cref="NuiOptions.EnableDiagnostics"/>. When it is
/// off, the record methods return without touching state, so a disabled build pays
/// only a branch per call; reading methods still work and simply report empty
/// metrics.
/// </remarks>
/// <param name="options">Options carrying the <c>EnableDiagnostics</c> switch.</param>
/// <param name="logger">The logger used by <see cref="LogSnapshot"/>.</param>
public sealed class NuiDiagnostics(NuiOptions options, INuiLogger logger) : INuiDiagnosticsCollector
{
    private readonly ConcurrentDictionary<string, long> _counters = new();
    private readonly ConcurrentDictionary<string, long> _timings = new();
    private long _totalPayloadSize;
    private long _largestPayload;

    /// <summary>
    /// Increments the counter named <paramref name="name"/> by one.
    /// </summary>
    /// <remarks>
    /// This is a no-op when diagnostics are disabled. Counters are created lazily
    /// on the first increment.
    /// </remarks>
    /// <param name="name">The counter-name.</param>
    public void IncrementCounter(string name)
    {
        if (!options.EnableDiagnostics)
        {
            return;
        }

        _counters.AddOrUpdate(name, 1, (_, existing) => existing + 1);
    }

    /// <summary>
    /// Adds <paramref name="milliseconds"/> to the accumulated timing named
    /// <paramref name="name"/>.
    /// </summary>
    /// <remarks>
    /// This is a no-op when diagnostics are disabled. Values accumulate rather
    /// than being sampled, so a caller reading them should treat them as a
    /// running total.
    /// </remarks>
    /// <param name="name">The timing name; created on the first record.</param>
    /// <param name="milliseconds">The duration to add.</param>
    public void RecordTiming(string name, long milliseconds)
    {
        if (!options.EnableDiagnostics)
        {
            return;
        }

        _timings.AddOrUpdate(name, milliseconds, (_, existing) => existing + milliseconds);
    }

    /// <summary>
    /// Records a payload of <paramref name="size"/> bytes, updating both the
    /// running total and the largest-single-payload high-water mark.
    /// </summary>
    /// <remarks>This is a no-op when diagnostics are disabled.</remarks>
    /// <param name="size">The payload size in bytes.</param>
    public void RecordPayload(int size)
    {
        if (!options.EnableDiagnostics)
        {
            return;
        }

        Interlocked.Add(ref _totalPayloadSize, size);
        if (size > Interlocked.Read(ref _largestPayload))
        {
            Interlocked.Exchange(ref _largestPayload, size);
        }
    }

    /// <summary>
    /// Captures the current metrics as a snapshot.
    /// </summary>
    /// <remarks>
    /// Runs even when diagnostics are disabled - the recorded state is then empty
    /// - so callers never need to check the switch before reading.
    /// </remarks>
    /// <returns>A snapshot of the counters, timings, and payload totals at call time.</returns>
    public NuiDiagnosticsSnapshot GetDiagnostics()
    {
        return new NuiDiagnosticsSnapshot
        {
            Counters = new Dictionary<string, long>(_counters),
            Timings = new Dictionary<string, long>(_timings),
            TotalPayloadSize = Interlocked.Read(ref _totalPayloadSize),
            LargestPayload = Interlocked.Read(ref _largestPayload)
        };
    }

    /// <summary>
    /// Logs the current snapshot at the information level.
    /// </summary>
    /// <remarks>This is a no-op when diagnostics are disabled.</remarks>
    public void LogSnapshot()
    {
        if (!options.EnableDiagnostics)
        {
            return;
        }

        var snapshot = GetDiagnostics();
        logger.LogInformation("NUI Diagnostics: {Snapshot}", snapshot);
    }

    /// <summary>
    /// Clears all counters and timings and resets the payload totals to zero.
    /// </summary>
    /// <remarks>
    /// Unlike the record methods, this is not gated by the diagnostics switch: it
    /// is an explicit request to wipe state and is honored regardless.
    /// </remarks>
    public void Reset()
    {
        _counters.Clear();
        _timings.Clear();
        Interlocked.Exchange(ref _totalPayloadSize, 0);
        Interlocked.Exchange(ref _largestPayload, 0);
    }
}
