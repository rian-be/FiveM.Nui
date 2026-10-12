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
}
