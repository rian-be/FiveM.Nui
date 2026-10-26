using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Alerting.Rules;

/// <summary>Alert rule that flags excessive message rate (throughput) across the NUI event bus.</summary>
/// <param name="thresholdMessagesPerSec">Message rate threshold in messages per second. Defaults to 100.0 msg/s.</param>
public sealed class HighThroughputAlertRule(double thresholdMessagesPerSec = 100.0) : IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule ("HIGH_THROUGHPUT").</summary>
    public string RuleId => "HIGH_THROUGHPUT";

    /// <summary>Evaluates a diagnostic sample for excessive message throughput.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>A warning <see cref="NuiDiagnosticAlert"/> if throughput exceeds the threshold; otherwise, <see langword="null"/>.</returns>
    public NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample)
    {
        if (sample.MessagesPerSecond > thresholdMessagesPerSec)
        {
            return new NuiDiagnosticAlert(
                sample.Source,
                "warning",
                RuleId,
                $"Throughput exceeded {thresholdMessagesPerSec:F0} msg/s ({sample.MessagesPerSecond:F1} msg/s)",
                sample.Timestamp);
        }

        return null;
    }
}
