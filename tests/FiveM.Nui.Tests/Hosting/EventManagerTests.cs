using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;

namespace FiveM.Nui.Tests.Hosting;

/// <summary>
/// Covers the event bus: subscription, disposal-based unsubscription, fan-out to
/// every listener, and isolation between distinct event names.
/// </summary>
public class EventManagerTests
{
    private readonly EventManager _eventManager = new(NullNuiLogger.Instance);
    private readonly INuiSerializer _serializer = new NuiJsonSerializer();

    [Fact]
    public void Subscribe_Should_AddListener()
    {
        var called = false;
        _eventManager.Subscribe<string>("test:event", _ => called = true);

        _eventManager.Publish("test:event", "\"data\"", _serializer);

        Assert.True(called);
    }

    [Fact]
    public void Unsubscribe_Should_RemoveListener()
    {
        var callCount = 0;
        var unsubscribe = _eventManager.Subscribe<string>("test:event", _ => callCount++);

        _eventManager.Publish("test:event", "\"data1\"", _serializer);
        unsubscribe.Dispose();
        _eventManager.Publish("test:event", "\"data2\"", _serializer);

        Assert.Equal(1, callCount);
    }

    [Fact]
    public void MultipleListeners_Should_AllBeCalled()
    {
        var callCount = 0;
        _eventManager.Subscribe<string>("test:event", _ => callCount++);
        _eventManager.Subscribe<string>("test:event", _ => callCount++);
        _eventManager.Subscribe<string>("test:event", _ => callCount++);

        _eventManager.Publish("test:event", "\"data\"", _serializer);

        Assert.Equal(3, callCount);
    }

    [Fact]
    public void DifferentEvents_Should_NotInterfere()
    {
        var event1Called = false;
        var event2Called = false;

        _eventManager.Subscribe<string>("event1", _ => event1Called = true);
        _eventManager.Subscribe<string>("event2", _ => event2Called = true);

        _eventManager.Publish("event1", "\"data\"", _serializer);

        Assert.True(event1Called);
        Assert.False(event2Called);
    }

    [Fact]
    public async Task ConcurrentSubscribeAndDispose_ShouldNotLoseNewListener()
    {
        for (var iteration = 0; iteration < 500; iteration++)
        {
            var manager = new EventManager(NullNuiLogger.Instance);
            var old = manager.Subscribe<string>("race", _ => { });
            var called = false;
            await Task.WhenAll(
                Task.Run(old.Dispose),
                Task.Run(() => manager.Subscribe<string>("race", _ => called = true)));

            manager.Publish("race", "\"value\"", _serializer);
            Assert.True(called);
        }
    }
}
