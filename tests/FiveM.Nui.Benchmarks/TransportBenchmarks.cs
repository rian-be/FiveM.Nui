using BenchmarkDotNet.Attributes;
using FiveM.Nui.Abstractions.Hosting;
using FiveM.Nui.Abstractions.Messaging;
using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;
using FiveM.Nui.Transport;
using System.Threading.Tasks;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Transport-level benchmarks for bottleneck detection.
/// </summary>
[MemoryDiagnoser]
public class TransportBenchmarks
{
    private FiveMNuiTransport _transport = null!;
    private INuiSerializer _serializer = null!;
    private NuiMessage _testMessage = null!;
    private string _testJson = string.Empty;
    private string _largeJson = string.Empty;

    [GlobalSetup]
    public void Setup()
    {
        _serializer = new NuiJsonSerializer();
        var logger = NullNuiLogger.Instance;
        var runtime = new FakeNuiRuntime();
        _transport = new FiveMNuiTransport(_serializer, logger, runtime);
        _testMessage = NuiMessage.CreateEvent("test:event", new { Data = "benchmark" });
        _testJson = _serializer.Serialize(_testMessage);
        _largeJson = _serializer.Serialize(NuiMessage.CreateEvent("test:large", new
        {
            Items = Enumerable.Range(0, 100).Select(i => new { Id = i, Value = i * 10 }).ToArray()
        }));
    }

    [Benchmark]
    public Task SendAsync() => _transport.SendAsync(_testMessage, default);

    [Benchmark]
    public void OnMessageReceived() => _transport.OnMessageReceived(_testJson);

    [Benchmark]
    public void SubscribeAndUnsubscribe()
    {
        var sub = _transport.Subscribe(OnHandlerReceived);
        sub.Dispose();
    }

    [Benchmark]
    public async Task RequestResponseCycle()
    {
        var request = NuiMessage.CreateRequest("req-001", "fetchData", new { Id = 123 });
        await _transport.SendAsync(request, default);

        var response = NuiMessage.CreateResponse("req-001", true, new { Success = true });
        _transport.OnMessageReceived(_serializer.Serialize(response));
    }

    // Bottleneck detection benchmarks

    [Benchmark]
    public void SendAsync_LargeMessage()
    {
        _transport.SendAsync(NuiMessage.CreateEvent("test:large", new
        {
            Data = new string('x', 10000),
            Items = Enumerable.Range(0, 50).ToArray()
        }), default);
    }

    [Benchmark]
    public void OnMessageReceived_Large()
    {
        _transport.OnMessageReceived(_largeJson);
    }

    [Benchmark]
    public void Multiple_Sends()
    {
        for (int i = 0; i < 5; i++)
        {
            _transport.SendAsync(NuiMessage.CreateEvent($"test:event{i}", new { Index = i }), default);
        }
    }

    [Benchmark]
    public void Multiple_Receives()
    {
        for (int i = 0; i < 5; i++)
        {
            _transport.OnMessageReceived(_testJson);
        }
    }

    [Benchmark]
    public IDisposable Subscribe_WithMultipleSubscribers()
    {
        // Simulate multiple subscribers
        for (int i = 0; i < 10; i++)
        {
            _transport.Subscribe((Action<NuiMessage>)((msg) => { }));
        }
        var finalSub = _transport.Subscribe(OnHandlerReceived);
        return finalSub;
    }

    [Benchmark]
    public void MessageHandler_InvokeAll()
    {
        var handlers = new List<Action<NuiMessage>>();
        for (int i = 0; i < 20; i++)
        {
            handlers.Add(msg => { });
        }

        foreach (var h in handlers)
        {
            h(_testMessage);
        }
    }

    [Benchmark]
    public void DeserializedMessage_Processing()
    {
        var message = _serializer.Deserialize<NuiMessage>(_testJson);
        if (message != null)
        {
            _ = message.Type;
            _ = message.Event;
            _ = message.Payload?.ToString();
        }
    }

    [Benchmark]
    public void SerializeAndDeserialize_SinglePayload()
    {
        var json = _serializer.Serialize(new { Test = "value", Number = 123 });
        _serializer.Deserialize<NuiMessage>(json);
    }

    [Benchmark]
    public async Task SendAndReceive_Batched()
    {
        var messages = Enumerable.Range(0, 5)
            .Select(i => NuiMessage.CreateEvent($"batch:event{i}", new { Index = i }))
            .ToArray();

        foreach (var msg in messages)
        {
            await _transport.SendAsync(msg, default);
        }

        foreach (var msg in messages)
        {
            _transport.OnMessageReceived(_serializer.Serialize(msg));
        }
    }

    private static void OnHandlerReceived(NuiMessage message) { }
}

internal class FakeNuiRuntime : INuiRuntime
{
    public string? LastMessage { get; private set; }
    public string ResourceName => "Test";
    public void SendNuiMessage(string json) => LastMessage = json;
    public void SetNuiFocus(bool focus) { }
}
