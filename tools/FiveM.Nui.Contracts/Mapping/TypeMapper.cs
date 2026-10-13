using System.Collections;
using System.Reflection;
using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Mapping;

/// <summary>
/// Maps C# types onto TypeScript type expressions, mirroring
/// <c>NuiJsonSerializer</c>. Referenced contract types resolve to their emitted
/// names; unknown types degrade to <c>unknown</c> and record a warning.
/// </summary>
/// <param name="declarations">The declarations available for name resolution.</param>
/// <param name="options">The generation options.</param>
/// <param name="warnings">The sink for mapping warnings.</param>
internal sealed class TypeMapper(
    DeclarationSet declarations,
    ContractGeneratorOptions options,
    ICollection<string> warnings) : ITypeMapper
{
    /// <inheritdoc/>
    public TypeMap Map(Type type, NullabilityInfo? info)
    {
        var nullable = info?.ReadState == NullabilityState.Nullable;

        if (TypeIntrospection.GetUnderlyingType(type) is { } underlying)
        {
            type = underlying;
            nullable = true;
        }

        return new TypeMap(MapNonNullable(type, info), nullable);
    }

    /// <inheritdoc/>
    public string MapNonNullable(Type type) => MapNonNullable(type, null);

    private string MapNonNullable(Type type, NullabilityInfo? info)
    {
        if (type.IsGenericParameter)
        {
            return type.Name;
        }

        if (type.IsEnum)
        {
            return declarations.ResolveName(type);
        }

        if (type == typeof(byte[]))
        {
            return "string";
        }

        if (type == typeof(string) || type == typeof(char))
        {
            return "string";
        }

        if (type == typeof(bool))
        {
            return "boolean";
        }

        if (TypeIntrospection.IsNumber(type))
        {
            return "number";
        }

        if (TypeIntrospection.IsStringLike(type))
        {
            return "string";
        }

        if (TypeIntrospection.IsOpaque(type))
        {
            return "unknown";
        }

        if (TypeIntrospection.TryGetDictionaryValue(type, out var valueType))
        {
            var valueInfo = info?.GenericTypeArguments is { Length: 2 } arguments ? arguments[1] : null;
            return $"Record<string, {MapChild(valueType, valueInfo)}>";
        }

        if (TypeIntrospection.TryGetElementType(type, out var elementType))
        {
            return MapChild(elementType, info?.ElementType) + "[]";
        }

        if (type.IsArray || typeof(IEnumerable).IsAssignableFrom(type))
        {
            return "unknown[]";
        }

        var definition = type.IsGenericType ? type.GetGenericTypeDefinition() : type;
        if (!declarations.ContainsKey(definition))
        {
            warnings.Add($"Type '{type.FullName}' is not a contract; it was mapped to 'unknown'.");
            return "unknown";
        }

        var name = declarations.ResolveName(type);

        if (type.IsGenericType && !type.IsGenericTypeDefinition)
        {
            var arguments = type.GetGenericArguments();
            var mapped = new string[arguments.Length];
            for (var i = 0; i < arguments.Length; i++)
            {
                var argumentInfo = info?.GenericTypeArguments is { } infos && i < infos.Length ? infos[i] : null;
                mapped[i] = MapChild(arguments[i], argumentInfo);
            }

            name += "<" + string.Join(", ", mapped) + ">";
        }

        return name;
    }

    /// <summary>
    /// Maps a nested type, applying the null representation to the inner type
    /// when the configuration asks for a null union.
    /// </summary>
    /// <param name="type">The nested type to map.</param>
    /// <param name="info">The nullability information, or <see langword="null"/>.</param>
    /// <returns>The mapped type expression.</returns>
    private string MapChild(Type type, NullabilityInfo? info)
    {
        var (text, nullable) = Map(type, info);
        return nullable && options.Nullability == NullabilityMode.Nullable ? text + " | null" : text;
    }
}
