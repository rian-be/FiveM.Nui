namespace FiveM.Nui.Contracts.Model;

/// <summary>
/// A single NUI event and the contract types that flow through it: a request and
/// optional response, or a fire-and-forget payload.
/// </summary>
/// <param name="Name">The event name as it appears on the wire.</param>
/// <param name="Request">The request type, or <see langword="null"/>.</param>
/// <param name="Response">The response type, or <see langword="null"/>.</param>
/// <param name="Payload">The payload type for a fire-and-forget event, or <see langword="null"/>.</param>
internal sealed record EventDefinition(string Name, Type? Request, Type? Response, Type? Payload);
