using System.Collections;
using FiveM.Nui.Contracts.Mapping;
using FiveM.Nui.Contracts.Metadata;
using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Generation;

/// <summary>
/// Walks the reference graph of contract types, registering a
/// <see cref="Declaration"/> for every non-simple type reachable from the roots.
/// </summary>
/// <param name="declarations">The set that receives the discovered declarations.</param>
internal sealed class TypeGraphBuilder(DeclarationSet declarations)
{
    /// <summary>
    /// Registers a type and, transitively, every contract type it references.
    /// </summary>
    /// <param name="type">The type to collect.</param>
    public void Collect(Type type)
    {
        type = TypeIntrospection.Unwrap(type);

        if (type.IsGenericParameter)
        {
            return;
        }

        if (type.IsEnum)
        {
            var enumKey = type.IsGenericType ? type.GetGenericTypeDefinition() : type;
            declarations.TryAdd(enumKey, new Declaration(enumKey));
            return;
        }

        if (TypeIntrospection.IsSimple(type))
        {
            return;
        }

        if (TypeIntrospection.TryGetDictionaryValue(type, out var valueType))
        {
            Collect(valueType);
            return;
        }

        if (TypeIntrospection.TryGetElementType(type, out var elementType))
        {
            Collect(elementType);
            return;
        }

        if (typeof(IEnumerable).IsAssignableFrom(type))
        {
            // A non-generic collection (such as ArrayList) has no element type
            // to contract, so it is left for the emitter to map to unknown[].
            return;
        }

        if (type.IsGenericType && !type.IsGenericTypeDefinition)
        {
            foreach (var argument in type.GetGenericArguments())
            {
                Collect(argument);
            }
        }

        var definition = type.IsGenericType ? type.GetGenericTypeDefinition() : type;
        if (declarations.ContainsKey(definition))
        {
            return;
        }

        declarations.Add(definition, new Declaration(definition));

        foreach (var property in ContractMembers.Properties(definition))
        {
            Collect(property.PropertyType);
        }
    }
}
