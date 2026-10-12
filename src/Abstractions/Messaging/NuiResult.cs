namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Represents the result of an NUI operation.
/// </summary>
/// <typeparam name="T">Type of the result value.</typeparam>
public sealed record NuiResult<T>
{
    /// <summary>
    /// Gets whether the operation was successful.
    /// </summary>
    public bool Success { get; init; }

    /// <summary>
    /// Gets the result value if successful.
    /// </summary>
    public T? Value { get; init; }

    /// <summary>
    /// Gets the error information if failed.
    /// </summary>
    public NuiError? Error { get; init; }

    /// <summary>
    /// Creates a successful result.
    /// </summary>
    public static NuiResult<T> Ok(T value) =>
        new()
        {
            Success = true,
            Value = value
        };

    /// <summary>
    /// Creates a failed result.
    /// </summary>
    public static NuiResult<T> Fail(NuiError error) =>
        new()
        {
            Success = false,
            Error = error
        };

    /// <summary>
    /// Creates a failed result with error code and message.
    /// </summary>
    public static NuiResult<T> Fail(string code, string message) =>
        Fail(new NuiError(code, message));
}
