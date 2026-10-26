using FiveM.Nui.Abstractions.DevTools;
using FiveM.Nui.Abstractions.Diagnostics;
using FiveM.Nui.Diagnostics;
using FiveM.Nui.Hosting;
using FiveM.Nui.Tests.Support;

namespace FiveM.Nui.Tests.Diagnostics;

public sealed class NuiDevToolsPublisherTests
{
    [Fact]
    public void BuildSample_ComputesAccurateMetricsAndEmitsProtocol()
    {
        var options = new NuiOptions { EnableDiagnostics = true };
        var collector = new NuiDiagnostics(options, NullNuiLogger.Instance);

        collector.IncrementCounter("messages_received");
        collector.IncrementCounter("messages_sent");
        collector.IncrementCounter("requests_completed");
        collector.RecordTiming("request:test", 45);
        collector.RecordPayload(1024);
        collector.RecordOperation(new NuiDiagnosticOperation(1, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(), "outbound", "request", "test", 1024, 45, "ok"));

        string? emittedEvent = null;
        string? emittedJson = null;

        using var publisher = new NuiDevToolsPublisher(
            collector,
            "test-resource",
            new NuiDevToolsOptions { SampleInterval = TimeSpan.FromHours(1), IncludeTimeline = true },
            (ev, json) =>
            {
                emittedEvent = ev;
                emittedJson = json;
            });

        var sample = publisher.PublishSample();

        Assert.Equal(NuiDevToolsProtocol.DiagnosticsEvent, emittedEvent);
        Assert.NotNull(emittedJson);
        Assert.Equal(1, sample.Version);
        Assert.Equal("test-resource", sample.Source);
        Assert.Equal(2, sample.TotalMessages);
        Assert.Equal(1024, sample.TotalBytes);
        Assert.Equal(1, sample.CompletedRequests);
        Assert.Equal(45.0, sample.AverageResponseMs);
        Assert.Single(sample.Operations!);
    }

    [Fact]
    public async Task EnableDevTools_OnClient_StartsPublisherAndDisposesCleanly()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        using (var subscription = client.EnableDevTools(new NuiDevToolsOptions { SampleInterval = TimeSpan.FromMilliseconds(50) }))
        {
            Assert.NotNull(subscription);
        }

        await client.DisposeAsync();
    }
}
