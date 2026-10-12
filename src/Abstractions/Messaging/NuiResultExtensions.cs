namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// C# 14 extension members over <see cref="NuiResult{T}"/>.
/// </summary>
/// <remarks>
/// Uses the C# 14 <c>extension</c> block rather than classic
/// <c>this</c>-parameter extension methods, so both an extension method and
/// extension properties can be declared over the same receiver.
/// </remarks>
public static class NuiResultExtensions
{
    extension<T>(NuiResult<T> result)
    {
        /// <summary>
        /// The inverse of <see cref="NuiResult{T}.Success"/>.
        /// </summary>
        public bool IsFailure => !result.Success;

        /// <summary>
        /// The successful value, or <see langword="default"/> when the result
        /// failed or carried no value.
        /// </summary>
        public T ValueOrDefault => result.Value is null ? default! : result.Value;

        /// <summary>
        /// The successful value, or throws <see cref="NuiException"/> when the
        /// result failed.
        /// </summary>
        /// <returns>The successful value.</returns>
        public T ValueOrThrow() =>
            result.Success && result.Value is not null
                ? result.Value
                : throw new NuiException(
                    result.Error?.Code ?? "NO_VALUE",
                    result.Error?.Message ?? $"{nameof(NuiResult<>)} carries no value.");
    }

    extension<T>(NuiResult<T>)
    {
        /// <summary>
        /// Creates a successful result for a non-null value, otherwise a failure.
        /// </summary>
        /// <param name="value">The candidate value.</param>
        /// <param name="code">Error code used when <paramref name="value"/> is <see langword="null"/>.</param>
        /// <param name="message">Error message used when <paramref name="value"/> is <see langword="null"/>.</param>
        /// <returns>A successful or failed <see cref="NuiResult{T}"/>.</returns>
        public static NuiResult<T> FromNullable(T? value, string code = "NO_VALUE", string message = "No value") =>
            value is null ? NuiResult<T>.Fail(code, message) : NuiResult<T>.Ok(value);
    }
}
