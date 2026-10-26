using FiveM.Nui.Serialization;
using FiveM.Nui.Hosting;
using FiveM.Nui.Tests.Support;
using FiveM.Nui.Transport;

namespace FiveM.Nui.Tests.Transport;

public sealed class FiveMNuiTransportTests
{
    [Fact]
    public async Task AlreadyCanceledSend_ShouldReturnCanceledTaskWithoutSending()
    {
        var runtime = new RecordingRuntime();
        var transport = new FiveMNuiTransport(new NuiJsonSerializer(), NullNuiLogger.Instance, runtime);
        using var source = new CancellationTokenSource();
        source.Cancel();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            transport.SendAsync(NuiMessage.CreateEvent("x", 1), source.Token));
        Assert.Empty(runtime.Sent);
    }
}
