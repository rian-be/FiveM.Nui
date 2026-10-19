---
description: "Diagnostics, remote CEF debugger (port 13172), troubleshooting, and production launch checklist."
icon: wrench
---

# Troubleshooting & Production Launch Checklist

> **How to diagnose in-game NUI issues, inspect CEF via Chrome DevTools, and ensure a bulletproof launch.**

---

## 1. Remote CEF Debugger (Port 13172)

You can inspect the FiveM in-game NUI browser just like an ordinary website in Google Chrome:

### How to access Chrome DevTools:
1. While FiveM is running, open **Google Chrome** or **Microsoft Edge** on your PC.
2. Navigate to: **`http://localhost:13172`**
3. You will see a list of all active NUI web contexts. Click your resource name to open the full DevTools inspector (**Console**, **Elements**, **Network** tabs).
4. All JavaScript errors, CSS layout styles, and HTTP traffic will be visible in real time while you play!

---

## 2. Common Scenarios & Fixes

### 🔴 Problem 1: Blank or black screen when opening the menu
* **Cause**: The `html/dist` folder in the resource is empty (frontend was not built), or the path in `fxmanifest.lua` is incorrect.
* **Solution**:
  1. Verify that `html/dist/` exists and contains `.js` and `.css` files.
  2. If empty, run `npm run build` in the `web/` directory.

### 🔴 Problem 2: CoreCLR startup error (`Failed to load assembly`)
* **Cause**: `fxmanifest.lua` is missing a required assembly from `publish/`, OR contains the forbidden `CitizenFX.Base.dll`.
* **Solution**:
  - Remove `CitizenFX.Base.dll` from the `files {}` array in `fxmanifest.lua` (this assembly is provided directly by FiveM).
  - Ensure all runtime dependencies from `src/Client/bin/Release/net10.0/publish/` are explicitly listed.

### 🔴 Problem 3: How to enable verbose NUI network logging?
Developers can enable tracing in C# client initialization:
```csharp
FiveM.Nui.Callbacks.NuiCallbackBridge.TraceCallbacks = true;
```
This prints the full lifecycle and execution duration (in milliseconds) for every NUI request directly to the F8 client console.

---

## 3. Pre Production Launch Checklist

Verify these steps before releasing a resource to players:

- [ ] **FiveM Enhanced Mode**: FXServer runs on an updated artifact with CoreCLR support (`coreclr_server`).
- [ ] **Production Frontend Bundle**: The compiled `html/dist/` bundle is deployed, not raw TypeScript source files.
- [ ] **Debug Logging Disabled**: `NuiOptions` has `EnableDebugLogging = false` and `LogPayloads = false`.
- [ ] **DoS Limit Configured**: `MaxPayloadSize` is set to an appropriate threshold (e.g., 256 KB).
- [ ] **Escape Key Test**: Open the menu in-game and press `ESC` — the window should close immediately, restoring character movement and releasing the cursor.
- [ ] **ACE Permissions in `server.cfg`**: Admin commands are protected:
  ```cfg
  add_ace group.admin command.panel allow
  ```
