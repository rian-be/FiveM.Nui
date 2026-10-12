using System.Text.Json;

namespace FiveM.Nui.Tests.Support;

/// <summary>
/// Minimal envelope reader for assertions, so tests check the wire shape
/// rather than the C# object.
/// </summary>
internal sealed class NuiMessageParser
{
    public IReadOnlyList<Envelope> Parse(IEnumerable<string> envelopes)
    {
        var result = new List<Envelope>();

        foreach (var raw in envelopes)
        {
            using var document = JsonDocument.Parse(raw);

            result.Add(new Envelope(document.RootElement.Clone()));
        }

        return result;
    }
}

/// <summary>
/// String view over one envelope. Values are returned as plain strings so
/// assertions read naturally and JsonElement boxing stays out of the tests.
/// </summary>
internal sealed class Envelope(JsonElement root)
{
    private readonly JsonElement _root = root;

    public string? this[string key] => _root.TryGetProperty(key, out var value)
        ? value.ValueKind == JsonValueKind.String ? value.GetString() : value.GetRawText()
        : null;

    public string? Code => this["error"] is { } error && error.Contains("code")
        ? ExtractCode()
        : null;

    /// <summary>
    /// Nested object view, so a payload can be asserted without the caller
    /// reaching into <see cref="JsonElement"/> directly.
    /// </summary>
    public Envelope? Object(string key)
    {
        if (!_root.TryGetProperty(key, out var value) || value.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        return new Envelope(value);
    }

    private string? ExtractCode()
    {
        using var document = JsonDocument.Parse(this["error"]!);
        return document.RootElement.TryGetProperty("code", out var code)
            ? code.GetString()
            : null;
    }
}
