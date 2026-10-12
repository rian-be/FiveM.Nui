using FiveM.Nui.Tests.Support;

namespace FiveM.Nui.Tests.Client;

/// <summary>
/// Proves the envelope round-trip that a host cannot reach without wiring the
/// single envelope callback: <c>RequestAsync</c> needs an inbound request to
/// answer, and the answer has to carry the caller's correlation id back.
/// </summary>
public class NuiEnvelopeRoundTripTests
{
    private static readonly NuiMessageParser Parser = new();

    [Fact]
    public async Task RequestAsync_ShouldCompleteWhenPageAnswersWithMatchingId()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions
        {
            Runtime = runtime,
            DefaultTimeout = TimeSpan.FromSeconds(5),
        });

        client.RegisterCallback<string, string>(
            "echo",
            (request, _) => Task.FromResult(NuiResult<string>.Ok(request)));

        // Start the request without awaiting: the page cannot answer until the
        // outbound envelope has actually been posted.
        var pending = client.RequestAsync<string, string>("echo", "hello");

        var request = Assert.Single(Parser.Parse(runtime.Sent));
        Assert.Equal("request", request["type"]);
        Assert.Equal("echo", request["event"]);

        var correlationId = request["id"];

        // Answer exactly as the page would, echoing the correlation id.
        var response =
            "{\"id\":\"" + correlationId + "\",\"type\":\"response\",\"success\":true,\"payload\":\"hello\"}";
        client.ReceiveFromNui(response);

        Assert.Equal("hello", await pending);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task RequestAsync_ShouldFailWithErrorCodeFromPage()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions
        {
            Runtime = runtime,
            DefaultTimeout = TimeSpan.FromSeconds(5),
        });

        client.RegisterCallback<string, string>(
            "boom",
            (_, _) => Task.FromResult(NuiResult<string>.Fail("NOPE", "handler said no")));

        var pending = client.RequestAsync<string, string>("boom", "go");

        var correlationId = Assert.Single(Parser.Parse(runtime.Sent))["id"];

        var response = "{\"id\":\"" + correlationId + "\",\"type\":\"response\",\"success\":false," + 
            "\"error\":{\"code\":\"NOPE\",\"message\":\"handler said no\"}}";
        client.ReceiveFromNui(response);

        var exception = await Assert.ThrowsAsync<NuiException>(() => pending);
        Assert.Equal("NOPE", exception.ErrorCode);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task Subscribe_ShouldReceiveEventWithMatchingName()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        var received = new List<string>();
        client.Subscribe<string>("tick", received.Add);

        client.ReceiveFromNui("""{"type":"event","event":"tick","payload":"one"}""");
        client.ReceiveFromNui("""{"type":"event","event":"tick","payload":"two"}""");

        Assert.Equal(["one", "two"], received);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task Unsubscribe_ShouldStopDelivery()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        var count = 0;
        var subscription = client.Subscribe<string>("tick", _ => count++);

        client.ReceiveFromNui("""{"type":"event","event":"tick","payload":"one"}""");
        subscription.Dispose();
        client.ReceiveFromNui("""{"type":"event","event":"tick","payload":"two"}""");

        Assert.Equal(1, count);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task OutboundEnvelope_ShouldCarryCamelCaseShape()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        await client.SendAsync("mc_state", new { visible = true, phase = "ready" });

        var envelope = Assert.Single(Parser.Parse(runtime.Sent));
        Assert.Equal("event", envelope["type"]);
        Assert.Equal("mc_state", envelope["event"]);

        // Camel cased because the JS bridge reads these keys verbatim.
        var payload = Assert.IsType<Envelope>(envelope.Object("payload"));
        Assert.Equal("true", payload["visible"]);
        Assert.Equal("ready", payload["phase"]);

        await client.DisposeAsync();
    }
}