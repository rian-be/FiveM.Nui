using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace FiveM.Nui.Contracts.Mapping;

/// <summary>
/// Reflection predicates shared by the type graph builder and the type mapper:
/// how a C# type is classified for the TypeScript mapping.
/// </summary>
internal static class TypeIntrospection
{
    [ThreadStatic]
    private static NullabilityInfoContext? _nullability;

    private static NullabilityInfoContext Nullability => _nullability ??= new NullabilityInfoContext();

    private static readonly HashSet<Type> Numbers =
    [
        typeof(byte), typeof(sbyte), typeof(short), typeof(ushort),
        typeof(int), typeof(uint), typeof(long), typeof(ulong),
        typeof(float), typeof(double), typeof(decimal)
    ];

    private static readonly HashSet<Type> StringLike =
    [
        typeof(Guid), typeof(DateTime), typeof(DateTimeOffset), typeof(TimeSpan),
        typeof(DateOnly), typeof(TimeOnly), typeof(Uri)
    ];

    /// <summary>
    /// Gets the underlying type of a nullable value type, or <see langword="null"/>
    /// when the type is not nullable.
    /// </summary>
    /// <param name="type">The type to unwrap.</param>
    /// <returns>The underlying type, or <see langword="null"/>.</returns>
    public static Type? GetUnderlyingType(Type type) => Nullable.GetUnderlyingType(type);

    /// <summary>
    /// Gets the underlying type of a nullable value type, or the type itself.
    /// </summary>
    /// <param name="type">The type to unwrap.</param>
    /// <returns>The unwrapped type.</returns>
    public static Type Unwrap(Type type) => GetUnderlyingType(type) ?? type;

    /// <summary>
    /// Creates the nullability information for a property.
    /// </summary>
    /// <param name="property">The property to inspect.</param>
    /// <returns>The nullability information.</returns>
    public static NullabilityInfo CreateNullability(PropertyInfo property) => Nullability.Create(property);

    /// <summary>
    /// Gets a value indicating whether a type maps to a TypeScript number.
    /// </summary>
    /// <param name="type">The type to test.</param>
    /// <returns><see langword="true"/> for a numeric type.</returns>
    public static bool IsNumber(Type type) => Numbers.Contains(type);

    /// <summary>
    /// Gets a value indicating whether a type maps to a TypeScript string.
    /// </summary>
    /// <param name="type">The type to test.</param>
    /// <returns><see langword="true"/> for a string-like type.</returns>
    public static bool IsStringLike(Type type) => StringLike.Contains(type);

    /// <summary>
    /// Gets a value indicating whether a type is emitted inline, without a
    /// declaration of its own.
    /// </summary>
    /// <param name="type">The type to test.</param>
    /// <returns><see langword="true"/> for a scalar or opaque type.</returns>
    public static bool IsSimple(Type type)
    {
        if (type.IsPrimitive || type.IsPointer || type.IsByRef)
        {
            return true;
        }

        if (type == typeof(byte[]))
        {
            return true;
        }

        return type == typeof(string)
            || Numbers.Contains(type)
            || StringLike.Contains(type)
            || IsOpaque(type);
    }

    /// <summary>
    /// Gets a value indicating whether a type has no faithful TypeScript
    /// representation and maps to <c>unknown</c>.
    /// </summary>
    /// <param name="type">The type to test.</param>
    /// <returns><see langword="true"/> for an opaque type.</returns>
    public static bool IsOpaque(Type type) =>
        type == typeof(object)
        || type == typeof(Type)
        || type == typeof(JsonElement)
        || type == typeof(JsonDocument)
        || type == typeof(JsonNode)
        || type == typeof(IntPtr)
        || type == typeof(UIntPtr)
        || typeof(Delegate).IsAssignableFrom(type);

    /// <summary>
    /// Gets the value type of a dictionary interface implemented by a type.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <param name="valueType">The dictionary value type when found.</param>
    /// <returns><see langword="true"/> when the type is a dictionary.</returns>
    public static bool TryGetDictionaryValue(Type type, out Type valueType)
    {
        foreach (var candidate in SelfAndInterfaces(type))
        {
            if (!candidate.IsGenericType)
            {
                continue;
            }

            var definition = candidate.GetGenericTypeDefinition();
            if (definition == typeof(IDictionary<,>) || definition == typeof(IReadOnlyDictionary<,>))
            {
                valueType = candidate.GetGenericArguments()[1];
                return true;
            }
        }

        valueType = typeof(object);
        return false;
    }

    /// <summary>
    /// Gets the element type of an array or a generic enumerable implemented by a
    /// type.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <param name="elementType">The element type when found.</param>
    /// <returns><see langword="true"/> when an element type was found.</returns>
    public static bool TryGetElementType(Type type, out Type elementType)
    {
        if (type.IsArray && type.GetArrayRank() == 1)
        {
            elementType = type.GetElementType()!;
            return true;
        }

        foreach (var candidate in SelfAndInterfaces(type))
        {
            if (candidate.IsGenericType && candidate.GetGenericTypeDefinition() == typeof(IEnumerable<>))
            {
                elementType = candidate.GetGenericArguments()[0];
                return true;
            }
        }

        elementType = typeof(object);
        return false;
    }

    private static IEnumerable<Type> SelfAndInterfaces(Type type)
    {
        if (type.IsInterface)
        {
            yield return type;
        }

        foreach (var @interface in type.GetInterfaces())
        {
            yield return @interface;
        }
    }
}
