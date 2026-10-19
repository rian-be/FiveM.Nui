---
description: "Developer Quick Start: FiveM.Nui architecture, resource scaffold, C# 14 CoreCLR, Svelte 5, and fxmanifest."
icon: rocket
---

# 🚀 Quick Start & Architecture for Developers

> **The definitive guide to building modern, strictly typed NUI resources with C# 14 (.NET 10 CoreCLR) and Svelte 5 (Runes).**

---

## 1. Communication Architecture

FiveM.Nui eliminates the chaos of arbitrary event strings, untyped JSON, and focus deadlocks:

```
[ C# CoreCLR Client Backend ]             [ Svelte 5 NUI Web Frontend ]
   NuiGateway / IScript                       Svelte 5 Runes ($state)
          │                                              │
          ▼                                              ▼
   INuiMessenger ──(PostMessage / JSON)──► @fivem-nui/core & @fivem-nui/svelte
          ▲                                              │
          │                                              ▼
   RegisterCallback ◄───(HTTP POST Callback)──── nui.request / nui.notify
```

### 4 Architectural Pillars:
1. **Engineered for FiveM Enhanced (CoreCLR / .NET 10)**: Legacy Mono is not supported. Powered by the modern `CitizenFX.FiveM.Client` SDK.
2. **Single Source of Truth**: C# records implementing `INuiRequest<TResponse>` define all contracts. The Roslyn CLI compiles them directly to `contracts.ts`.
3. **Wire-Level CamelCase**: Write standard C# `PascalCase` (`ItemId`), and the serializer automatically maps it to TypeScript `camelCase` (`itemId`).
4. **Managed Window Lifecycle**: `NuiGateway` and the `useNuiWindow` composable coordinate handshakes (`ready`), focus states, and ESC key dismissal automatically.

---

## 2. Resource Project Scaffold

A modern FiveM.Nui resource (patterned after the reference `comps-demo`) separates responsibilities into clear layers:

```
my-resource/
├── fxmanifest.lua
├── src/
│   ├── Shared/                     # Shared DTO contracts
│   │   ├── MyResource.Shared.csproj
│   │   └── Contracts.cs            # [NuiContract] and [NuiEvent]
│   └── Client/                     # Game client & NuiGateway logic
│       ├── MyResource.Client.csproj
│       ├── MyResourceClient.cs     # Implements IScript
│       └── bin/Release/net10.0/publish/
├── web/                            # Frontend app (Svelte 5 + Vite)
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.ts
│       ├── App.svelte
│       └── contracts.ts            # <-- Auto-generated from C#
└── html/                           # Production web directory served by fxmanifest
    ├── index.html
    └── dist/                       # Output of npm run build
```

---

## 3. Package Installation (NuGet & npm)

### Backend C# (.NET 10 / CoreCLR):
Install the NuGet package in your client project:
```bash
dotnet add package FiveM.Nui
```
Or reference it in `MyResource.Client.csproj`:
```xml
<ItemGroup>
  <PackageReference Include="FiveM.Nui" Version="1.*" />
</ItemGroup>
```

### Frontend Svelte 5 (npm):
Inside the `web/` directory, install the official packages:
```bash
npm install @fivem-nui/core @fivem-nui/error @fivem-nui/svelte @fivem-nui/svelte-components svelte@^5.20.0
```

---

## 4. Manifest File: `fxmanifest.lua`

In FiveM Enhanced, the manifest defines the C# entry point and required runtime assemblies output by `dotnet publish`:

```lua
fx_version 'cerulean'
game 'gta5'
lua54 'yes'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/dist/**/*',
    -- CoreCLR (.NET 10) Assemblies:
    'src/Client/bin/Release/net10.0/publish/MyResource.Client.dll',
    'src/Client/bin/Release/net10.0/publish/MyResource.Shared.dll',
    'src/Client/bin/Release/net10.0/publish/FiveM.Nui.dll',
    'src/Client/bin/Release/net10.0/publish/CitizenFX.FiveM.Client.dll',
    'src/Client/bin/Release/net10.0/publish/CitizenFX.FiveM.Shared.dll',
    'src/Client/bin/Release/net10.0/publish/MessagePack.dll',
    'src/Client/bin/Release/net10.0/publish/MessagePack.Annotations.dll',
    'src/Client/bin/Release/net10.0/publish/Microsoft.Extensions.DependencyInjection.dll',
    'src/Client/bin/Release/net10.0/publish/Microsoft.Extensions.DependencyInjection.Abstractions.dll',
}

client_script 'src/Client/bin/Release/net10.0/publish/MyResource.Client.dll'
```

> [!WARNING]
> **Do not use wildcard glob patterns (`*.dll`)!**  
> Never use `'src/Client/bin/Release/net10.0/publish/*.dll'` in `files`.  
> This will inadvertently include `CitizenFX.Base.dll` (a build-time reference stub emitted into `publish/`), triggering **fatal type collisions and CoreCLR runtime failure** during server startup. Always list assemblies explicitly or clean up `CitizenFX.Base.dll` in your build script.

---

## 5. Guide Navigation

Explore the specialized developer guides:

1. [**Automated DTO Contracts**](contracts.md) — Write C# records and compile to `contracts.ts` via Roslyn CLI.
2. [**Backend C# 14 & CoreCLR**](backend-csharp.md) — `NuiGateway`, callbacks, `Publish`, `SendAsync`, and window controls.
3. ⚡ [**Frontend Svelte 5**](frontend-svelte.md) — Svelte 5 Runes: `nui`, `useNuiState`, `useNuiQuery`, and `useNuiWindow`.
4. 🎨 [**UI Components & Design System**](components/README.md) — 20+ ready components from `@fivem-nui/svelte-components`.
5. [**Browser Mocking & Build Pipeline**](browser-mock-and-tools.md) — Vite HMR in Chrome without starting GTA V and build steps.
6. [**Testing without FiveM**](testing.md) — Unit test frontends with `@fivem-nui/core/testing` and captured in-memory traffic.
