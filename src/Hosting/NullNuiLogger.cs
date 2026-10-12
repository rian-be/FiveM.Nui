namespace FiveM.Nui.Hosting;

/// <summary>
/// Null logger implementation that suppresses all log output.
/// </summary>
/// <remarks>
/// Part of the default composition in <see cref="NuiClient"/>: when no
/// <see cref="INuiLogger"/> is supplied, this is used so the library never
/// depends on a logging framework the host did not configure.
/// </remarks>
public sealed class NullNuiLogger : INuiLogger
{
    /// <summary>
    /// The shared, stateless instance used wherever a logger is optional.
    /// </summary>
    public static readonly INuiLogger Instance = new NullNuiLogger();

    private NullNuiLogger()
    {
    }

    /// <summary>
    /// Discards the debug entry; this logger never writes anything.
    /// </summary>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogDebug(string message, params object[] args)
    {
    }

    /// <summary>
    /// Discards the information entry; this logger never writes anything.
    /// </summary>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogInformation(string message, params object[] args)
    {
    }

    /// <summary>
    /// Discards the warning entry; this logger never writes anything.
    /// </summary>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogWarning(string message, params object[] args)
    {
    }

    /// <summary>
    /// Discards the warning entry and its exception; this logger never writes anything.
    /// </summary>
    /// <param name="exception">Ignored.</param>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogWarning(Exception exception, string message, params object[] args)
    {
    }

    /// <summary>
    /// Discards the error entry; this logger never writes anything.
    /// </summary>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogError(string message, params object[] args)
    {
    }

    /// <summary>
    /// Discards the error entry and its exception; this logger never writes anything.
    /// </summary>
    /// <param name="exception">Ignored.</param>
    /// <param name="message">Ignored.</param>
    /// <param name="args">Ignored.</param>
    public void LogError(Exception exception, string message, params object[] args)
    {
    }
}
