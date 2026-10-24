namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>Severity used to query whether a log entry would be emitted.</summary>
public enum NuiLogLevel
{
    Debug,
    Information,
    Warning,
    Error
}

/// <summary>
/// Abstraction for NUI logging.
/// </summary>
public interface INuiLogger
{
    /// <summary>
    /// Reports whether the given severity is enabled. The default preserves
    /// compatibility with existing logger implementations.
    /// </summary>
    bool IsEnabled(NuiLogLevel level) => true;

    /// <summary>
    /// Logs a debug message.
    /// </summary>
    void LogDebug(string message, params object[] args);

    /// <summary>
    /// Logs an information message.
    /// </summary>
    void LogInformation(string message, params object[] args);

    /// <summary>
    /// Logs a warning message.
    /// </summary>
    void LogWarning(string message, params object[] args);

    /// <summary>
    /// Logs a warning message with an exception.
    /// </summary>
    void LogWarning(Exception exception, string message, params object[] args);

    /// <summary>
    /// Logs an error message.
    /// </summary>
    void LogError(string message, params object[] args);

    /// <summary>
    /// Logs an error message with an exception.
    /// </summary>
    void LogError(Exception exception, string message, params object[] args);
}
