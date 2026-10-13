namespace FiveM.Nui.Contracts.Tests;

/// <summary>
/// Shared helpers for the contract generator tests.
/// </summary>
public abstract class ContractGeneratorTestBase
{
    /// <summary>
    /// Generates TypeScript for the given root contract types using default
    /// options.
    /// </summary>
    /// <param name="roots">The root contract types to emit.</param>
    /// <returns>The generated TypeScript source.</returns>
    protected static string Gen(params Type[] roots) =>
        new ContractGenerator().Generate(roots);
}
