using FiveM.Nui.Contracts.Model;

namespace FiveM.Nui.Contracts.Generation;

/// <summary>
/// Deduplicates events by name (the first declaration wins) and orders them so
/// the emitted map is deterministic.
/// </summary>
/// <param name="warnings">The sink for duplicate-name warnings.</param>
internal sealed class EventMapBuilder(ICollection<string> warnings)
{
    /// <summary>
    /// Builds the final, ordered event list.
    /// </summary>
    /// <param name="events">The discovered events, in discovery order.</param>
    /// <returns>The deduplicated events, ordered by name.</returns>
    public IReadOnlyList<EventDefinition> Build(IReadOnlyList<EventDefinition> events)
    {
        var seen = new HashSet<string>(StringComparer.Ordinal);
        var unique = new List<EventDefinition>();

        foreach (var @event in events)
        {
            if (seen.Add(@event.Name))
            {
                unique.Add(@event);
                continue;
            }

            warnings.Add(
                $"Duplicate event name '{@event.Name}' is ignored; the first declaration wins.");
        }

        return [.. unique.OrderBy(@event => @event.Name, StringComparer.Ordinal)];
    }
}
