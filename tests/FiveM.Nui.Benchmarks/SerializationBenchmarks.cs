using BenchmarkDotNet.Attributes;
using FiveM.Nui.Abstractions.Messaging;
using FiveM.Nui.Serialization;
using System.Text.Json;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Comprehensive serialization benchmarks for bottleneck detection.
/// </summary>
[MemoryDiagnoser]
public class SerializationBenchmarks
{
    private readonly INuiSerializer _serializer = new NuiJsonSerializer();

    // Pre-computed test data
    private readonly string _playerSpawnJson;
    private readonly string _chatJson;
    private readonly string _requestJson;
    private readonly string _responseJson;
    private readonly string _smallPayloadJson;
    private readonly string _mediumPayloadJson;
    private readonly string _largePayloadJson;

    public SerializationBenchmarks()
    {
        _playerSpawnJson = _serializer.Serialize(NuiMessage.CreateEvent("game:playerSpawn", new
        {
            PlayerId = 12345,
            Name = "JohnDoe",
            Score = 1500,
            Team = "Red",
            Level = 42,
            Position = new { X = 100.5, Y = 200.3, Z = 50.0 },
            Health = 100
        }));

        _chatJson = _serializer.Serialize(NuiMessage.CreateEvent("game:chat", new
        {
            SenderId = 12345,
            Message = "Hello, World!",
            Channel = "global"
        }));

        _requestJson = _serializer.Serialize(NuiMessage.CreateRequest("req-001", "api:getData", new { PlayerId = 12345 }));
        _responseJson = _serializer.Serialize(NuiMessage.CreateResponse("req-001", true, new { Success = true }));

        // Different payload sizes for bottleneck detection
        _smallPayloadJson = _serializer.Serialize(new { Id = 1, Value = "test" });
        _mediumPayloadJson = _serializer.Serialize(new { Id = 1, Items = Enumerable.Range(0, 10).ToArray(), Position = new { X = 100.0, Y = 200.0 } });
        _largePayloadJson = _serializer.Serialize(new
        {
            Id = 1,
            Data = new string('x', 5000),
            Items = Enumerable.Range(0, 200).Select(i => new { Index = i, Value = i * 10 }).ToArray(),
            Position = new { X = 100.0, Y = 200.0, Z = 50.0 }
        });
    }

    [Benchmark]
    public string Serialize_PlayerSpawnEvent() => _serializer.Serialize(NuiMessage.CreateEvent("game:playerSpawn", new
    {
        PlayerId = 12345,
        Name = "JohnDoe",
        Score = 1500,
        Team = "Red",
        Level = 42,
        Position = new { X = 100.5, Y = 200.3, Z = 50.0 },
        Health = 100
    }));

    [Benchmark]
    public NuiMessage? Deserialize_PlayerSpawnEvent() => _serializer.Deserialize<NuiMessage>(_playerSpawnJson);

    [Benchmark]
    public string Serialize_ChatMessage() => _serializer.Serialize(NuiMessage.CreateEvent("game:chat", new
    {
        SenderId = 12345,
        Message = "Test message for benchmark",
        Channel = "global",
        Timestamp = DateTime.UtcNow
    }));

    [Benchmark]
    public NuiMessage? Deserialize_ChatMessage() => _serializer.Deserialize<NuiMessage>(_chatJson);

    [Benchmark]
    public string RoundTrip_RequestResponse()
    {
        var request = NuiMessage.CreateRequest("req-002", "api:test", new { Data = "test" });
        var json = _serializer.Serialize(request);
        var msg = _serializer.Deserialize<NuiMessage>(json);
        return _serializer.Serialize(msg);
    }

