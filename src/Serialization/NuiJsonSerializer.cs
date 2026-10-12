using System.Text.Json;
using System.Text.Json.Serialization;

namespace FiveM.Nui.Serialization;

public sealed class NuiJsonSerializer : INuiSerializer
{
    private readonly JsonSerializerOptions _options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
    };

    /// <summary>
    /// Serializes <paramref name="value"/> to JSON.
    /// </summary>
    /// <typeparam name="T">The value type.</typeparam>
    /// <param name="value">The value to serialize.</param>
    /// <returns>The camelCased JSON representation of <paramref name="value"/>, with null properties omitted.</returns>
    public string Serialize<T>(T value)
    {
        return JsonSerializer.Serialize(value, _options);
    }

    /// <summary>
    /// Deserializes a JSON string into <typeparamref name="T"/>.
    /// </summary>
    /// <typeparam name="T">The target type.</typeparam>
    /// <param name="json">The JSON text to read.</param>
    /// <returns>The deserialized value, or <see langword="null"/> when the input is JSON <c>null</c>.</returns>
    public T? Deserialize<T>(string json)
    {
        return JsonSerializer.Deserialize<T>(json, _options);
    }

    /// <summary>
    /// Deserializes an already-parsed value into <typeparamref name="T"/>.
    /// </summary>
    /// <remarks>
    /// Handy for a payload the NUI bridge already parsed into a
    /// <see cref="JsonElement"/> token: that token is deserialized directly,
    /// avoiding a serialize-then-deserialize round-trip. Any other value falls
    /// back to a JSON round-trip, so types are normalized first.
    /// </remarks>
    /// <typeparam name="T">The target type.</typeparam>
    /// <param name="value">The token to convert; <see langword="null"/> yields <see langword="default"/>.</param>
    /// <returns>The deserialized value, or <see langword="default"/> when <paramref name="value"/> is <see langword="null"/>.</returns>
    public T? Deserialize<T>(object? value)
    {
        return value switch
        {
            null => default,
            JsonElement element => element.Deserialize<T>(_options),
            _ => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(value, _options), _options)
        };

        // Fallback: box the object through JSON to normalize types.
    }

    /// <summary>
    /// Deserializes JSON string into the given runtime type.
    /// </summary>
    /// <param name="json">The JSON text to read.</param>
    /// <param name="type">The runtime type to produce.</param>
    /// <returns>The deserialized value, or <see langword="null"/> when the input is JSON <c>null</c>.</returns>
    public object? Deserialize(string json, Type type)
    {
        return JsonSerializer.Deserialize(json, type, _options);
    }
}
