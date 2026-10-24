using CitizenFX.FiveM.Shared;
using FiveM.Nui.Transport;

namespace FiveM.Nui.Hosting;

/// <summary>
/// <see cref="INuiLogger"/> that writes to the FiveM client console through the
/// runtime's own log sink, so library output lands in the same stream as the
/// host resource and carries real severity levels.
/// </summary>
/// <remarks>
/// <para>
/// The core library must stay runtime-agnostic, so this is the only place in
/// the library that touches <c>CitizenFX.FiveM.Shared.Logger</c> for diagnostics - the same
/// separation <see cref="FiveMNuiRuntime"/> draws for the natives.
/// </para>
/// <para>
/// <see cref="LogDebug"/> is suppressed unless <see cref="IncludeDebug"/> is set,
/// because the core logs every envelope at debug level and that floods the
/// console during ordinary play.
/// </para>
/// <para>
/// The SDK's logger only exists once a resource is running, so every write drops
/// to the trace output when no core has been created (unit tests, tooling).
/// </para>
/// </remarks>
public sealed class FiveMNuiLogger(string category = "[FiveM.Nui]") : INuiLogger
{
    /// <summary>Default instance using the library's own category.</summary>
    public static INuiLogger Shared { get; } = new FiveMNuiLogger();


    /// <summary>
    /// Whether <see cref="LogDebug"/> reaches the console. Off by default.
    /// </summary>
    public bool IncludeDebug { get; init; }

    /// <summary>Whether <see cref="LogInformation"/> reaches the console.</summary>
    public bool IncludeInformation { get; set; } = true;

    /// <inheritdoc />
    public bool IsEnabled(NuiLogLevel level) => level switch
    {
        NuiLogLevel.Debug => IncludeDebug,
        NuiLogLevel.Information => IncludeInformation,
        _ => true
    };

    /// <summary>
    /// Writes a debug entry, but only when <see cref="IncludeDebug"/> is enabled.
    /// </summary>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogDebug(string message, params object[] args)
    {
        if (!IncludeDebug)
        {
            return;
        }

        Write(Severity.Debug, $"{category} DEBUG: {Format(message, args)}");
    }

    /// <summary>
    /// Writes an information entry, but only when <see cref="IncludeInformation"/> is enabled.
    /// </summary>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogInformation(string message, params object[] args)
    {
        if (!IncludeInformation)
        {
            return;
        }

        Write(Severity.Info, $"{category} {Format(message, args)}");
    }

    /// <summary>
    /// Writes a warning entry.
    /// </summary>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogWarning(string message, params object[] args) =>
        Write(Severity.Warn, $"{category} WARN: {Format(message, args)}");

    /// <summary>
    /// Writes a warning entry followed by the exception detail.
    /// </summary>
    /// <param name="exception">The exception to log alongside the message.</param>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogWarning(Exception exception, string message, params object[] args)
    {
        Write(Severity.Warn, $"{category} WARN: {Format(message, args)}");
        LogDetail(exception);
    }

    /// <summary>
    /// Writes an error entry.
    /// </summary>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogError(string message, params object[] args) =>
        Write(Severity.Error, $"{category} ERROR: {Format(message, args)}");

    /// <summary>
    /// Writes an error entry followed by the exception detail.
    /// </summary>
    /// <param name="exception">The exception to log alongside the message.</param>
    /// <param name="message">Message template.</param>
    /// <param name="args">Arguments substituted into the template.</param>
    public void LogError(Exception exception, string message, params object[] args)
    {
        Write(Severity.Error, $"{category} ERROR: {Format(message, args)}");
        LogDetail(exception);
    }

    /// <summary>
    /// Logs the exception type and stack on their own lines.
    /// </summary>
    /// <remarks>
    /// Deliberately not folded into the message: the caller supplies the human
    /// context, and only the runtime can expand a stack trace.
    /// </remarks>
    private void LogDetail(Exception? exception)
    {
        if (exception is null)
        {
            return;
        }

        Write(Severity.Error, $"{category} {exception.GetType().FullName}: {exception.Message}");

        if (!string.IsNullOrWhiteSpace(exception.StackTrace))
        {
            Write(Severity.Error, $"{category} {exception.StackTrace}");
        }
    }

    /// <summary>Severity levels mirrored from the SDK's logger.</summary>
    private enum Severity
    {
        Debug,
        Info,
        Warn,
        Error,
    }

    /// <summary>
    /// Writes one line through the SDK logger, or through the trace output when
    /// the SDK has no core yet.
    /// </summary>
    /// <remarks>
    /// <see cref="SharedAPI.Log"/> dereferences the core the client entrypoint
    /// creates, so outside a running resource the getter throws. A logger that
    /// throws takes the caller down with it, so the fallback keeps unit tests and
    /// tooling able to produce output.
    /// </remarks>
    private static void Write(Severity severity, string line)
    {
        try
        {
            var log = SharedAPI.Log;

            switch (severity)
            {
                case Severity.Debug:
                    log.Debug(line);
                    break;
                case Severity.Info:
                    log.Info(line);
                    break;
                case Severity.Warn:
                    log.Warn(line);
                    break;
                default:
                    log.Error(line);
                    break;
            }
        }
        catch (Exception)
        {
            System.Diagnostics.Debug.WriteLine(line);
        }
    }

    /// <summary>
    /// Applies composite-format holes, falling back to the raw arguments when
    /// the template and the arguments disagree.
    /// </summary>
    private static string Format(string message, object[] args)
    {
        if (args.Length == 0)
        {
            return message;
        }

        try
        {
            return string.Format(message, args);
        }
        catch (FormatException)
        {
            // A logger that throws takes the caller down with it, so a bad
            // template is reported rather than propagated.
            return $"{message} | args: {string.Join(", ", args)}";
        }
    }
}
