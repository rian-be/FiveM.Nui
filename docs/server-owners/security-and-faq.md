---
description: "CEF security model, anti-cheat protection, DoS limits, and FAQ for FiveM server owners."
icon: shield-check
---

# Security, Anti Cheat Protection & FAQ

> **How FiveM.Nui shields your server from CEF client manipulation and why cheaters cannot compromise your economy.**

---

## 1. Threat Model: The CEF Browser Boundary

In FiveM, the NUI layer runs on the player's local machine inside an embedded Chromium Embedded Framework (CEF) process. This means technically skilled players have full access to Chrome DevTools and can inspect or modify JavaScript in memory.

```
┌────────────────────────────────────────────────────────┐
│             PLAYER CLIENT (Untrusted Zone)             │
│    Chromium CEF / DevTools / Browser Memory            │
└──────────────────────────┬─────────────────────────────┘
                           │ ❌ All NUI input is validated
┌──────────────────────────▼─────────────────────────────┐
│          C# CORECLR CLIENT (Intermediate Zone)         │
│    FiveM.Nui:                                          │
│    - Strict payload size limits (MaxPayloadSize)       │
│    - Strong DTO type validation                        │
│    - Concurrency & spam suppression (Serialize)        │
└──────────────────────────┬─────────────────────────────┘
                           │ 🔒 Authenticated Server Net Events
┌──────────────────────────▼─────────────────────────────┐
│             FIVEM SERVER (100% Trusted Zone)           │
│    Authoritative Server: Database verification,        │
│    ACE permissions, currency balance, and inventory    │
└────────────────────────────────────────────────────────┘
```

---

## 2. FiveM.Nui Security Defenses

### 1. Protection Against Crashes & DoS (`MaxPayloadSize`)
A malicious player might attempt to send a huge JSON payload (e.g., 50 MB) to crash the client, cause memory exhaustion, or lag the game.  
* **FiveM.Nui Defense**: `NuiOptions` enforces a strict payload size limit (default **1 MB**, recommended **256 KB**). Any envelope exceeding this limit is rejected immediately at the transport layer before entering managed memory.

### 2. Strong Typing & Compile-Time Integrity
Cheaters cannot inject `NaN`, `null`, or arbitrary strings where an integer (such as an item count or vehicle ID) is expected. Malformed JSON payloads fail validation and are dropped with descriptive error logs.

### 3. Golden Rule: Server Authority
> [!IMPORTANT]
> **NUI is a view-only display layer!**  
> NUI should never dictate canonical prices, permissions, or inventory amounts.  
> * ❌ **Incorrect**: NUI sends `{ itemId: "weapon_pistol", price: 0 }`.
> * ✅ **Correct**: NUI sends only the player's intent: `{ itemId: "weapon_pistol" }`. The authoritative FiveM server (C# or Lua) retrieves the authentic price from the database, verifies funds, and deducts money.

---

## 3. Frequently Asked Questions (FAQ)

### Do players need to install anything on their PCs?
No. Modern FiveM ships with the built-in `coreclr_client` module enabled by default. Every player connecting to your server has everything needed out of the box.

### Does FiveM.Nui work with frameworks like ox_core, QBCore, or ESX?
Yes, 100%. FiveM.Nui governs client-side NUI communication. It connects smoothly with any server-side framework whether written in Lua or C#.

### Why is FiveM Enhanced better than legacy Mono?
FiveM Enhanced runs on Microsoft CoreCLR (.NET 10). Unlike Mono (.NET 4.5), CoreCLR delivers modern generational garbage collection, zero-allocation asynchronous tasks, Hardware Intrinsics (SIMD), and dramatically lower CPU utilization.
