---
description: "Rapid browser workflow without launching FiveM (setupNuiMock) and production build pipeline."
icon: hammer
---

# ⏱️ Browser Mocking & Build Pipeline

> **Build and test your NUI interfaces 10x faster in Google Chrome and package production releases.**

---

## 1. Browser Workflow with `setupNuiMock`

The greatest advantage of FiveM.Nui is the ability to develop, style, and test entire UI flows in an ordinary desktop browser (Chrome, Edge, Firefox) **without running FiveM or GTA V**:

In `web/src/main.ts`:
```ts
import { mount } from 'svelte';
import { setupNuiMock, isBrowser, isNui, nui } from '@fivem-nui/svelte';
import App from './App.svelte';
import type { BuyRequest, BuyResponse } from './contracts';

// Executed strictly in a regular browser outside FiveM:
if (isBrowser()) {
  setupNuiMock({
    requests: {
      'shop:buy': (payload: BuyRequest): BuyResponse => {
        return {
          success: true,
          message: `Bought ${payload.quantity}x items in mock mode!`,
          remainingMoney: 4500
        };
      }
    },
    callbacks: {
      ready: () => console.log('[MOCK] Handshake ready received'),
      close: () => console.log('[MOCK] Window closed')
    },
    latencyMs: 50 // Simulate realistic network latency
  });
}

// Mount the Svelte application
const app = mount(App, { target: document.getElementById('app')! });

// In FiveM CEF, notify C# immediately when mounted
if (isNui()) {
  nui.notify('ready');
}

export default app;
```

### Start Local Dev Server:
```bash
cd web
npm run dev
```
Open `http://localhost:5173`. Any changes to Svelte components refresh in milliseconds via **Vite Hot Module Replacement (HMR)**!

---

## 2. Production Build Pipeline

When your resource is complete, compile the entire project in 3 steps:

```bash
# 1. Generate TypeScript contracts from C# models
cd web
npm run contracts

# 2. Build optimized frontend bundle into html/dist
npm run build

# 3. Publish C# CoreCLR (.NET 10) assemblies
cd ..
dotnet publish src/Client/MyResource.Client.csproj -c Release
```

Your resource is now packaged and ready to be placed in your server's `resources/` directory and added to `server.cfg` via `ensure my-resource`.
