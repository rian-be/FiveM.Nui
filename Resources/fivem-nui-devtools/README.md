# fivem-nui-devtools

Standalone live diagnostics overlay for resources built with FiveM.Nui. Inspects client transport traffic, round-trip latency, payload sizes, message timelines, and resource lifecycle transitions entirely in the local FiveM CEF runtime.

## Architecture

DevTools runs entirely on the client. Inspected resources emit a versioned diagnostic sample once per second over the local client event bus. No telemetry data is sent across the network to the server.

```
[ Monitored Resources ]
         │
         │ Client Event: fivem-nui:diagnostics:v1 (1 Hz)
         ▼
[ fivem-nui-devtools (C# Client) ]
  ├── ProviderManager      - Ingests samples, aggregates metrics, detects stale providers (>3.5s)
  ├── AlertEngine          - Evaluates latency, throughput, payload size, and failure thresholds
  ├── SessionRecorder      - In-memory ring buffer for session capture and JSON export
  └── ResourceInspector    - Queries runtime resource manifests, dependencies, and lifecycle states
         │
         │ NUI Bridge (PostMessage / CEF)
         ▼
[ Svelte 5 NUI Frontend ]
  ├── Overview             - 60-second rolling charts (traffic, latency, bandwidth) and active alerts
  ├── Metrics              - Cumulative message counters, timings per event, and inbound/outbound split
  ├── Timeline             - Bounded message journal with status, duration, and payload inspection
  └── Resources            - Discovered client resource inventory and live lifecycle transition log
```

## Features

- **60-Second Rolling History**: Live charts for messages per second (MPS), average round-trip time (ms), and bandwidth (B/s).
- **Traffic Direction Split**: Inbound (NUI to client) versus outbound (client to NUI) distribution and transport health percentage.
- **Provider Switcher & Aggregation**: Inspect individual resources or an aggregated `All providers` view with per-metric source attribution.
- **Staleness Tracking**: Automatically marks a provider as `STALE` if no sample arrives within 3.5 seconds.
- **Heuristic Alerting**: Flags high latency (>150ms), throughput spikes (>50 msg/s), oversized payloads (>64 KB), bandwidth bursts, and callback failures.
- **Message Timeline**: Bounded journal of recent transport envelopes with filtering by direction, type, and status (`success`, `timeout`, `error`).
- **Resource Inventory & Lifecycle**: Live listing of client resources with manifest metadata, dependencies, NUI markers, and runtime state transitions (`started`, `stopped`).
- **Session Recorder**: In-memory frame capture with JSON export and clipboard copy for debugging.
- **Zero Server Overhead**: Diagnostics run strictly on the local client event bus without generating network traffic.

## Commands

| Command | Permission | Description |
|---|---|---|
| `/nui_devtools` | Open | Toggles passive overlay visibility without capturing input focus. |
| `/nui_devtools_focus` | Open | Toggles interactive mode (captures mouse and keyboard input). |
| `/nui_devtools_record` | ACE (`command.nui_devtools_record`) | Starts an in-memory session recording. |
| `/nui_devtools_stop` | Open | Stops active recording and retains captured frames. |
| `/nui_devtools_clear` | Open | Clears recorded frames from memory. |
| `/fivem_nui_devtools` | Open | Compatibility alias for `/nui_devtools`. |

## Keybindings (Interactive Mode)

When interactive mode is active (`/nui_devtools_focus`):

| Key | Action |
|---|---|
| `Esc` | Closes overlay or active modal and returns input focus to the game. |
| `P` | Pauses or resumes real-time sample updates. |
| `C` | Clears the 60-second rolling history buffer. |
| `M` | Toggles compact HUD mode. |

## Provider Integration

Any resource using `FiveM.Nui` can act as a diagnostics provider by enabling diagnostics in its client options:

```csharp
var options = new NuiOptions
{
    EnableDiagnostics = true
};

var gateway = new NuiGateway(options);
```

When enabled, the resource client script emits a `fivem-nui:diagnostics:v1` event once per second containing throughput counters, latency measurements, and recent operation entries. DevTools excludes its own NUI traffic from provider measurements.

## Installation

Add the resource to your `server.cfg`:

```cfg
ensure fivem-nui-devtools
ensure comps-demo
```

To restrict session recording to administrators:

```cfg
add_ace group.admin command.nui_devtools_record allow
```

### Convars

- `setr nui_devtools_enabled 1` — Enables or disables command registration (defaults to `1`).

## Build

### Frontend (Svelte 5 + Vite)

```powershell
cd web
npm install
npm run typecheck
npm run build
cd ..
```

Build artifacts are emitted to `html/dist/devtools.js` and `html/dist/devtools.css`.

### Client Backend (.NET 10 CoreCLR)

```powershell
dotnet publish src/Client/FiveM.Nui.DevTools.Client.csproj -c Release
```

Published binaries and dependencies are output to `src/Client/bin/Release/net10.0/publish/`.
