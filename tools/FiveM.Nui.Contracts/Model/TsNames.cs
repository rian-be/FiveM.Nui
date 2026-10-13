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
    public static string DeclaredName(Type type)
    {
        var name = ContractAttributes.ContractTypeName(type);
        return !string.IsNullOrWhiteSpace(name) ? name : KeyName(type);
    }
}
