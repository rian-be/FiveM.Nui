# FiveM.Nui.Contracts (CLI Generator)

A command-line tool that generates strongly typed TypeScript definitions and the `NuiEventMap` module augmentation directly from compiled C# assemblies (`.dll`).

It automatically inspects C# types decorated with `[NuiContract]` and `[NuiEvent]` attributes and converts them into corresponding TypeScript interfaces, complete with TSDoc documentation comments parsed from C# XML documentation files.

---

## 🚀 Usage

### 1. Running via `dotnet run` (within the repository):
```bash
dotnet run --project tools/FiveM.Nui.Contracts -- \
  -a path/to/MyResource.Shared.dll \
  -o web/src/contracts.ts
```

### 2. Command-Line Options:

| Option | Description | Default |
|---|---|---|
| `-a, --assembly <path>` | Path to the compiled C# assembly `.dll` (required; repeatable for multiple assemblies). | *(required)* |
| `-o, --output <path>` | Path to the output TypeScript file. | `contracts.ts` |
| `-n, --namespace <ns>` | Filters code generation to types within a specific namespace. | all namespaces |
| `-t, --type <full-name>`| Generates TypeScript definitions for a specific fully-qualified type name. | all `[NuiContract]` types |
| `-d, --doc <path>` | Path to the XML documentation file used to emit TSDoc comments. | sibling `.xml` next to the `.dll` |
| `--null <optional\|nullable>` | Style for nullable members: `optional` (`name?: T`) or `nullable` (`name: T \| null`). | `optional` |
| `--no-event-map` | Disables emitting the `declare module '@fivem-nui/core' { interface NuiEventMap { ... } }` block. | enabled |
| `--core-module <name>` | The module name augmented with the event map. | `@fivem-nui/core` |
| `--stdout` | Emits generated TypeScript code to standard output (stdout) instead of writing to a file. | `false` |
| `-h, --help` | Displays usage help and lists available options. | — |

---

## 💡 Frontend Integration (`package.json`)

You can wire contract generation into your frontend build scripts:

```json
{
  "scripts": {
    "contracts": "dotnet run --project ../../tools/FiveM.Nui.Contracts -- -a ../src/Shared/bin/Debug/net10.0/MyResource.Shared.dll -o src/contracts.ts",
    "build": "npm run contracts && vite build"
  }
}
```

For the comprehensive guide on declaring C# attributes and integrating with MSBuild, see the documentation:  
👉 **[docs/developers/contracts.md](../../docs/developers/contracts.md)**