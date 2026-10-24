namespace FiveM.Nui.Abstractions.Diagnostics;

/// <summary>
/// Collects diagnostic metrics for the NUI pipeline.
/// </summary>
public interface INuiDiagnosticsCollector : INuiDiagnosticsProvider
{
    /// <summary>
    /// Reports whether recording is active. The default keeps custom collectors
    /// enabled and therefore preserves exact measurements for existing implementations.
    /// </summary>
    bool IsEnabled => true;

    /// <summary>
    /// Increments named counter.
    /// </summary>
    void IncrementCounter(string name);

    /// <summary>
    /// Records timing in milliseconds.
    /// </summary>
    void RecordTiming(string name, long milliseconds);

    /// <summary>
    /// Records payload size in bytes.
    /// </summary>
    void RecordPayload(int size);

    /// <summary>
    /// Resets all collected metrics to zero.
    /// </summary>
    void Reset();

    /// <summary>
    /// Logs the current metrics snapshot.
    /// </summary>
    /// <remarks>No-op when diagnostics are disabled.</remarks>
    void LogSnapshot();
}
