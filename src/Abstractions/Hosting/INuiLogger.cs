namespace FiveM.Nui.Abstractions.Hosting;

/// <summary>
/// Abstraction for NUI logging.
/// </summary>
public interface INuiLogger
{
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
