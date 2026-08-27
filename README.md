# GhostBlock 👻

**A Manifest V3 ad blocker that hides instead of fights.**

Most ad blockers rip ads out of the page and hope the site doesn't notice. GhostBlock takes the opposite approach: it lets ad scripts *think* they ran successfully — spoofing the responses they expect — so the ad container quietly collapses instead of tripping an anti-adblock wall.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE.md)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](manifest.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg)](tsconfig.json)
[![Status](https://img.shields.io/badge/status-personal%20project-lightgrey.svg)](#)

---

## Table of Contents

- [Why](#why)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Features](#features)
- [Repository structure](#repository-structure)
- [Getting started](#getting-started)
- [Privacy](#privacy)
- [Disclaimer](#disclaimer)
- [Contributing](#contributing)
- [License](#license)

---

## Why

You've seen the wall:

> "We noticed you're using an ad blocker. Please disable it to continue."

Standard blockers cause that wall. They block the network request for the ad, the page's own detection script notices the empty slot, and it locks your scroll until you comply.

GhostBlock avoids that fight entirely. Instead of blocking, it **redirects and impersonates**:

1. Ad library requests (Google Publisher Tag, AdSense, Prebid) are redirected to local mock scripts that respond the way the real library would — so the page's own code believes the auction happened.
2. If a script checks whether the ad slot is visible on screen, GhostBlock's layout spoofing answers "yes, it's right there," while the slot is actually collapsed and off-screen.
3. Video ads are sped up to 16x, muted, and skipped the moment they're detected, rather than blocked outright.
4. If an anti-adblock modal still appears, a DOM watcher removes it and restores scrolling.

The result is a page that looks and behaves as if the ads loaded fine — they just aren't visible.

## How it works

| Layer | What it does |
|---|---|
| **`declarativeNetRequest` redirects** | Rewrites requests for `gpt.js`, `adsbygoogle.js`, and `prebid.js` to local mock files instead of blocking them outright. |
| **Mock ad libraries** (`public/mocks/`) | Reimplement just enough of the real APIs (`googletag`, `pbjs`, `adsbygoogle`) to satisfy a page's own callbacks and event listeners. |
| **Geometry spoofing** (`inject/geometrySpoofer.ts`) | Runs in the page's own execution context at `document_start` and overrides layout getters (`offsetHeight`, `getBoundingClientRect`, etc.) for known ad-slot selectors, so visibility checks pass. |
| **CSS quarantine** (`ghostQuarantine.css`) | Collapses ad containers using `opacity`/`position` tricks instead of `display: none`, which avoids layout shift and keeps `offsetParent` checks satisfied. |
| **Video ad engine** (`inject/videoAdEngine.ts`) | Listens for video playback events, detects ad breaks, and accelerates/skips them without polling. |
| **Overlay defuser** (`content/overlayDefuser.ts`) | A debounced `MutationObserver` looks for full-screen anti-adblock modals and removes them, restoring scroll. |
| **Popup dashboard** | Shows locally-tracked stats (ads neutralized, bandwidth saved, video ads skipped) and lets you whitelist a domain. |

## Architecture

```
                      ┌────────────────────────────────────────┐
                      │               Web Page                 │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴───────────────────────┐
                  ▼                                               ▼
     ┌────────────────────────┐                      ┌────────────────────────┐
     │      MAIN world        │                      │    Isolated world      │
     │  (page's own scripts)  │                      │   (content script)     │
     ├────────────────────────┤                      ├────────────────────────┤
     │ • geometrySpoofer.ts   │   CustomEvent bridge  │ • contentScript.ts     │
     │ • videoAdEngine.ts     │ ───────────────────►  │ • overlayDefuser.ts    │
     └────────────────────────┘                      │ • ghostQuarantine.css  │
                                                      └───────────┬────────────┘
                                                                  │ chrome.runtime
                                                                  ▼
     ┌────────────────────────┐                      ┌────────────────────────┐
     │ declarativeNetRequest  │                      │  Background service    │
     │ redirect-rules.json    │ ◄─────────────────── │  worker + chrome.storage│
     │ → public/mocks/*.js    │                      │  (telemetry, whitelist)│
     └────────────────────────┘                      └────────────────────────┘
```

## Features

- Redirects known ad-library requests to local mock scripts instead of blocking them
- Spoofs element geometry so anti-adblock visibility checks pass
- Collapses ad slots without triggering layout shift
- Detects and fast-forwards/skips video ads
- Automatically removes anti-adblock overlay modals
- Local-only stats dashboard (ads neutralized, bandwidth saved, video ads skipped)
- Per-domain whitelisting
- Built for Manifest V3 — no deprecated `webRequest` blocking

## Repository structure

```
ghost-block/
├── manifest.json              # Extension manifest (MV3)
├── rules/redirect-rules.json  # declarativeNetRequest redirect rules
├── public/mocks/              # Mock ad library scripts
│   ├── gpt.js                 # Google Publisher Tag mock
│   ├── adsbygoogle.js         # AdSense mock
│   └── prebid.js              # Prebid.js mock
└── src/
    ├── background/serviceWorker.ts  # Telemetry + storage
    ├── content/
    │   ├── contentScript.ts         # Cross-world event bridge
    │   ├── ghostQuarantine.css      # Ad-slot collapse styles
    │   └── overlayDefuser.ts        # Anti-adblock modal removal
    ├── inject/
    │   ├── geometrySpoofer.ts       # MAIN-world layout spoofing
    │   └── videoAdEngine.ts         # Video ad detection/skip
    ├── popup/                       # Dashboard UI
    └── utils/                       # Shared constants & storage helpers
```

## Getting started

**Prerequisites:** Node.js 18+, npm, a Chromium-based browser (Chrome, Brave, Edge).

```bash
git clone https://github.com/erfanvoj/ghost-block.git
cd ghost-block
npm install
npm run build       # compiles TypeScript and bundles into dist/
```

Then load it as an unpacked extension:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `ghost-block` folder (the one containing `manifest.json` and `dist/`)

Other useful scripts:

```bash
npm run dev         # watch mode via Vite
npm run typecheck   # type-check without emitting
npm run test        # run vitest
```

## Privacy

- No external servers, no analytics, no remote telemetry.
- Stats (ads blocked, bandwidth saved, etc.) are stored locally via `chrome.storage.local` and never leave your browser.
- The extension does not read or transmit browsing history or page content beyond what's needed to run its detection logic.

## Disclaimer

GhostBlock is a personal project built to explore Manifest V3 internals, `declarativeNetRequest`, and how anti-adblock detection scripts work — not a polished, actively-maintained product. Circumventing a site's ad-supported model may violate that site's terms of service; use it on your own judgment and at your own risk. It's provided as-is, with no warranty.

## Contributing

This started as a solo project, so there's no formal contribution process yet. If you find a bug or a site where it misbehaves, feel free to open an issue or a PR — just keep changes scoped and explain the "why" in the description.

## License

[MIT](LICENSE.md) © erfanvoj
