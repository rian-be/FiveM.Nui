using System.Reflection;

namespace FiveM.Nui.Contracts.Metadata;

/// <summary>
/// Reads the FiveM.Nui contract attributes by full name instead of by type
/// identity. The generator therefore keeps working when the scanned assembly was
/// built against a different FiveM.Nui version than the tool itself.
/// </summary>
internal static class ContractAttributes
{
    private const string ContractName = "FiveM.Nui.Abstractions.Contracts.NuiContractAttribute";

    private const string EventName = "FiveM.Nui.Abstractions.Contracts.NuiEventAttribute";

    private const string RequestName = "FiveM.Nui.Abstractions.Contracts.INuiRequest`1";

    /// <summary>
    /// Gets the explicit TypeScript type name from <c>[NuiContract("...")]</c>,
    /// or <see langword="null"/> when the type is not marked or derives its name.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns>The override name, or <see langword="null"/>.</returns>
    public static string? ContractTypeName(MemberInfo type)
    {
        var data = Find(type, ContractName);
        if (data is null)
        {
            return null;
        }

        foreach (var argument in data.ConstructorArguments)
        {
            if (argument.Value is string name && !string.IsNullOrWhiteSpace(name))
            {
                return name;
            }
        }

        return null;
    }

    /// <summary>
    /// Gets a value indicating whether the type carries <c>[NuiContract]</c>.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns><see langword="true"/> when the attribute is present.</returns>
    public static bool HasContract(MemberInfo type) => Find(type, ContractName) is not null;

    /// <summary>
    /// Gets a value indicating whether the type carries <c>[NuiEvent]</c>.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns><see langword="true"/> when the attribute is present.</returns>
    public static bool HasEvent(MemberInfo type) => Find(type, EventName) is not null;

    /// <summary>
    /// Enumerates the <c>[NuiEvent]</c> registrations on a type.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns>One specification per attribute instance, in declaration order.</returns>
    public static IEnumerable<NuiEventSpec> Events(MemberInfo type)
    {
        foreach (var data in FindAll(type, EventName))
        {
            if (data.ConstructorArguments.Count == 0
                || data.ConstructorArguments[0].Value is not string name
                || string.IsNullOrEmpty(name))
            {
                continue;
            }

            Type? request = null;
            Type? response = null;
            foreach (var argument in data.NamedArguments)
            {
                if (argument.MemberName == "Request")
                {
                    request = argument.TypedValue.Value as Type;
                }
                else if (argument.MemberName == "Response")
                {
                    response = argument.TypedValue.Value as Type;
                }
            }

            yield return new NuiEventSpec(name, request, response);
        }
    }

    /// <summary>
    /// Gets the response type named by <c>INuiRequest&lt;TResponse&gt;</c>, or
    /// <see langword="null"/> when the type does not implement it.
    /// </summary>
    /// <param name="type">The type to inspect.</param>
    /// <returns>The response type, or <see langword="null"/>.</returns>
    public static Type? RequestResponse(Type type)
    {
        foreach (var @interface in type.GetInterfaces())
        {
            if (@interface.IsGenericType
                && @interface.GetGenericTypeDefinition().FullName == RequestName)
            {
                return @interface.GetGenericArguments()[0];
            }
        }

        return null;
    }

    private static CustomAttributeData? Find(MemberInfo member, string fullName)
    {
        foreach (var data in member.GetCustomAttributesData())
        {
            if (data.AttributeType.FullName == fullName)
            {
                return data;
            }
        }

        return null;
    }

    private static IEnumerable<CustomAttributeData> FindAll(MemberInfo member, string fullName)
    {
        foreach (var data in member.GetCustomAttributesData())
        {
            if (data.AttributeType.FullName == fullName)
            {
                yield return data;
            }
        }
    }
}