using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Alerting.Rules;

/// <summary>Alert rule that flags individual NUI messages exceeding safe payload size limits.</summary>
/// <param name="thresholdBytes">Payload threshold in bytes. Defaults to 64 KB (65,536 bytes).</param>
public sealed class LargePayloadAlertRule(long thresholdBytes = 64 * 1024) : IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule ("LARGE_PAYLOAD").</summary>
    public string RuleId => "LARGE_PAYLOAD";

    /// <summary>Evaluates a diagnostic sample for large individual payloads.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>A warning <see cref="NuiDiagnosticAlert"/> if the largest payload exceeds the threshold; otherwise, <see langword="null"/>.</returns>
    public NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample)
    {
        if (sample.LargestPayloadBytes > thresholdBytes)
        {
            return new NuiDiagnosticAlert(
                sample.Source,
                "warning",
                RuleId,
                $"Single payload exceeded {thresholdBytes / 1024} KB ({sample.LargestPayloadBytes / 1024} KB)",
                sample.Timestamp);
        }

        return null;
    }
}
