using FiveM.Nui.Tests.Support;

namespace FiveM.Nui.Tests.Client;

internal sealed record HealthChanged(int Health);

/// <summary>
/// Covers the inbound/outbound envelope flow through <c>NuiClient</c> against a
/// recording runtime: correlation ids on callback replies and errors, window
/// ownership, event publishing and payload-size enforcement.
/// </summary>
public class NuiClientCorrelationTests
{
    private static readonly NuiMessageParser Parser = new();

    [Fact]
    public async Task CallbackResponse_Should_CarryCallerCorrelationId()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        client.RegisterCallback<string, string>(
            "echo",
            (request, _) => Task.FromResult(NuiResult<string>.Ok(request)));

        client.ReceiveFromNui("""
            {"id":"abc-123","type":"request","event":"echo","payload":"hello"}
            """);

        var response = Assert.Single(Parser.Parse(runtime.Sent));

        Assert.Equal("response", response["type"]);
        Assert.Equal("abc-123", response["id"]);
        Assert.Equal("hello", response["payload"]);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task UnknownCallback_Should_ReturnErrorWithCorrelationId()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        client.ReceiveFromNui("""
            {"id":"xyz","type":"request","event":"nope","payload":{}}
            """);

        var response = Assert.Single(Parser.Parse(runtime.Sent));

        Assert.Equal("xyz", response["id"]);
        Assert.Equal("UNKNOWN_CALLBACK", response.Code);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task OpenWindow_Should_PostOpenEnvelope()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        await client.OpenAsync("panel");

        var envelope = Assert.Single(Parser.Parse(runtime.Sent));
        Assert.Equal("open", envelope["type"]);
        Assert.Equal("panel", envelope["event"]);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task Focus_Should_ReachRuntimeAndTrackOwnership()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        await client.OpenAsync("panel");
        await client.FocusAsync("panel");

        Assert.Contains(true, runtime.FocusCalls);
        Assert.Equal("panel", client.GetFocusedWindow());
        Assert.True(client.HasKeyboardOwnership("panel"));

        await client.CloseAsync("panel");

        Assert.Contains(false, runtime.FocusCalls);
        Assert.Null(client.GetFocusedWindow());
        Assert.False(client.HasKeyboardOwnership("panel"));

        await client.DisposeAsync();
    }

    [Fact]
    public async Task Publish_Should_SendEventEnvelopeToRuntime()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        client.Publish("player:healthChanged", new { health = 90 });

        var envelope = Assert.Single(Parser.Parse(runtime.Sent));

        Assert.Equal("event", envelope["type"]);
        Assert.Equal("player:healthChanged", envelope["event"]);
        Assert.Contains("\"health\":90", envelope["payload"]);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task Subscribe_Should_ReceiveEventFromNui()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        HealthChanged? received = null;
        client.Subscribe<HealthChanged>("player:healthChanged", data => received = data);

        client.ReceiveFromNui("""
            {"type":"event","event":"player:healthChanged","payload":{"health":75}}
            """);

        Assert.NotNull(received);
        Assert.Equal(75, received.Health);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task OversizedPayload_Should_BeRejected()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions
        {
            Runtime = runtime,
            MaxPayloadSize = 256,
        });

        var ex = await Assert.ThrowsAsync<NuiException>(
            () => client.SendAsync("big", new string('x', 1024)));

        Assert.Equal("PAYLOAD_TOO_LARGE", ex.ErrorCode);
        Assert.Empty(runtime.Sent);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task UnregisterCallback_Should_ReportWhetherRemoved()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        client.RegisterCallback<string, string>(
            "temp",
            (request, _) => Task.FromResult(NuiResult<string>.Ok(request)));

        Assert.True(client.UnregisterCallback("temp"));
        Assert.False(client.UnregisterCallback("temp"));

        await client.DisposeAsync();
    }

    [Fact]
    public async Task OversizedPublish_Should_BeRejectedBeforeTransport()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime, MaxPayloadSize = 80 });

        var ex = Assert.Throws<NuiException>(() => client.Publish("big", new string('ą', 100)));

        Assert.Equal("PAYLOAD_TOO_LARGE", ex.ErrorCode);
        Assert.Empty(runtime.Sent);
        await client.DisposeAsync();
    }

    [Fact]
    public async Task Reconfigure_Should_PreserveCallbacksEventsAndDisposers()
    {
        var first = new RecordingRuntime();
        var second = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = first });
        var events = 0;
        var subscription = client.Subscribe<HealthChanged>("health", _ => events++);
        client.RegisterCallback<string, string>("echo", (value, _) =>
            Task.FromResult(NuiResult<string>.Ok(value)));

        client.Reconfigure(new NuiOptions { Runtime = second });
        client.ReceiveFromNui("""{"type":"event","event":"health","payload":{"health":1}}""");
        client.ReceiveFromNui("""{"id":"1","type":"request","event":"echo","payload":"ok"}""");

        Assert.Equal(1, events);
        Assert.Single(second.Sent);
        Assert.Empty(first.Sent);
        subscription.Dispose();
        client.ReceiveFromNui("""{"type":"event","event":"health","payload":{"health":2}}""");
        Assert.Equal(1, events);
        await client.DisposeAsync();
    }

    [Fact]
    public async Task Dispose_Should_ReleaseFocusAndBeIdempotent()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });
        await client.OpenAsync("panel");

        await client.DisposeAsync();
        await client.DisposeAsync();

        Assert.Equal(new[] { true, false }, runtime.FocusCalls);
    }
}
