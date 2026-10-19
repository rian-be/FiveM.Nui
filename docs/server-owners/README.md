---
description: "FiveM Server Owners Guide – FiveM Enhanced, installation, and resmon performance."
icon: crown
---

# Server Owners Guide: Introduction & Installation

> **FiveM.Nui is an ultra-lightweight, secure, and zero-compromise NUI bridge for your FiveM server.**  
> This guide explains why your server benefits from adopting FiveM.Nui, how FiveM Enhanced differs from legacy Mono, and how to install a ready resource on your server.

---

## 1. Why FiveM.Nui?

Every FiveM server owner is familiar with daily player frustrations regarding NUI web interfaces:

| Common FiveM Pain Point | FiveM.Nui Solution | Player & Server Impact |
|---|---|---|
| ❌ **Stuck Cursor (Focus Lock)**: Player closes a menu (ESC), but the cursor remains stuck in the center of the screen, freezing the character. | ✅ **Window Manager `NuiGateway`**: Automatic handshake and ESC dismiss. FiveM natively releases input focus (`SetNuiFocus(false, false)`). | **Zero stuck cursors.** No more game restarts or chat unlock commands (`/unlockcursor`). |
| ❌ **Lag & FPS Drops when opening UI**: Bloated frontend frameworks (legacy React, Angular) cause micro-stutters and frame drops. | ✅ **Svelte 5 Runes**: Zero-runtime virtual DOM overhead. Smooth, responsive rendering at 144Hz / 240Hz refresh rates. | Silky smooth gameplay, instant click responsiveness, zero FPS drops. |
| ❌ **Memory Leaks**: After a few hours of play, FiveM consumes gigabytes of RAM and crashes. | ✅ **Managed Lifecycle**: Automatic unregistration of message listeners and pending requests upon window disposal. | Players enjoy long gaming sessions without memory inflation or crashes. |
| ❌ **Silent Request Freezes**: Player clicks a button, nothing happens, and a stalled HTTP request hangs indefinitely in the background. | ✅ **Structured Deadlines & UUIDv7**: Every request carries an enforceable timeout and a unique correlation identifier. | Players receive immediate feedback, and the server thread pool never gets exhausted. |

---

## 2. Requirements: FiveM Enhanced (CoreCLR / .NET 10)

> [!IMPORTANT]
> **Engineered for FiveM Enhanced**  
> FiveM.Nui is built from the ground up for the modern **FiveM Enhanced** runtime (**CoreCLR / .NET 10 / C# 14**).  
> **It does not support legacy FiveM (old Mono .NET Framework 4.5 runtime).** With FiveM Enhanced, your server benefits from cutting-edge JIT optimizations, minimal resource usage, and rock-solid stability.

### What does this mean in practice?
* **FXServer Artifacts**: Standard modern server builds (recommended `latest-recommended` containing the `coreclr_server` directory).
* **Operating Systems**: Fully supported on **Linux** (Ubuntu 20.04+, Debian 11+, Rocky Linux, Alpine) and **Windows Server** (2016–2025).
* **Players**: The FiveM client automatically boots the `coreclr_client` module upon connecting — players **do not need to install anything**.

---

## 3. Installation & `server.cfg` Configuration

Deploying a FiveM.Nui resource takes two simple steps:

### Step 1: Place in `resources/`
Copy the resource folder into your server's `resources/` directory:
```
server-data/
  └── resources/
      └── [nui]/
          └── my-resource/
              ├── fxmanifest.lua
              ├── html/dist/           <-- Compiled NUI web panel
              └── src/Client/bin/...   <-- Published C# CoreCLR assemblies
```

### Step 2: Add to `server.cfg`
Open your `server.cfg` and add the startup directive:

```cfg
# Startup order: ensure base resources start first:
ensure mapmanager
ensure spawnmanager

# Your FiveM.Nui resource:
ensure my-resource
```

---

## 4. Performance & Resource Monitor (Resmon)

* **Idle (Menu Closed)**: **`0.00 ms`**  
  Zero background tick loops (`Citizen.CreateThread`). The architecture is 100% event-driven.
* **Active (Menu Open)**: **`< 0.02 ms`**  
  Asynchronous, zero-allocation JSON streaming via `System.Text.Json` without blocking the main game thread.
* **Bundle Footprint**: Thanks to Svelte 5's compiler, the compiled frontend bundle is only **100–200 KB**, ensuring instant downloads when players join the server.

---

### Next steps:
* [CEF Security & Anti-Cheat](security-and-faq.md) — Defenses against browser tampering and DoS floods.
* [Troubleshooting & Debugging](troubleshooting.md) — Remote CEF DevTools inspector (port 13172) and launch checklist.
