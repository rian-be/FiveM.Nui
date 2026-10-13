using FiveM.Nui.Tests.Support;

namespace FiveM.Nui.Tests.Client;

/// <summary>
/// Covers cancellation of an in-flight request. A caller-cancelled request must
/// be reported as a cancellation, not folded into the timeout bucket.
/// </summary>
public class RequestCancellationTests
{
    [Fact]
    public async Task RequestAsync_CallerCancellation_Should_CountAsCancelledNotTimeout()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions
        {
            Runtime = runtime,
            EnableDiagnostics = true,
        });

        using var cts = new CancellationTokenSource();

        var pending = client.RequestAsync<object, string>("slow:op", new { }, cts.Token);

        cts.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);

        var counters = client.GetDiagnostics().Counters;

        Assert.True(counters.TryGetValue("requests_cancelled", out var cancelled));
        Assert.Equal(1, cancelled);
        Assert.False(counters.ContainsKey("requests_timeout"));

        await client.DisposeAsync();
    }

    [Fact]
    public async Task RequestAsync_Timeout_Should_CountAsTimeoutNotCancellation()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions
        {
            Runtime = runtime,
            EnableDiagnostics = true,
            DefaultTimeout = TimeSpan.FromMilliseconds(20),
        });

        var pending = client.RequestAsync<object, string>("slow:op", new { });

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);

        var counters = client.GetDiagnostics().Counters;

        Assert.True(counters.TryGetValue("requests_timeout", out var timedOut));
        Assert.Equal(1, timedOut);
        Assert.False(counters.ContainsKey("requests_cancelled"));

        await client.DisposeAsync();
    }
}
