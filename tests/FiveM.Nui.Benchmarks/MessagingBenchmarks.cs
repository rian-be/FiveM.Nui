using BenchmarkDotNet.Attributes;
using FiveM.Nui.Abstractions.Messaging;
using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;
using System.Threading.Tasks;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Messaging benchmarks for bottleneck detection at the NuiClient level.
/// </summary>
[MemoryDiagnoser]
public class MessagingBenchmarks
{
    private NuiClient? _client;
    private INuiSerializer _serializer = new NuiJsonSerializer();
    private NuiMessage _testMessage = null!;
    private string _testJson = string.Empty;
    private FakeNuiRuntime _runtime = null!;

    [GlobalSetup]
    public void Setup()
    {
        _runtime = new FakeNuiRuntime();
        var options = new NuiOptions
        {
            DefaultTimeout = TimeSpan.FromSeconds(30),
            MaxPayloadSize = 1024 * 1024,
            EnableDiagnostics = false,
            EnableDebugLogging = false,
            Runtime = _runtime
        };

        _client = new NuiClient(options);
        _testMessage = NuiMessage.CreateEvent("test:event", new { Message = "Hello, World!" });
        _testJson = _serializer.Serialize(_testMessage);
    }

    [GlobalCleanup]
    public async ValueTask Cleanup()
    {
        if (_client != null)
            await _client.DisposeAsync();
    }

    [Benchmark]
    public async Task SendAsync_Event() => await _client!.SendAsync("game:event", new { Position = new { X = 100.5, Y = 200.3 } });

    [Benchmark]
    public void Publish_Event() => _client!.Publish("game:update", new { Health = 100, Ammo = 50 });

    [Benchmark]
    public string Serialize_Deserialize_RoundTrip()
    {
        var json = _serializer.Serialize(_testMessage);
        var msg = _serializer.Deserialize<NuiMessage>(json);
        return _serializer.Serialize(msg);
    }

    // Bottleneck detection benchmarks

    [Benchmark]
    public async Task SendAsync_SmallPayload()
    {
        await _client!.SendAsync("test:small", new { Id = 1, Value = "test" });
    }

    [Benchmark]
    public async Task SendAsync_LargePayload()
    {
        await _client!.SendAsync("test:large", new
        {
            Data = new string('x', 8000),
            Items = Enumerable.Range(0, 50).Select(i => new { Index = i, Value = i * 10 }).ToArray()
        });
    }

    [Benchmark]
    public void Publish_FireAndForget()
    {
        _client!.Publish("game:notification", new
        {
            Title = "Test Notification",
            Message = "This is a test message",
            Duration = 5000
        });
    }

    [Benchmark]
    public async Task SendAsync_Batched()
    {
        for (int i = 0; i < 5; i++)
        {
            await _client!.SendAsync($"game:event{i}", new { Index = i, Timestamp = DateTime.UtcNow });
        }
    }

    [Benchmark]
    public NuiMessage CreateEvent_Message()
    {
        return NuiMessage.CreateEvent("test:event", new { Id = 1, Name = "test", Value = 42 });
    }

    [Benchmark]
    public NuiMessage CreateRequest_Message()
    {
        return NuiMessage.CreateRequest("req-001", "api:test", new { PlayerId = 123, Action = "test" });
    }

    [Benchmark]
    public NuiMessage CreateResponse_Message()
    {
        return NuiMessage.CreateResponse("req-001", true, new { Success = true, Data = new { X = 1, Y = 2 } });
    }

    [Benchmark]
    public void TraceIncoming_Valid()
    {
        _client!.TraceIncoming(_testJson);
    }

    [Benchmark]
    public void TraceOutgoing_Message()
    {
        _client!.TraceOutgoing(_testMessage);
    }

    [Benchmark]
    public string SerializeAndDeserialize_ComplexObject()
    {
        var obj = new
        {
            Player = new { Id = 123, Name = "JohnDoe", Level = 42 },
            Position = new { X = 100.5, Y = 200.3, Z = 50.0 },
            Stats = new { Health = 100, Armor = 85, Ammo = 50 },
            Inventory = Enumerable.Range(0, 10).Select(i => new { ItemId = i, Quantity = i * 3 }).ToArray()
        };

        var json = _serializer.Serialize(obj);
        return _serializer.Serialize(_serializer.Deserialize<object>(json));
    }

    [Benchmark]
    public async Task RequestAsync_Successful()
    {
        var pending = _client!.RequestAsync<int, int>("test:request", 42);
        var request = _serializer.Deserialize<NuiMessage>(_runtime.LastMessage!)!;
        _client.ReceiveFromNui(_serializer.Serialize(
            NuiMessage.CreateResponse(request.Id!, true, 42)));
        await pending;
    }

    [Benchmark]
    public NuiMessage? RoundTrip_Deserialization()
    {
        return _serializer.Deserialize<NuiMessage>(_testJson);
    }
}
