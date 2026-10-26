using FiveM.Nui.Abstractions.DevTools;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>
/// Evaluates diagnostic telemetry samples for performance anomalies or errors.
/// </summary>
public interface IAlertRule
{
    /// <summary>Gets the unique identifier code for this alert rule.</summary>
    string RuleId { get; }

    /// <summary>Evaluates a diagnostic telemetry sample against this rule's conditions.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    /// <returns>A new <see cref="NuiDiagnosticAlert"/> if an anomaly was detected; otherwise, <see langword="null"/>.</returns>
    NuiDiagnosticAlert? Evaluate(NuiDevToolsSample sample);
}
