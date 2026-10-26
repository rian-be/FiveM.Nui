using BenchmarkDotNet.Running;
using FiveM.Nui.Benchmarks;

namespace FiveM.Nui.Benchmarks;

public class Program
{
    public static void Main(string[] args)
    {
        BenchmarkSwitcher.FromAssembly(typeof(Program).Assembly).Run(args);
    }
}
