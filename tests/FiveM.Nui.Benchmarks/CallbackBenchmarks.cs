using BenchmarkDotNet.Attributes;
using FiveM.Nui.Callbacks;
using FiveM.Nui.Hosting;
using FiveM.Nui.Serialization;
using System.Threading.Tasks;

namespace FiveM.Nui.Benchmarks;

/// <summary>
/// Benchmarks simulating realistic callback usage patterns.
/// </summary>
[MemoryDiagnoser]
public class CallbackBenchmarks
{
    private INuiCallbackRegistry _registry = null!;
    private INuiSerializer _serializer = null!;

    [GlobalSetup]
    public void Setup()
    {
        var logger = NullNuiLogger.Instance;
        _registry = new NuiCallbackRegistry(logger);
        _serializer = new NuiJsonSerializer();

        _registry.Register<int, int>("game:double", async (value, ct) => NuiResult<int>.Ok(value * 2));
        _registry.Register<string, string>("game:echo", async (value, ct) => NuiResult<string>.Ok(value));
    }

    [Benchmark]
    public INuiCallbackHandler? GetHandler()
    {
        return _registry.GetHandler("game:double");
    }

    [Benchmark]
    public async Task Execute_Callback()
    {
        var handler = _registry.GetHandler("game:double");
        if (handler != null)
        {
            await handler.ExecuteAsync(21, _serializer, default);
        }
    }

    [Benchmark]
    public bool RegisterAndUnregister()
    {
        _registry.Register<int, int>("bench:temp", async (v, ct) => NuiResult<int>.Ok(v));
        return _registry.Unregister("bench:temp");
    }
}