using FiveM.Nui.Hosting;
using FiveM.Nui.Lifecycle;
using FiveM.Nui.Tests.Support;

namespace FiveM.Nui.Tests.Lifecycle;

/// <summary>
/// Covers the lifecycle machine: the enum existed with zero uses, so nothing
/// previously checked that a reported state matched what the runtime did.
/// </summary>
public class NuiLifecycleTests
{
    private static NuiStateMachine Machine()
    {
        // The null logger keeps refusal warnings out of the test output; the
        // state transitions themselves are what these tests assert.
        return new NuiStateMachine(NullNuiLogger.Instance);
    }

    [Fact]
    public void ShouldStartInCreated()
    {
        Assert.Equal(NuiLifecycleState.Created, Machine().Current);
    }

    [Fact]
    public void ShouldFollowNormalReadyVisibleHiddenCycle()
    {
        var machine = Machine();

        Assert.True(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Ready, machine.Current);

        Assert.True(machine.MarkVisible());
        Assert.Equal(NuiLifecycleState.Visible, machine.Current);

        Assert.True(machine.MarkHidden());
        Assert.Equal(NuiLifecycleState.Hidden, machine.Current);
    }

    [Fact]
    public void ShouldRefuseVisibleBeforeReady()
    {
        var machine = Machine();

        // Created -> Visible is not a legal transition; a window cannot be
        // visible before its page reported ready.
        Assert.False(machine.MarkVisible());
        Assert.Equal(NuiLifecycleState.Created, machine.Current);
    }

    [Fact]
    public void ShouldRefuseReadyFromVisible()
    {
        var machine = Machine();
        machine.MarkReady();
        machine.MarkVisible();

        // The page is already up; a late "ready" would rewind the state.
        Assert.False(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Visible, machine.Current);
    }

    [Fact]
    public void ShouldTreatRepeatedTransitionAsNoOp()
    {
        var machine = Machine();

        Assert.True(machine.MarkReady());
        Assert.True(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Ready, machine.Current);
    }

    [Fact]
    public void DisposedShouldBeTerminal()
    {
        var machine = Machine();
        machine.MarkReady();

        Assert.True(machine.MarkDisposed());
        Assert.Equal(NuiLifecycleState.Disposed, machine.Current);
        Assert.True(machine.IsDisposed);

        // Nothing may resurrect a disposed machine.
        Assert.False(machine.MarkVisible());
        Assert.False(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Disposed, machine.Current);
    }

    [Fact]
    public void DoubleDisposeShouldBeVisible()
    {
        var machine = Machine();

        Assert.True(machine.MarkDisposed());

        // Returns false rather than throwing so a teardown path that runs twice
        // is logged, not crashed.
        Assert.False(machine.MarkDisposed());
    }

    [Fact]
    public void ShouldAllowReloadAfterVisible()
    {
        var machine = Machine();
        machine.MarkReady();
        machine.MarkVisible();

        // A client reconnect tears the page down and rebuilds it.
        Assert.True(machine.MarkLoading());
        Assert.Equal(NuiLifecycleState.Loading, machine.Current);

        Assert.True(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Ready, machine.Current);
    }

    [Fact]
    public void ShouldRaiseStateChangedForAcceptedTransitionsOnly()
    {
        var machine = Machine();
        var observed = new List<(NuiLifecycleState From, NuiLifecycleState To)>();
        machine.StateChanged += (from, to) => observed.Add((from, to));

        machine.MarkReady();
        machine.MarkVisible();
        machine.MarkReady();       // refused: rewinds Visible -> Ready
        machine.MarkHidden();

        // The refused attempt must not raise the event, or an observer would
        // see a transition the machine did not make.
        Assert.Equal(
            [
                (NuiLifecycleState.Created, NuiLifecycleState.Ready),
                (NuiLifecycleState.Ready, NuiLifecycleState.Visible),
                (NuiLifecycleState.Visible, NuiLifecycleState.Hidden),
            ],
            observed);
    }

    [Fact]
    public void ThrowingHandlerShouldNotStrandTheMachine()
    {
        var machine = Machine();
        machine.StateChanged += (_, _) => throw new InvalidOperationException("handler blew up");

        // The transition still applies even though the observer failed.
        Assert.True(machine.MarkReady());
        Assert.Equal(NuiLifecycleState.Ready, machine.Current);
    }

    [Fact]
    public async Task ClientShouldStartInCreatedAndReachReadyOnInboundTraffic()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        Assert.Equal(NuiLifecycleState.Created, client.LifecycleState);

        // Any traffic from the page proves it booted.
        client.ReceiveFromNui("""{"id":"1","type":"event","event":"noop","payload":{}}""");

        Assert.Equal(NuiLifecycleState.Ready, client.LifecycleState);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task ClientFocusShouldReachVisibleOnlyAfterRealFocus()
    {
        var runtime = new RecordingRuntime();
        var client = new NuiClient(new NuiOptions { Runtime = runtime });

        await client.OpenAsync("panel");
        Assert.Equal(NuiLifecycleState.Loading, client.LifecycleState);

        // The window manager refuses focus on an unopened window, so the machine
        // must not claim Visible.
        await client.FocusAsync("never-opened");
        Assert.Equal(NuiLifecycleState.Loading, client.LifecycleState);

        client.ReceiveFromNui("""{"id":"1","type":"event","event":"noop","payload":{}}""");
        await client.FocusAsync("panel");
        Assert.Equal(NuiLifecycleState.Visible, client.LifecycleState);

        await client.UnfocusAsync("panel");
        Assert.Equal(NuiLifecycleState.Hidden, client.LifecycleState);

        await client.DisposeAsync();
    }

    [Fact]
    public async Task DisposedClientShouldReportDisposed()
    {
        var client = new NuiClient(new NuiOptions { Runtime = new RecordingRuntime() });

        await client.DisposeAsync();

        Assert.Equal(NuiLifecycleState.Disposed, client.LifecycleState);
        Assert.True(client.Lifecycle.IsDisposed);
    }
}