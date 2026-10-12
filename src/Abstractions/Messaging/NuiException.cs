namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Exception thrown when an NUI request fails.
/// </summary>
public sealed class NuiException : Exception
{
    /// <summary>
    /// Gets the error code.
    /// </summary>
    public string ErrorCode { get; }

    /// <summary>
    /// Initializes a new instance of the NuiException class.
    /// </summary>
    public NuiException(string errorCode, string message)
        : base(message)
    {
        ErrorCode = errorCode;
    }
}
