namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Represents a message sent between C# and NUI.
/// </summary>
public sealed record NuiMessage
{
    /// <summary>
    /// Gets or sets the correlation ID for request/response matching.
    /// </summary>
    public string? Id { get; init; }

    /// <summary>
    /// Gets or sets the message type (request, response, event).
    /// </summary>
    public string Type { get; init; } = "event";

    /// <summary>
    /// Gets or sets the event name.
    /// </summary>
    public string Event { get; init; } = string.Empty;

    /// <summary>
    /// Gets or sets the message payload.
    /// </summary>
    public object? Payload { get; init; }

    /// <summary>
    /// Gets or sets whether the operation was successful (for responses).
    /// </summary>
    public bool Success { get; init; } = true;

    /// <summary>
    /// Gets or sets the error information (for failed responses).
    /// </summary>
    public NuiError? Error { get; init; }

    /// <summary>
    /// Creates a new event message.
    /// </summary>
    public static NuiMessage CreateEvent(string eventName, object? payload = null) =>
        new()
        {
            Type = "event",
            Event = eventName,
            Payload = payload
        };

    /// <summary>
    /// Creates a new request message.
    /// </summary>
    public static NuiMessage CreateRequest(string id, string eventName, object? payload = null) =>
        new()
        {
            Id = id,
            Type = "request",
            Event = eventName,
            Payload = payload
        };

    /// <summary>
    /// Creates a new response message.
    /// </summary>
    public static NuiMessage CreateResponse(string id, bool success, object? payload = null, NuiError? error = null) =>
        new()
        {
            Id = id,
            Type = "response",
            Success = success,
            Payload = payload,
            Error = error
        };
}
