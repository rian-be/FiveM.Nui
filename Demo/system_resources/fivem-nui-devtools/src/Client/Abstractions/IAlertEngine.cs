using FiveM.Nui.Abstractions.DevTools;

namespace FiveM.Nui.DevTools.Client.Abstractions;

/// <summary>Manages alert rule evaluation and the circular alert history buffer.</summary>
public interface IAlertEngine
{
    /// <summary>Evaluates all registered alert rules against the provided telemetry sample.</summary>
    /// <param name="sample">The telemetry sample to evaluate.</param>
    void Evaluate(NuiDevToolsSample sample);

    /// <summary>Enqueues an alert into the circular alert history buffer.</summary>
    /// <param name="alert">The diagnostic alert to record.</param>
    void AddAlert(NuiDiagnosticAlert alert);

    /// <summary>Retrieves snapshot of all active alerts in reverse chronological order.</summary>
    IReadOnlyList<NuiDiagnosticAlert> GetAlerts();

    /// <summary>Clears all recorded alerts from the buffer.</summary>
    void Clear();
}
