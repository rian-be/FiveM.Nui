namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Represents an error in NUI communication.
/// </summary>
public sealed record NuiError
{
    /// <summary>
    /// Gets the error code.
    /// </summary>
    public string Code { get; init; } = string.Empty;

    /// <summary>
    /// Gets the error message.
    /// </summary>
    public string Message { get; init; } = string.Empty;

    /// <summary>
    /// Initializes a new instance of the NuiError class.
    /// </summary>
    public NuiError()
    {
    }

    /// <summary>
    /// Initializes a new instance of the NuiError class.
    /// </summary>
    /// <param name="code">Error code.</param>
    /// <param name="message">Error message.</param>
    public NuiError(string code, string message)
    {
        Code = code;
        Message = message;
    }
}
