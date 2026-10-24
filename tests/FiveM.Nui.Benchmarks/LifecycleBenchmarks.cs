using BenchmarkDotNet.Attributes;
using FiveM.Nui.Hosting;
using FiveM.Nui.Lifecycle;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Benchmarks simulating realistic lifecycle usage patterns.
/// </summary>
[MemoryDiagnoser]
public class LifecycleBenchmarks
{
    [Benchmark]
    public bool FullPageLoad_Sequence()
    {
        var stateMachine = new NuiStateMachine(NullNuiLogger.Instance);
        var ready = stateMachine.MarkReady("page loaded");
        var visible = stateMachine.MarkVisible("window focused");
        return ready && visible;
    }

    [Benchmark]
    public bool TabSwitch_Sequence()
    {
        var stateMachine = new NuiStateMachine(NullNuiLogger.Instance);
        stateMachine.MarkReady("ready");
        var hidden = stateMachine.MarkHidden("lost focus");
        var visible = stateMachine.MarkVisible("regained focus");
        var disposed = stateMachine.MarkDisposed("cleanup");
        return hidden && visible && disposed;
    }

    [Benchmark]
    public string ToString_ForLogging()
    {
        var stateMachine = new NuiStateMachine(NullNuiLogger.Instance);
        stateMachine.MarkReady("ready");
        return stateMachine.ToString();
    }

    [Benchmark]
    public NuiLifecycleState GetCurrentState()
    {
        var stateMachine = new NuiStateMachine(NullNuiLogger.Instance);
        return stateMachine.Current;
    }
}