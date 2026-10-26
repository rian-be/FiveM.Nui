using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Alerting.Rules;

/// <summary>Alert rule that flags excessive network bandwidth consumption over the wire transport.</summary>
/// <param name="thresholdBytesPerSec">Throughput limit in bytes per second before an alert is raised. Defaults to 1,000,000 B/s.</param>
public sealed class BandwidthSpikeAlertRule(long thresholdBytesPerSec = 1_000_000) : IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule ("BANDWIDTH_SPIKE").</summary>
    public string RuleId => "BANDWIDTH_SPIKE";

    /// <summary>Evaluates a diagnostic sample for bandwidth spikes.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>A warning <see cref="NuiDiagnosticAlert"/> if bandwidth exceeds the threshold; otherwise, <see langword="null"/>.</returns>
    public NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample)
    {
        if (sample.BytesPerSecond > thresholdBytesPerSec)
        {
            return new NuiDiagnosticAlert(
                sample.Source,
                "warning",
                RuleId,
                $"Bandwidth spike exceeded 1 MB/s ({(sample.BytesPerSecond / 1_048_576.0):F2} MB/s)",
                sample.Timestamp);
        }

        return null;
    }
}
