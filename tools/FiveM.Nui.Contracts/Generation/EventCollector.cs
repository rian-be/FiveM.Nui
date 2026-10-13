using FiveM.Nui.Contracts.Mapping;
using FiveM.Nui.Contracts.Metadata;
using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Generation;

/// <summary>
/// Turns the <c>[NuiEvent]</c> registrations on a contract type into
/// <see cref="EventDefinition"/> entries, inferring the request/response pair
/// from <c>INuiRequest&lt;TResponse&gt;</c> when the attribute leaves it implicit.
/// </summary>
internal static class EventCollector
{
    /// <summary>
    /// Appends an entry for every <c>[NuiEvent]</c> on the type.
    /// </summary>
    /// <param name="type">The contract type to inspect.</param>
    /// <param name="events">The collection that receives the entries.</param>
    public static void Collect(Type type, ICollection<EventDefinition> events)
    {
        type = TypeIntrospection.Unwrap(type);
        foreach (var spec in ContractAttributes.Events(type))
        {
            events.Add(CreateEvent(type, spec));
        }
    }

    private static EventDefinition CreateEvent(Type type, NuiEventSpec spec)
    {
        var request = spec.Request;
        var response = spec.Response;
        Type? payload = null;

        if (request is null && response is null)
        {
            if (ContractAttributes.RequestResponse(type) is { } inferred)
            {
                request = type;
                response = inferred;
            }
            else
            {
                payload = type;
            }
        }
        else if (request is null)
        {
            request = type;
        }

        return new EventDefinition(spec.Name, request, response, payload);
    }
}
