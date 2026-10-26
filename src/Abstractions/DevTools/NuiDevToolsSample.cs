using FiveM.Nui.Abstractions.Diagnostics;

namespace FiveM.Nui.Abstractions.DevTools;

/// <summary>
/// Diagnostic telemetry sample emitted periodically by an active FiveM.Nui client resource.
/// </summary>
/// <remarks>
/// <para>
/// Aggregates instantaneous throughput, bandwidth, and latency rates alongside cumulative
/// totals and recent operation timeline traces over a discrete sampling window.
/// </para>
/// </remarks>
public sealed record NuiDevToolsSample(
    int Version,
    string Source,
    long Timestamp,
    double MessagesPerSecond,
    double IncomingPerSecond,
    double OutgoingPerSecond,
    double AverageResponseMs,
    double BytesPerSecond,
    long TotalMessages,
    long TotalBytes,
    long LargestPayloadBytes,
    long CompletedRequests,
    long FailedMessages,
    IReadOnlyDictionary<string, long> Counters,
    IReadOnlyDictionary<string, long> Timings,
    IReadOnlyList<NuiDiagnosticOperation>? Operations = null);
