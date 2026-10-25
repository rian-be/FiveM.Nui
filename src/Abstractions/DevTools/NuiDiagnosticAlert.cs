namespace FiveM.Nui.Abstractions.DevTools;

/// <summary>
/// Represents proactive operational alert triggered when NUI telemetry metrics cross critical performance or safety thresholds.
/// </summary>
/// <remarks>
/// <para>
/// The DevTools diagnostic monitor evaluates rolling metric samples and timeline events against predefined
/// heuristics. When anomalous runtime conditions occur—such as sudden latency spikes, message transmission
/// timeouts, excessive payload sizes, or provider heartbeats lapsing—an alert envelope is generated.
/// </para>
/// <para>
/// Alerts are delivered to the inspector interface via <see cref="NuiDevToolsProtocol.EventAlerts"/>,
/// highlighting degraded resources and providing actionable feedback directly within the NUI overlay.
/// </para>
/// </remarks>
public sealed record NuiDiagnosticAlert(
    string Resource,
    string Severity,
    string Code,
    string Message,
    long Timestamp);
