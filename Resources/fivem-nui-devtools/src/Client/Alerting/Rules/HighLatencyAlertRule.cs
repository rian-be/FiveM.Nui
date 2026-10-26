using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Alerting.Rules;

/// <summary>Alert rule that flags high average roundtrip response latency for NUI requests.</summary>
/// <param name="thresholdMs">Latency threshold in milliseconds before an alert is raised. Defaults to 50.0 ms.</param>
public sealed class HighLatencyAlertRule(double thresholdMs = 50.0) : IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule ("HIGH_LATENCY").</summary>
    public string RuleId => "HIGH_LATENCY";

    /// <summary>Evaluates a diagnostic sample for high response latency.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>A warning <see cref="NuiDiagnosticAlert"/> if average latency exceeds the threshold; otherwise, <see langword="null"/>.</returns>
    public NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample)
    {
        if (sample.AverageResponseMs > thresholdMs)
        {
            return new NuiDiagnosticAlert(
                sample.Source,
                "warning",
                RuleId,
                $"Average response time exceeded {thresholdMs:F0} ms ({sample.AverageResponseMs:F1} ms)",
                sample.Timestamp);
        }

        return null;
    }
}
