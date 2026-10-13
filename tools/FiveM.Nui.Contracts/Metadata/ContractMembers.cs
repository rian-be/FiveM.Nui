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
    /// Gets a value indicating whether a property is excluded from serialization.
    /// </summary>
    /// <param name="property">The property to test.</param>
    /// <returns><see langword="true"/> when the property is ignored.</returns>
    public static bool IsIgnored(PropertyInfo property)
    {
        var ignore = property.GetCustomAttribute<JsonIgnoreAttribute>();
        return ignore is not null && ignore.Condition == JsonIgnoreCondition.Always;
    }

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
    /// Escapes a string for use as a TypeScript string literal (single-quoted).
    /// Escapes backslashes and single quotes to produce valid TypeScript syntax.
    /// Also validates that the string doesn't contain control characters or newlines
    /// which would make it invalid as a literal.
    /// </summary>
    /// <param name="value">The string value to escape.</param>
    /// <returns>The quoted and escaped string literal.</returns>
    /// <exception cref="InvalidOperationException">When the string contains invalid characters for a TypeScript literal.</exception>
    public static string EscapeStringLiteral(string value)
    {
        // Check for control characters and newlines which would make the literal invalid
        if (value.IndexOfAny(new[] { '\n', '\r', '\0' }) >= 0)
        {
            throw new InvalidOperationException(
                $"String literal '{value}' contains control characters or newlines which are not valid in TypeScript string literals. " +
                "Consider using a computed property name or escaping the value in the source."
            );
        }

        // Escape backslashes and single quotes
        // Order matters: escape backslashes first to avoid double-escaping
        var escaped = value
            .Replace("\\", "\\\\")
            .Replace("'", "\\'");

        return $"'{escaped}'";
    }
}
