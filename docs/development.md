# Development

Everything builds with the .NET 10 SDK and Node.js see [Requirements](../README.md#requirements).

## Repository layout

| Path | Contents |
|---|---|
| `src/` | `FiveM.Nui`, the C# library. |
| `tools/FiveM.Nui.Contracts/` | The contract generator CLI. |
| `tests/` | C# unit tests and BenchmarkDotNet benchmarks. |
| `packages/fivem-nui/core/` | The `@fivem-nui/core` TypeScript package. |
| `docs/` | This documentation. |

## Build

The C# solution:

```bash
dotnet build
```

This compiles the library, the contract generator, the tests, and the benchmarks. Build a single project by passing its path, for example `dotnet build src/FiveM.Nui.csproj`.

The TypeScript package:

```bash
cd packages/fivem-nui/core
npm install
npm run build
```

## Tests

The solution has two C# test projects, both written with xUnit:

| Project | Covers |
|---|---|
| `tests/FiveM.Nui.Tests` | The library: messaging, callbacks, lifecycle, windows, serialization. |
| `tests/FiveM.Nui.Contracts.Tests` | The contract generator: type mapping, events, TSDoc, determinism. |

Run both, or one:

```bash
dotnet test
dotnet test tests/FiveM.Nui.Tests
dotnet test tests/FiveM.Nui.Contracts.Tests
```

Collect coverage with coverlet, which the test projects reference:

```bash
dotnet test tests/FiveM.Nui.Tests --collect:"XPlat Code Coverage"
```

TypeScript tests use vitest:

```bash
cd packages/fivem-nui/core
npm test           # vitest run
npm run test:watch
npm run coverage   # vitest run --coverage
```

`npm run check` type-checks the source and the type-level contract tests (`tsc --noEmit` against both `tsconfig.json` and `tsconfig.types.json`).

## Contract generation

Generate TypeScript contracts from a built assembly:

```bash
dotnet run --project tools/FiveM.Nui.Contracts -- \
  -a path/to/YourResource.dll \
  -n YourResource.Shared \
  -o path/to/web/src/contracts.ts
```

See [Contract generation](contract-generation.md) for the options and the MSBuild integration.

## Benchmarks

Benchmarks use BenchmarkDotNet in `tests/FiveM.Nui.Benchmarks`:

```bash
dotnet run --project tests/FiveM.Nui.Benchmarks -c Release
```

Always run benchmarks in Release. Measure in your own environment rather than assuming an optimization helps.