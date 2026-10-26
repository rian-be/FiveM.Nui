using BenchmarkDotNet.Attributes;
using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Benchmarks simulating realistic event routing usage patterns.
/// </summary>
[MemoryDiagnoser]
public class EventRoutingBenchmarks
{
    private EventManager _eventManager = null!;
    private INuiSerializer _serializer = null!;

    [GlobalSetup]
    public void Setup()
    {
        _eventManager = new EventManager(NullNuiLogger.Instance);
        _serializer = new NuiJsonSerializer();

        _eventManager.Subscribe<object>("game:chat", HandleEvent);
        _eventManager.Subscribe<object>("game:update", HandleEvent);
    }

    [Benchmark]
    public void Broadcast_PlayerStatus()
    {
        var payload = new { PlayerId = 12345, Health = 95, Position = new { X = 100.5, Y = 200.3 } };
        var json = _serializer.Serialize(payload);
        _eventManager.Publish("game:update", json, _serializer);
    }

    [Benchmark]
    public void Broadcast_ChatMessage()
    {
        var payload = new { SenderId = 12345, Message = "Hello, World!", Channel = "global" };
        var json = _serializer.Serialize(payload);
        _eventManager.Publish("game:chat", json, _serializer);
    }

    [Benchmark]
    public void SubscribeAndUnsubscribe()
    {
        var sub = _eventManager.Subscribe<object>("bench:temp", HandleEvent);
        sub.Dispose();
    }

    private static void HandleEvent<T>(T payload) { }
}