    [Benchmark]
    public JsonElement Deserialize_ToJsonElement() => JsonSerializer.Deserialize<JsonElement>(_chatJson, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });

    // Bottleneck detection benchmarks

    [Benchmark]
    public string Serialize_SmallPayload() => _serializer.Serialize(new { Id = 1, Value = "test", Count = 42 });

    [Benchmark]
    public string Serialize_MediumPayload() => _serializer.Serialize(new
    {
        Id = 1,
        Items = Enumerable.Range(0, 50).Select(i => new { Index = i, Value = i * 10 }).ToArray(),
        Position = new { X = 100.0, Y = 200.0, Z = 50.0 }
    });

    [Benchmark]
    public string Serialize_LargePayload()
    {
        var payload = new
        {
            Id = 1,
            Data = new string('x', 8000),
            Items = Enumerable.Range(0, 100).Select(i => new { Index = i, Value = i * 10, Label = $"Item{i}" }).ToArray(),
            Position = new { X = 100.0, Y = 200.0, Z = 50.0 },
            Meta = new { Created = DateTime.UtcNow, Source = "benchmark" }
        };
        return _serializer.Serialize(payload);
    }

    [Benchmark]
    public NuiMessage? Deserialize_Small() => _serializer.Deserialize<NuiMessage>(_smallPayloadJson);

    [Benchmark]
    public NuiMessage? Deserialize_Medium() => _serializer.Deserialize<NuiMessage>(_mediumPayloadJson);

    [Benchmark]
    public NuiMessage? Deserialize_Large() => _serializer.Deserialize<NuiMessage>(_largePayloadJson);

    [Benchmark]
    public object? Deserialize_ToObject_LargePayload()
    {
        var json = _serializer.Serialize(new
        {
            Id = 1,
            Data = new string('x', 5000),
            Items = Enumerable.Range(0, 50).Select(i => new { Index = i, Value = i * 10 }).ToArray()
        });
        return _serializer.Deserialize(json, typeof(object));
    }

    [Benchmark]
    public NuiMessage? Deserialize_NullPayload()
    {
        // Test with null payload
        return _serializer.Deserialize<NuiMessage>("{\"type\":\"event\",\"event\":\"test\",\"payload\":null}");
    }

    [Benchmark]
    public NuiMessage? Deserialize_EmptyObject()
    {
        // Test with empty payload
        return _serializer.Deserialize<NuiMessage>("{\"type\":\"event\",\"event\":\"test\",\"payload\":{}}");
    }

    [Benchmark]
    public NuiMessage? Deserialize_NumberPayload()
    {
        // Test with number primitive payload
        return _serializer.Deserialize<NuiMessage>("{\"type\":\"event\",\"event\":\"test\",\"payload\":42}");
    }

    [Benchmark]
    public string JsonElement_DeserializeAndReSerialize()
    {
        var element = JsonSerializer.Deserialize<JsonElement>(_playerSpawnJson);
        return element.GetRawText();
    }

    [Benchmark]
    public NuiMessage? Deserialize_UsingSerializer_Direct()
    {
        // Test direct deserialization path
        return _serializer.Deserialize<NuiMessage>(_requestJson);
    }

    [Benchmark]
    public string Serialize_GeneratedType()
    {
        // Using records for serialization benchmark
        return _serializer.Serialize(new GameEvent(
            Id: 12345,
            Type: "playerSpawn",
            Timestamp: DateTime.UtcNow,
            Data: new EventData(100.0, 200.0, 50.0)
        ));
    }

    // Additional bottleneck detection benchmarks

    [Benchmark]
    public NuiMessage? Deserialize_ErrorCase_UnknownType()
    {
        // Test with unknown message type
        return _serializer.Deserialize<NuiMessage>("{\"type\":\"unknown\",\"event\":\"test\",\"payload\":{}}");
    }

    [Benchmark]
    public NuiMessage? Deserialize_ErrorCase_MalformedJson()
    {
        // Test with malformed JSON (will throw, but we want to see the error path cost)
        try
        {
            return _serializer.Deserialize<NuiMessage>("{\"type\":\"event\",\"event\":\"test\",\"payload\":invalid}");
        }
        catch
        {
            return null;
        }
    }

    [Benchmark]
    public string Serialize_WithEnums()
    {
        return _serializer.Serialize(new
        {
            Status = PlayerStatus.Active,
            Role = PlayerRole.Warrior,
            Level = 42
        });
    }

    [Benchmark]
    public NuiMessage? Deserialize_WithEnums()
    {
        return _serializer.Deserialize<NuiMessage>("{\"type\":\"event\",\"event\":\"test\",\"payload\":{\"Status\":\"Active\",\"Role\":\"Warrior\",\"Level\":42}}");
    }

    [Benchmark]
    public object? Deserialize_Polymorphic()
    {
        // Test polymorphic serialization
        object[] items = { 1, "two", 3.0, true, null };
        var json = _serializer.Serialize(items);
        return _serializer.Deserialize(json, typeof(object));
    }

    [Benchmark]
    public int CountAllocations_Serialize()
    {
        // Force multiple allocations to detect GC pressure
        for (int i = 0; i < 100; i++)
        {
            _serializer.Serialize(new { Id = i, Data = new string('x', 100) });
        }
        return 100;
    }

    [Benchmark]
    public int CountAllocations_Deserialize()
    {
        // Force multiple deserializations to detect GC pressure
        var json = _serializer.Serialize(new { Id = 1, Data = "test" });
        for (int i = 0; i < 100; i++)
        {
            _serializer.Deserialize<object>(json);
        }
        return 100;
    }
}

// Types for serialization benchmarks
public record GameEvent(int Id, string Type, DateTime Timestamp, EventData Data);
public record EventData(double X, double Y, double Z);
public enum PlayerStatus { Active, Inactive, Loading, Disconnected }
public enum PlayerRole { Warrior, Mage, Archer, Rogue }
public record PlayerStatusEvent(PlayerStatus Status, string PlayerName, int Level);