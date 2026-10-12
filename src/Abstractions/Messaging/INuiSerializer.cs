namespace FiveM.Nui.Abstractions.Messaging;

/// <summary>
/// Abstraction for NUI message serialization.
/// </summary>
public interface INuiSerializer
{
    /// <summary>
    /// Serializes an object to JSON.
    /// </summary>
    /// <param name="value">Object to serialize.</param>
    /// <returns>JSON string.</returns>
    string Serialize<T>(T value);

    /// <summary>
    /// Deserializes JSON to an object.
    /// </summary>
    /// <param name="json">JSON string.</param>
    /// <returns>Deserialized object.</returns>
    T? Deserialize<T>(string json);

    /// <summary>
    /// Deserializes a JSON object payload to the target type without a
    /// serialize-then-deserialize round-trip. When the value is a
    /// <see cref="System.Text.Json.JsonElement"/> (the natural form of an
    /// untyped deserialized JSON token), it is deserialized directly;
    /// otherwise it is serialized to JSON first.
    /// </summary>
    /// <param name="value">Deserialized payload object (typically a <c>JsonElement</c>).</param>
    T? Deserialize<T>(object? value);

    /// <summary>
    /// Deserializes JSON to a type chosen at runtime, for dispatching payloads
    /// to handlers whose type is only known dynamically.
    /// </summary>
    /// <param name="json">JSON string.</param>
    /// <param name="type">Target type.</param>
    /// <returns>Deserialized object, or null when the JSON is null or malformed.</returns>
    object? Deserialize(string json, Type type);
}
