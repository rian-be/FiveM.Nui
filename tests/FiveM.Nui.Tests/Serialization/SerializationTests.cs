using FiveM.Nui.Serialization;

namespace FiveM.Nui.Tests.Serialization;

/// <summary>
/// Covers the JSON contract the message pipeline depends on: camelCase property
/// names on the wire and an envelope that survives a full serialize/deserialize
/// round-trip.
/// </summary>
public class SerializationTests
{
    private readonly INuiSerializer _serializer = new NuiJsonSerializer();

    [Fact]
    public void Serialize_Should_CamelCaseProperties()
    {
        var message = NuiMessage.CreateEvent("test:event", new { TestValue = 123 });
        var json = _serializer.Serialize(message);

        Assert.Contains("testValue", json);
        Assert.DoesNotContain("TestValue", json);
    }

    [Fact]
    public void Deserialize_Should_HandleNullProperties()
    {
        var json = "{\"type\":\"event\",\"event\":\"test\",\"payload\":null}";
        var message = _serializer.Deserialize<NuiMessage>(json);

        Assert.NotNull(message);
        Assert.Null(message.Payload);
    }

    [Fact]
    public void Serialize_Deserialize_RoundTrip()
    {
        var original = NuiMessage.CreateRequest("test-id", "test:event", new { Value = "test" });
        var json = _serializer.Serialize(original);
        var deserialized = _serializer.Deserialize<NuiMessage>(json);

        Assert.NotNull(deserialized);
        Assert.Equal(original.Id, deserialized.Id);
        Assert.Equal(original.Type, deserialized.Type);
        Assert.Equal(original.Event, deserialized.Event);
    }
}
