using System.Reflection;

namespace FiveM.Nui.Contracts.Mapping;

/// <summary>
/// The result of mapping a C# type: the TypeScript expression and whether the
/// source member admitted null.
/// </summary>
/// <param name="Text">The TypeScript type expression.</param>
/// <param name="Nullable">Whether the source member admitted null.</param>
internal readonly record struct TypeMap(string Text, bool Nullable);

/// <summary>
/// Maps C# types onto TypeScript type expressions.
/// </summary>
internal interface ITypeMapper
{
    /// <summary>
    /// Maps a type to a TypeScript expression, reporting whether the source
    /// admitted null so the caller can apply the configured null representation.
    /// </summary>
    /// <param name="type">The type to map.</param>
    /// <param name="info">The nullability information, or <see langword="null"/>.</param>
    /// <returns>The mapped type and its nullability.</returns>
    TypeMap Map(Type type, NullabilityInfo? info);

    /// <summary>
    /// Maps a type as a non-nullable TypeScript expression.
    /// </summary>
    /// <param name="type">The type to map.</param>
    /// <returns>The mapped type expression.</returns>
    string MapNonNullable(Type type);
}
