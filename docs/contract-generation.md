# Contract generation

Hand-written TypeScript interfaces drift from their C# DTOs and only fail at runtime. `FiveM.Nui.Contracts` generates them from the C# types, so the DTOs stay the source of truth.

Mark the DTOs that cross the bridge with `[NuiContract]`:

```csharp
using FiveM.Nui.Abstractions.Contracts;

[NuiContract]
public sealed record UseItemRequest
{
    public required string ItemId { get; init; }
    public int Quantity { get; init; }
    public InventorySlot? Target { get; init; }
    public IReadOnlyList<string> Tags { get; init; } = [];
    public ItemRarity Rarity { get; init; }
}

[NuiContract]
public enum ItemRarity { Common, Rare, Legendary }
```

Generate a TypeScript module from the built assembly:

```bash
dotnet run --project tools/FiveM.Nui.Contracts -- \
  --assembly path/to/YourResource.dll \
  --namespace YourResource.Shared \
  --output path/to/web/src/contracts.ts
```

```ts
// contracts.ts (generated)
export interface UseItemRequest {
  itemId: string;
  quantity: number;
  target?: InventorySlot;
  tags: string[];
  rarity: ItemRarity;
}

export type ItemRarity =
  | 'common'
  | 'rare'
  | 'legendary';
```

Options:

| Option | Purpose |
|---|---|
| `-a, --assembly <path>` | Assembly to scan. Repeatable and required. |
| `-o, --output <path>` | Output file. Defaults to `contracts.ts`. |
| `-n, --namespace <ns>` | Only generate `[NuiContract]`/`[NuiEvent]` types under this namespace. |
| `-t, --type <full-name>` | Generate a specific type instead of scanning. Repeatable. |
| `--null <mode>` | Nullable member style: `optional` (default) or `nullable`. |
| `--no-event-map` | Do not emit the `NuiEventMap` module augmentation. |
| `--core-module <module>` | Module the event map augments. Defaults to `@fivem-nui/core`. |
| `-d, --doc <path>` | XML documentation file to read summaries from. Repeatable; defaults to the `.xml` next to each assembly. |
| `--stdout` | Write to standard output instead of a file. |

The generator mirrors `NuiJsonSerializer`: member names use the camelCase policy, `[JsonPropertyName]` overrides a name, and `[JsonIgnore]` members are skipped. Enums become string-literal unions, collections become arrays, `Dictionary<string, T>` becomes `Record<string, T>`, `byte[]` becomes `string`, and `object` becomes `unknown`. Referenced types are emitted transitively, so marking a feature's request and response records is enough. Output is deterministic, and colliding names get a namespace prefix.

## Typed events

Bare event-name strings are easy to mistype and only fail at runtime. Mark an event's request/response types with `[NuiEvent]`, and the generator appends a module augmentation for `@fivem-nui/core` that makes the TypeScript client check every event name and infer its payloads:

```csharp
using FiveM.Nui.Abstractions.Contracts;

[NuiEvent("inventory:use")]
public sealed record UseItemCommand : INuiRequest<UseItemResponse>
{
    public required string ItemId { get; init; }
}

[NuiEvent("player:healthChanged")]
public sealed record HealthChanged(int Health);

[NuiEvent("settings:save", Response = typeof(SaveSettingsResponse))]
public sealed record SaveSettingsRequest(string Theme);
```

A type implementing `INuiRequest<TResponse>` pairs itself with `TResponse`. A type with no marker and no request/response is a fire-and-forget payload. Use `Request` and `Response` to state the pair explicitly. The attribute is repeatable, so one contract can back several event names. The examples above produce:

```ts
// contracts.ts (generated, appended)

declare module '@fivem-nui/core' {
  interface NuiEventMap {
    'inventory:use': { request: UseItemCommand; response: UseItemResponse };
    'player:healthChanged': { payload: HealthChanged };
    'settings:save': { request: SaveSettingsRequest; response: SaveSettingsResponse };
  }
}
```

Import the generated module once and the client becomes strict: a mistyped name is a compile error, and request/response types are inferred. The map is opt-in: emitted only when at least one `[NuiEvent]` type is present, and suppressed with `--no-event-map`. Duplicate event names keep the first declaration and emit a warning.

```ts
import './contracts';
import { nui } from '@fivem-nui/core';

const response = await nui.request('inventory:use', { itemId });
response.ok;                       // typed
nui.request('inventory:usee', {}); // compile error
```

## Documentation comments

XML documentation becomes TSDoc. The compiler emits a `.xml` file beside the assembly when `GenerateDocumentationFile` is enabled, and the generator reads it automatically:

```csharp
/// <summary>A request to use an item from the inventory.</summary>
[NuiContract]
public sealed record UseItemRequest
{
    /// <summary>The identifier of the item to use.</summary>
    public required string ItemId { get; init; }
}
```

```ts
// contracts.ts (generated)
/** A request to use an item from the inventory. */
export interface UseItemRequest {
  /** The identifier of the item to use. */
  itemId: string;
}
```

Summaries come from `<summary>`, and record primary-constructor `<param>` tags become per-property comments (`P:` members win when both exist). Inline tags are flattened: `<see>`/`<seealso>` become the referenced name, `<paramref>`/`<typeparamref>` become the parameter name, and `<c>`/`<code>` become inline code. Wrapped lines are reflowed into one paragraph; blank lines and `<para>` start a new one. Pass `--doc` to read a file from another location; it is repeatable and defaults to the `.xml` beside each assembly.

## Generating from MSBuild

Instead of running the tool by hand, enable the target shipped with the `FiveM.Nui` package. Install the CLI once, then opt in from the project that declares the contracts:

```bash
dotnet tool install --global FiveM.Nui.Contracts
```

```xml
<PropertyGroup>
  <GenerateNuiContracts>true</GenerateNuiContracts>
  <NuiContractsOutput>$(MSBuildProjectDirectory)\web\src\contracts.ts</NuiContractsOutput>
  <NuiContractsNamespace>YourResource.Shared</NuiContractsNamespace>
</PropertyGroup>
```

The target runs after `Build`, is incremental (it regenerates only when the assembly changes), and creates the output directory if needed. Overridable properties: `NuiContractsCommand` (default `fivem-nui-contracts`), `NuiContractsOutput`, `NuiContractsNamespace`, and `NuiContractsArgs` for extra arguments. Set `NuiContractsCommand` to `dotnet tool run fivem-nui-contracts` (or another wrapper) when using a local tool.
