using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.DevTools.Client.Abstractions;
using FiveM.Nui.DevTools.Client.Alerting.Rules;

namespace FiveM.Nui.DevTools.Client.Alerting;

/// <summary>
/// Evaluates diagnostic telemetry samples against registered alert rules and manages a buffer of recent alerts.
/// </summary>
public sealed class AlertEngine : IAlertEngine
{
    private const int MaxAlertsCapacity = 50;
    private readonly Lock _lock = new();
    private readonly Queue<NuiDiagnosticAlert> _alerts = new(MaxAlertsCapacity);
    private readonly List<IAlertRule> _rules;

    /// <summary>Initializes a new instance of the <see cref="AlertEngine"/> class with default or custom alert rules.</summary>
    /// <param name="rules">Optional collection of alert rules. When <see langword="null"/>, default heuristic rules are registered.</param>
    public AlertEngine(IEnumerable<IAlertRule>? rules = null)
    {
        _rules = rules?.ToList() ??
        [
            new HighThroughputAlertRule(),
            new LargePayloadAlertRule(),
            new HighLatencyAlertRule(),
            new FailuresDetectedAlertRule(),
            new BandwidthSpikeAlertRule()
        ];
    }

    /// <summary>Evaluates all registered alert rules against the provided telemetry sample.</summary>
    /// <param name="sample">The telemetry sample to inspect.</param>
    public void Evaluate(NuiDevToolsSample sample)
    {
        ArgumentNullException.ThrowIfNull(sample);

        foreach (var rule in _rules)
        {
            var alert = rule.Evaluate(sample);
            if (alert is not null)
            {
                AddAlert(alert);
            }
        }
    }

    /// <summary>Enqueues an alert into the circular alert history buffer.</summary>
    /// <param name="alert">The diagnostic alert to record.</param>
    public void AddAlert(NuiDiagnosticAlert alert)
    {
        ArgumentNullException.ThrowIfNull(alert);

        lock (_lock)
        {
            _alerts.Enqueue(alert);
            while (_alerts.Count > MaxAlertsCapacity)
            {
                _alerts.Dequeue();
            }
        }
    }

    /// <summary>Retrieves a snapshot of all active alerts in reverse chronological order.</summary>
    /// <returns>A read-only list of recorded diagnostic alerts.</returns>
    public IReadOnlyList<NuiDiagnosticAlert> GetAlerts()
    {
        lock (_lock)
        {
            return _alerts.Reverse().ToArray();
        }
    }

    /// <summary>Clears all recorded alerts from the buffer.</summary>
    public void Clear()
    {
        lock (_lock)
        {
            _alerts.Clear();
        }
    }
}
