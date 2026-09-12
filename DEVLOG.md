# ABYSS — Developer Log (DevLog)

This document tracks technical decisions, architecture milestones, and deployment configurations for the ABYSS project.

---

## [2026-09-12] — Weather System Rework & Render Pipeline Optimisation

### 1. Render pipeline — where the frames were going

Four fixes in `src/effects/Atmosphere.js`, `src/core/Game.js` and `src/world/OceanSurface.js`. Measured on an
Intel UHD test machine at 1280×720 with MSAA 4× (the savings are bandwidth-bound, so they scale with
resolution — the same benchmark at 1600×900 showed 1.47–1.54×):

| Scene | Before | After | Speed-up |
| --- | --- | --- | --- |
| Reef, underwater | 19.2 ms | 14.1 ms | 1.36× |
| Surface, storm | 21.1 ms | 16.0 ms | 1.32× |
| Surface, clear day | 18.5 ms | 16.4 ms | 1.13× |

- **MSAA was applied to the whole post chain, not just the scene.** `EffectComposer` clones the target it
  is handed to make its second ping-pong buffer, so a multisampled composer target meant *both* buffers
  carried the sample count. Bloom and the grade pass were each writing and resolving a 4× or 8× half-float
  buffer every frame. A `SceneRenderPass` subclass now owns the multisampled target, renders the scene into
  it and blits the resolved result into the chain; the composer's own buffers stay at one sample. This is
  the single largest win — roughly 7 ms of the 5 ms/frame saved underwater.
- **The composer's read/write buffers are now pinned at the top of each frame.** Which buffer the scene
  lands in depended on how many swapping passes happened to be enabled, and flipped between frames on odd
  pass counts. `Atmosphere.render()` resets them so the scene pass always targets the same buffer.
- **The sky sphere was drawn first.** It carries the most expensive fragment shader in the scene — three
  octaves of cloud noise plus the milky band — and at `renderOrder: -10` it ran on every pixel that terrain
  and water then covered. It writes no depth, so moving it to `renderOrder: 1000` lets early-Z reject the
  hidden pixels before they shade.
- **Bloom runs its mip chain at half the frame's resolution**, which is indistinguishable for a wide blur.
- **The water shader skips its small-scale work past the detail fade.** Ripple normals, the night glow and
  the rain terms were computed for every water pixel and then multiplied by a `detail` factor that is zero
  beyond 180 m. Branching on it removes ~50 sine evaluations from most of the screen above water.
- **Light shafts leave the draw list when their opacity reaches zero** (above water, or in the dark) rather
  than drawing sixteen tall double-sided additive cylinders for an invisible effect.
- **Adaptive quality is now dynamic resolution.** It used to permanently overwrite the player's
  `waterDetail` / `particleDensity` / `renderScale` below 34 fps and never restore them. It now rides a
  separate multiplier on top of the chosen render scale, targets 60 fps, steps in small increments with a
  dead band, gives resolution back when the frame rate recovers, and never climbs past what the player set.

### 2. Weather system

- **Fixed: a steady wind walked the rain out of the world.** The rain pool's horizontal wind drift was
  unwrapped while only the fall was wrapped, so at storm wind the whole column translated out of the
  78 m box centred on the diver — verified at x ∈ [+34, +114] after two minutes and [+330, +411] after ten.
  The drift now wraps like the fall does, and the streak lean is applied after the wrap so the two ends of
  a segment can never land on opposite sides of it.
- **Automatic weather.** A small transition table (`weatherFlow`) walks clear → cloudy → rain → storm and
  back on a 80–220 s dwell, so nothing jumps from clear to storm without building through it. Two simulated
  hours give roughly clear 21% / cloudy 25% / mist 28% / rain 17% / storm 10%.
- **Two transition speeds.** A hand-picked preset lands in ~2.5 s so it is visible while the menu is still
  open; an automatic front crossfades over ~25 s so it reads as weather rather than as a settings toggle.
- **Wind is a bearing as well as a speed**, swinging slowly on its own loop, and now drives the cloud field's
  scroll speed and direction, the rain's slant, the surface chop and the whitecaps together. The cloud field
  scrolls on an accumulated drift rather than raw time, so changing wind changes cloud speed without
  teleporting the sky, and its octaves slide against each other so cover churns as it travels.
- **Whitecaps** ride the crests of the swell (free — the vertex stage already displaced them) and only break
  once the wind is up. They take their brightness from the horizon rather than the direct light term, which
  a storm crushes to 0.23 — foam lit that way came out grey and invisible.
- **Rain splash rings**: one hashed cell per drop, jittered inside its cell and on its own clock, fading out
  after a few metres. Previously rain only roughened the surface instead of landing on it.
- **Lightning** is keyed off the blended weather rather than the visible rain pool, which the depth fade
  zeroes out — the storm is still overhead when you are twenty metres down. Each strike gets a distance that
  sets both the flash intensity and the thunder delay, and the flash is now attenuated rather than removed
  underwater.
