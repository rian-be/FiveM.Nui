using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace FiveM.Nui.Contracts.Metadata;

/// <summary>
/// Selects the members of a contract type and derives their JSON names, matching
/// <c>NuiJsonSerializer</c>.
/// </summary>
internal static class ContractMembers
{
    /// <summary>
    /// Enumerates the serializable properties of a type, in declaration order,
    /// skipping indexers and ignored members.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns>The serializable properties.</returns>
    public static IEnumerable<PropertyInfo> Properties(Type type) =>
        type.GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(property => property.GetMethod is not null && property.GetIndexParameters().Length == 0)
            .Where(property => !IsIgnored(property))
            .OrderBy(property => property.MetadataToken);

    /// <summary>
    /// Enumerates the members of an enum, in declaration order.
    /// </summary>
    /// <param name="type">The enum type.</param>
    /// <returns>The enum's static fields.</returns>
    public static IEnumerable<FieldInfo> EnumMembers(Type type) =>
        type.GetFields(BindingFlags.Public | BindingFlags.Static)
            .OrderBy(field => field.MetadataToken);

    /// <summary>
    /// Gets the <see cref="JsonIgnoreCondition"/> configured for a property, or
    /// <see langword="null"/> when the property carries no <c>[JsonIgnore]</c>.
    /// A no-argument <c>[JsonIgnore]</c> reports <see cref="JsonIgnoreCondition.Always"/>.
    /// </summary>
    /// <param name="property">The property to inspect.</param>
    /// <returns>The configured condition, or <see langword="null"/>.</returns>
    public static JsonIgnoreCondition? IgnoreCondition(PropertyInfo property) =>
        property.GetCustomAttribute<JsonIgnoreAttribute>()?.Condition;

    /// <summary>
    /// Gets a value indicating whether a property is excluded from serialization.
    /// Only <see cref="JsonIgnoreCondition.Always"/> removes the member entirely;
    /// the conditional modes still serialize the member for some values.
    /// </summary>
    /// <param name="property">The property to test.</param>
    /// <returns><see langword="true"/> when the property is ignored.</returns>
    public static bool IsIgnored(PropertyInfo property) =>
        IgnoreCondition(property) == JsonIgnoreCondition.Always;

    /// <summary>
    /// Gets a value indicating whether a property may be absent from the wire
    /// payload because of a conditional ignore rule, without being removed from
    /// the contract. This covers <see cref="JsonIgnoreCondition.WhenWritingNull"/>
    /// (omitted when null) and <see cref="JsonIgnoreCondition.WhenWritingDefault"/>
    /// (omitted when equal to the default value).
    /// </summary>
    /// <param name="property">The property to test.</param>
    /// <returns><see langword="true"/> when the property is conditionally omitted.</returns>
    public static bool IsConditionallyOmitted(PropertyInfo property) =>
        IgnoreCondition(property) is JsonIgnoreCondition.WhenWritingNull
            or JsonIgnoreCondition.WhenWritingDefault;

    /// <summary>
    /// Gets a value indicating whether a property is always written, even when it
    /// holds a null or default value (<see cref="JsonIgnoreCondition.Never"/>).
    /// Such a member stays required in the generated contract.
    /// </summary>
    /// <param name="property">The property to test.</param>
    /// <returns><see langword="true"/> when the property is always serialized.</returns>
    public static bool IsAlwaysSerialized(PropertyInfo property) =>
        IgnoreCondition(property) == JsonIgnoreCondition.Never;

    /// <summary>
    /// Gets the wire name of a property, honoring <c>[JsonPropertyName]</c> and
    /// otherwise the camelCase policy.
    /// </summary>
    /// <param name="property">The property to name.</param>
    /// <returns>The wire member name.</returns>
    public static string PropertyName(PropertyInfo property) =>
        property.GetCustomAttribute<JsonPropertyNameAttribute>()?.Name
        ?? JsonNamingPolicy.CamelCase.ConvertName(property.Name);

    /// <summary>
    /// Gets a TypeScript property name for the given wire name. If the name is
    /// a valid TypeScript identifier, returns it as-is; otherwise returns it
    /// as a quoted string literal. This handles property names that require
    /// quoting due to special characters (e.g., "display-name").
    /// </summary>
    /// <param name="name">The wire name of the property.</param>
    /// <returns>A valid TypeScript property name or string literal.</returns>
    public static string PropertyLiteral(string name)
    {
        if (IsValidIdentifier(name))
        {
            return name;
        }

        return EscapeStringLiteral(name);
    }

    /// <summary>
    /// Checks if a string is a valid TypeScript identifier.
    /// Must start with a letter, underscore, or dollar sign,
    /// followed by letters, digits, underscores, or dollar signs.
    /// </summary>
    /// <param name="name">The name to check.</param>
    /// <returns><see langword="true"/> if the name is a valid identifier.</returns>
    public static bool IsValidIdentifier(string name)
    {
        if (string.IsNullOrEmpty(name))
        {
            return false;
        }

        // First character must be letter, underscore, or dollar sign
        char first = name[0];
        if (!char.IsLetter(first) && first != '_' && first != '$')
        {
            return false;
        }

        // Remaining characters must be letter, digit, underscore, or dollar sign
        for (int i = 1; i < name.Length; i++)
        {
            char c = name[i];
            if (!char.IsLetterOrDigit(c) && c != '_' && c != '$')
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// Gets the TypeScript string literal for an enum member, honoring
    /// <c>[JsonStringEnumMemberName]</c> and otherwise the camelCase policy.
    /// </summary>
    /// <param name="field">The enum member.</param>
    /// <returns>The quoted and escaped string literal.</returns>
    public static string EnumLiteral(FieldInfo field)
    {
        var name = field.GetCustomAttribute<JsonStringEnumMemberNameAttribute>()?.Name
            ?? JsonNamingPolicy.CamelCase.ConvertName(field.Name);

        return EscapeStringLiteral(name);
    }

    /// <summary>
    /// Escapes a string for use as a TypeScript string literal.
    /// Uses JSON serialization, whose string literal syntax is compatible
    /// with TypeScript.
    /// </summary>
    /// <param name="value">The string value to escape.</param>
    /// <returns>The quoted and escaped string literal.</returns>
    public static string EscapeStringLiteral(string value)
    {
        ArgumentNullException.ThrowIfNull(value);

        if (value.IndexOfAny(new[] { '\n', '\r', '\0' }) >= 0)
        {
            throw new InvalidOperationException(
                $"String literal '{value}' contains control characters or newlines which are not valid in TypeScript string literals. " +
                "Consider using a computed property name or escaping the value in the source."
            );
        }

        var escaped = value
            .Replace("\\", "\\\\")
            .Replace("'", "\\'");

        return $"'{escaped}'";
    }
}
