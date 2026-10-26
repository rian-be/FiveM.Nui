using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;

namespace FiveM.Nui.DevTools.Client.Alerting.Rules;

/// <summary>Alert rule that flags elevated counts of failed NUI messages or unhandled RPC requests.</summary>
/// <param name="failureThreshold">Minimum cumulative failed message count before triggering an alert. Defaults to 5.</param>
public sealed class FailuresDetectedAlertRule(long failureThreshold = 5) : IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule ("FAILURES_DETECTED").</summary>
    public string RuleId => "FAILURES_DETECTED";

    /// <summary>Evaluates a diagnostic sample for elevated failure counts.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>An error <see cref="NuiDiagnosticAlert"/> if failed messages reach the threshold; otherwise, <see langword="null"/>.</returns>
    public NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample)
    {
        if (sample.FailedMessages >= failureThreshold)
        {
            return new NuiDiagnosticAlert(
                sample.Source,
                "error",
                RuleId,
                $"Failed operations threshold reached ({sample.FailedMessages} failures)",
                sample.Timestamp);
        }

        return null;
    }
}