- **Weather audio**: rain hiss and wind on a white-noise layer (the existing ambience loop is integrated
  brown noise and has no high end to give), muffled with depth, plus distance-filtered thunder.
- **Heavy weather costs underwater visibility** — a rough surface adds turbidity to the fog density.

### 3. Verification
- `npm run build:static` clean; `npx oxlint` error count unchanged from baseline (30, all pre-existing).
- Driven in-browser: all AA modes and render scales cycled with zero GL errors, scene target and bloom chain
  tracking resize correctly, light-shaft gating correct above/below water and against the user switch, and
  adaptive resolution stepping down and recovering.
- `scripts/check-ocean.mjs` was not run — Playwright is not installed in this environment.

---

## [2026-09-11] — Production Deployment & Cloudflare CI/CD Pipeline

### 1. Context & Motivation
- The project is an interactive 3D underwater exploration experience built with Three.js, React, Tailwind CSS, and Vite.
- Goal: Deploy the website publicly at zero recurring hosting cost, automate continuous delivery on git pushes, and set up a foundation for adding custom domains later.

### 2. Hosting & Infrastructure Decisions
- **Provider:** Cloudflare Pages / Workers Static Assets.
- **Cost:** $0.00/month (Free Tier).
- **Subdomain:** Deployed using the free default `*.pages.dev` subdomain provided by Cloudflare, offering built-in global CDN caching, DDoS mitigation, and automated TLS/SSL certificate generation.
- **Custom Domain Strategy:** Cloudflare Registrar was chosen as the recommended path for future domain purchases due to zero-markup ("at-cost") wholesale pricing without aggressive renewal hikes.

### 3. Build Architecture
- The project retains the original Next.js/Sites compatibility setup (`vinext`) for development while providing a pure browser-executable bundle via:
  - **Config:** `vite.static.config.mjs`
  - **Entry:** `standalone/index.html` & `standalone/main.tsx`
  - **Build Command:** `npm run build:static`
  - **Output Target:** `dist-static/`
- Verified local and remote compilation time: ~1.8–2.0 seconds with full asset gzip optimization.

### 4. CI/CD Issue Diagnosis & Resolution
- **Issue:** During the initial Cloudflare Pages/Workers Git build, Cloudflare invoked `npx wrangler deploy`. Because no root configuration file existed:
  1. Wrangler launched an interactive setup wizard in a non-interactive CI terminal.
  2. Wrangler misidentified the build directory as `dist/` rather than `dist-static/`.
  3. The wizard attempted an implicit `npm install wrangler`, which failed due to a peer dependency resolution conflict (`npm error ERESOLVE`) between root `@cloudflare/workers-types` and latest Wrangler versions.
- **Solution:**
  - Created a dedicated `wrangler.jsonc` file at the root repository:
    ```jsonc
    {
      "$schema": "node_modules/wrangler/config-schema.json",
      "name": "the-blue",
      "compatibility_date": "2026-05-22",
      "assets": {
        "directory": "./dist-static",
        "not_found_handling": "single-page-application"
      }
    }
    ```
  - Configured assets to route to `./dist-static` with Single Page Application (`index.html`) fallback handling.
  - Tested locally with `npx wrangler deploy --dry-run`, confirming direct asset bundle reading without triggering interactive package installation.

### 5. Repository & Git Hygiene
- Added build and runtime artifacts to `.gitignore`:
  - `dist-static/` (compiled production client files)
  - `.wrangler/` (local Cloudflare state and logs)
  - `.vinext/` (local Next.js compatibility cache)
- Established branch conventions:
  - `main`: Production-ready branch connected to Cloudflare CI/CD for auto-deployment.
  - `feature/*`: Working branches for experimental systems and active feature development (e.g. `feature/weather-system`).

---

## [2026-09-11] — Local Development Worker Compatibility Fix

### 1. Issue Diagnosis
- **Command:** `npm run dev` (`vinext dev`)
- **Error:**
  ```text
  service core:user:the-blue: This Worker requires compatibility date "2026-09-11", but the newest date supported by this server binary is "2026-05-22".
  MiniflareCoreError [ERR_RUNTIME_FAILURE]: The Workers runtime failed to start.
  ```
- **Root Cause:** `wrangler.jsonc` had its `compatibility_date` set to `"2026-09-11"`. The local Miniflare / `workerd` runtime bundled in the project's installed `@cloudflare/vite-plugin` and `wrangler` dependencies only supports compatibility dates up to `"2026-05-22"`. In Cloudflare Workers, configuring a date newer than what the local binary supports causes `workerd` to immediately halt execution.

### 2. Resolution & Verification
- **Changes:** Updated `compatibility_date` in `wrangler.jsonc` to `"2026-05-22"`.
- **Verification:** Ran `npm run dev` and verified the Vite development server boots cleanly:
  - Local server accessible at `http://localhost:3000/`.
  - Debug server accessible at `http://localhost:3000/__debug`.
  - RSC/SSR environment and client bundles optimized and loaded without runtime errors.

