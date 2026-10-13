namespace FiveM.Nui.Contracts.Metadata;

/// <summary>
/// The values read from a single <c>[NuiEvent]</c> attribute instance.
/// </summary>
/// <param name="Name">The event name as it appears on the wire.</param>
/// <param name="Request">The explicit request type, or <see langword="null"/>.</param>
/// <param name="Response">The explicit response type, or <see langword="null"/>.</param>
internal readonly record struct NuiEventSpec(string Name, Type? Request, Type? Response);