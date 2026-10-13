using FiveM.Nui.Contracts.Metadata;

namespace FiveM.Nui.Contracts.Model;

/// <summary>
/// Produces the TypeScript identifiers used for contract types.
/// </summary>
internal static class TsNames
{
    /// <summary>
    /// Gets the simple name of a type, stripping generic arity and qualifying
    /// nested types with their declaring type.
    /// </summary>
    /// <param name="type">The type to name.</param>
    /// <returns>The simple TypeScript identifier.</returns>
    public static string KeyName(Type type)
    {
        var name = type.Name;
        var tick = name.IndexOf('`');
        if (tick >= 0)
        {
            name = name[..tick];
        }

        return type.IsNested && type.DeclaringType is not null
            ? KeyName(type.DeclaringType) + name
            : name;
    }

    /// <summary>
    /// Gets the emitted name of a type: the <c>[NuiContract]</c> override when
    /// present, otherwise its <see cref="KeyName"/>.
    /// </summary>
    /// <param name="type">The type to name.</param>
    /// <returns>The declared TypeScript identifier.</returns>
    /// <exception cref="InvalidOperationException">
    /// The <c>[NuiContract]</c> override is not a valid TypeScript identifier.
    /// </exception>
    public static string DeclaredName(Type type)
    {
        var name = ContractAttributes.ContractTypeName(type);
        if (string.IsNullOrWhiteSpace(name))
        {
            return KeyName(type);
        }

        if (!ContractMembers.IsValidIdentifier(name))
        {
            throw new InvalidOperationException(
                $"[NuiContract(\"{name}\")] on '{type.FullName}' is not a valid TypeScript identifier. " +
                "A type name must start with a letter, underscore, or dollar sign and contain only " +
                "letters, digits, underscores, or dollar signs.");
        }

        // Additional check: reject TypeScript reserved words that cannot be used
        // as the name of an export interface or export type declaration.
        var reserved = new HashSet<string>(StringComparer.Ordinal)
        {
            "type", "interface", "class", "enum", "namespace", "module",
            "import", "export", "const", "let", "var", "function", "return"
        };

        if (reserved.Contains(name))
        {
            throw new InvalidOperationException(
                $"[NuiContract(\"{name}\")] on '{type.FullName}' is a reserved TypeScript keyword " +
                "and cannot be used as a type name. Choose a different name.");
        }

        return name;
    }
}
