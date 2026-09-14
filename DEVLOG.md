# ABYSS — Developer Log (DevLog)

This document tracks technical decisions, architecture milestones, and deployment configurations for the ABYSS project.

---

## [2026-09-14] — Field guide and dive history — implemented locally

Continued the approved roadmap with milestone 2. Kept the dark ocean-console style,
expanded the journal into an index/detail view, and preserved the optional grotto
hint and per-dive radio transcript in collapsible sections.

Implementation:
- components/FieldJournal.tsx owns the accessible dialog, category tabs, search,
  selected entry and dive history. Uses the existing dialog, tabs and input primitives.
  Entries contain habitat guidance, first date/location/depth and recent encounters.
- src/core/FieldGuide.js contains authored observations for all 22 game species and
  known sites/habitats, filtering and history grouping. Copy describes the game;
  it is not presented as a scientific species database. No undiscovered checklist.
- src/creatures/SpecimenPortrait.js clones the actual animal or fish-school meshes,
  frames them, and renders a 480x300 portrait on demand using the existing renderer.
  It restores the game's render target, viewport and scissor state, disposes its
  temporary render target and never disposes the shared creature geometry/materials.
  Portraits are cached for the current game instance, not persisted or downloaded.
- FieldNotes.js accepts both v1 and v2 envelopes under the existing storage key.
  Previous notes become Earlier discoveries; no historical dive identity is invented.
  New visits keep firstSeen and first depth/location while retaining up to 30 recent
  encounters per discovery. Invalid/unavailable storage retains its existing handling.
- Game tracks encounters separately from lifetime discoveries. A reload starts a new
  dive identity; pause/resume does not. Familiar discoveries add one history entry
  per dive without new-discovery toasts or repeating discovery dialogue.

Validation:
- PASS: node scripts/check-exploration.mjs. Added old-note migration, history reload,
  repeated-visit suppression, first-sighting preservation, bounded history, filtering,
  all species catalogue/model coverage, live-model immutability and render-state
  restoration after a portrait render failure. Previous dolphin/guidance checks pass.
- PASS: static production build through the existing Vite entrypoint. Existing
  large-bundle warning remains. New journal/data/portrait code has no lint errors;
  the seven existing diagnostics in app/page.tsx and Game.js remain unchanged.
- The Sites build helper was attempted but cannot invoke npm in this environment:
  the npm installation resolves to missing npm-cli.js/npm-prefix.js files. Used the
  project's established static build without changing dependencies or system setup.
- Local preview returned HTTP 200 and was queued in Codex. No browser interaction
  or visual QA was performed this turn. Portrait model tests do not establish the
  final rendered appearance or UI layout quality.

Next:
- Visual playtest: journal search/tabs/history, representative portraits (fish,
  dolphin, turtle, jellyfish, octopus), then resume swimming and check the scene.
- The previous full grotto route and dolphin movement visual review remain pending.
- Next implementation milestone is underwater photography: hide HUD, frame/capture,
  download; plan photo storage limits/deletion before attaching a photo library.
- All changes remain local and uncommitted; nothing was published.

---

## [2026-09-14] — Exploration milestone 1 — implemented locally

User approved the six improvement areas in PLAN.md and implementation of the first
expedition slice: persistent notes, optional guidance and a richer animal encounter.
The existing historical sky/weather entries below are retained as context; their
branch/working-tree status describes those earlier sessions.

Decisions: use versioned, validated browser-local field notes and save at discovery
time rather than when toast notifications drain. Record first location, depth and
date. Crystal Grotto gets an optional radio clue and field-note navigation. Dolphins
get calm-approach and retreat behavior with a cooldown. No backend or new assets.

Implemented:
- FieldNotes.js validates a versioned localStorage record, deduplicates discoveries,
  and handles invalid/unavailable storage. Game restores its discovery set and saves
  immediately; UI notifications retain their six-second spacing. Field notes show
  first encounter date, depth and location, plus storage availability feedback.
- DiscoveryGuide.js offers one contextual Mira clue after 35 active seconds within
  100 metres of Crystal Grotto. Field notes opt into a bearing/distance/depth hint;
  the HUD shows bearing/distance while swimming. Guidance can be stopped anytime
  and ends when the grotto is discovered. It is optional and resets between visits.
- DolphinEncounter.js gives dolphins three seconds to approach a calm nearby diver,
  keeps a nine-metre orbit, and retreats for ten seconds after a fast/close approach.
  Movement is bounded by elapsed time, smoothly turns and respects the terrain floor.
  Distant dolphins relocate with streaming after fast travel. Other species retain
  their existing behavior. These are authored encounter behaviors, not a biological
  simulation; obstacles beyond the terrain use the existing marine-life limitations.

Verification:
- PASS: node scripts/check-exploration.mjs. Covers persistence, invalid and blocked
  storage, immediate saving before toast delivery, duplicate suppression, clue timing,
  bearings, completion, radio opt-out, curiosity and retreat cooldown. Also runs the
  actual MarineLife update: finite movement, curiosity, pause and fast-travel relocation.
- PASS: node node_modules/vite/bin/vite.js build --config vite.static.config.mjs.
  Existing large-chunk warning remains.
- Browser: verified journal layout, guidance on/off, first discovery metadata and
  retention after reload. Final browser error log empty. Browser testing caught a
  missing diverSpeed argument; fixed and covered by the simulation integration test.
- Lint: 31 existing errors remain. The seven diagnostics in touched files match
  those obtained from their HEAD versions; remaining errors are in unchanged files.
  New modules and test have no lint diagnostics.
- Environment: npm resolves to a broken roaming installation, so validation used
  installed Node entrypoints directly. No dependencies were added.

Next session:
- Play through the full optional grotto route and visually review dolphin movement
  and separation, especially around rocks and after a rapid approach. Automated
  behavior checks do not establish animation quality or hardware performance.
- Continue with the illustrated journal/species entries in PLAN.md after that review.
- Radio transcripts remain per-visit; only first discoveries persist. Local notes
  do not transfer across browsers/devices or survive clearing browser storage.
- No deployment or commit was performed.

---

## [2026-09-13] — Physically Based Sky, Seamless Horizon & Weather Visuals *(in progress, uncommitted)*

> **Status:** paused mid-session. All work below is **uncommitted** on branch
> `feature/weather-and-render-performance` (last commit `37ea4e7`). `npm run build:static` passes and every
> shader compiles without errors. See **§6 Where we stopped** before continuing.
>
> Housekeeping done this session: the stale `feature/weather-system` branch was deleted (it had no commits
> that weren't already in `main`; the remote copy was already gone).

### 1. The problem: "the sky looks like a box"

Root cause, confirmed by hiding scene objects one at a time until the artefact went away: the cloud layer was
projected onto a flat plane with `d.xz / max(.10, d.y)`. Below ~6° elevation the divisor stopped shrinking, so
clouds were painted straight up the sky like wallpaper on a cylinder wall. That produced a ring of translucent
vertical "columns" on the horizon and the feeling of standing inside a room. The sea also ended against a
single flat horizon colour, which made the edge of the world readable.

### 2. New architecture

| File | Role |
| --- | --- |
| `src/world/SkyModel.js` *(new)* | The atmosphere. Single-scattering Rayleigh + Mie on an Earth-sized planet, with Schüler's closed-form Chapman approximation for the light path. Evaluated **on the CPU** into two 48×24 half-float lookup tables (sun and moon), indexed by `sin(angle/2)` from the light's bearing and `sqrt(sin elevation)`. Also owns the tiling noise texture and the shared GLSL library (`skyGLSL`, `skyUniformsGLSL`). |
| `src/world/OceanSurface.js` | Sky dome, sea and star shaders rebuilt on that library. |
| `src/world/Environment.js` | Drives everything from the clock and weather: exposure, veil, sun/cloud/ambient light, moon phase, star rotation, lightning, rainbow. The old hour→colour `palette` is gone. |

Key design decisions:

- **Clouds sit on curved shells** (cumulus at 1.8 km, cirrus at 8.5 km), found by ray–sphere intersection. They
  foreshorten naturally all the way to a true horizon. This is the actual fix for the box.
- **One table for sky, sea and horizon.** The dome, the sea's distance haze and its reflection all read
  `clearSky()` / `horizonRing()` from the same lookup, so the join between sea and sky is invisible by
  construction. The sea's haze reaches 100% before the water mesh ends at 3.4 km.
- **The sky is computed on the CPU, not per pixel.** The first version ran the scattering integral in the
  fragment shader. It measured 2–3× slower (below). The table is symmetric about the light's bearing, so
  48×24 represents it exactly. While the sun or haze is changing it refreshes 3 rows per frame, rebuilds
  outright on a jump (first frame, clock dragged), and costs nothing while the clock is still.
- **Every texture lookup uses `textureLod`.** On Windows the browser's Direct3D back end (ANGLE) can't skip a
  derivative-based lookup inside a branch, so it evaluated expensive branches (cloud shadows etc.) for every
  pixel regardless.
- **Exposure** scales sky power by `(noonZenith / currentZenith)^0.62`, clamped to 1–9, so twilight becomes a
  blue hour instead of black. **White balance** is against the noon sun, so midday is white and low sun gold.
- **Clouds take light from 1.8 km up** (`transmittance(sun, out, CLOUD_HEIGHT)`), so they stay lit for a few
  minutes after sunset at sea level.

### 3. Features added

- Physically based sky colour for every hour: sunrise and sunset glow, afterglow, a blue hour, and a moonlit night.
- Cumulus with domain-warped fBm, self-shadowing (one probe towards the sun), silver linings weighted to thin
  edges, powder effect, and aerial perspective that dissolves distant cloud into the horizon.
- High cirrus stretched along the wind.
- **Cloud shadows moving across the sea**, tested against the same field as the visible clouds.
- A sun disc with limb darkening, coloured by the air it shines through, plus a low-sun glitter path on the water.
- **Moon phases:** the moon is shaded as a lit sphere and slips ~12°/day, so it waxes and wanes with the clock
  running. It's drawn about 3× life size so the phase reads at game resolution.
- **Rotating stars and Milky Way** turning about the same pole the sun circles. Stars twinkle harder near the
  horizon and are hidden by clouds. The Milky Way uses triplanar noise (single-plane noise smeared it into streaks).
- **Lightning:** each strike has a bearing, lighting the clouds around it, and near strikes draw a jagged bolt
  with a fork from cloud base to sea, with re-strike flicker.
- **Rainbows** (primary plus a fainter reversed secondary, brighter sky inside the bow) appear only while a shower
  is arriving or clearing and the sun is below ~40°.
- Distant rain curtains under the cloud deck. Rain streaks take the sky's colour.
- Weather now dims light, not just flattens it: storms have a dark deck and dark sea, and a sun hidden by cloud
  no longer glints on the water.

### 4. Bugs found and fixed along the way

- **Scratch-colour aliasing in `SkyModel.sky()`:** the caller passed the same scratch `Color` the function used
  internally. The sun term was doubled, and whenever the moon was up the moon **overwrote** the sun, leaving the
  horizon near-black at golden hour. That drew a dark line along the horizon, and the doubled daylight value was
  also the cause of an over-milky horizon band.
- Horizon clouds left a dark sliver because aerial perspective was capped at 90%. Distant cloud now fades fully.
- A below-horizon sun or moon stops refreshing its table, so its power is forced to 0 there. Otherwise a stale
  sunset table would glow all night.
- Night effects (bioluminescence, stars, moon-blue light) now wait until the sun is well below the horizon.
- `flat` (a reserved word in GLSL ES 3.00) and `main` renamed as shader variables.
- **Correction to an earlier claim:** three.js disables in-material tone mapping when rendering into a render
  target (`WebGLPrograms.js:167`), so the sky and water are **not** tone-mapped twice. No action needed.

### 5. Performance

Measured in one session on the Intel UHD test machine, 1280×720, MSAA 4×, committed version vs. this work
(frame times are noisier than on 2026-09-12, so compare only within this table):

| View | `37ea4e7` | Per-pixel scattering (rejected) | Lookup table (current) |
| --- | --- | --- | --- |
| Surface, looking up | 13.9 ms | 22.2 ms | 14.6 ms |
| Surface, horizon | 26.8 ms | 55.4 ms | 28.1 ms |
| Storm | 22.7 ms | 78.3 ms | 24.4 ms |
| Underwater | 22.1 ms | 56.3 ms | 22.3 ms |

The CPU cost of `Environment.update` is 0.012 ms per frame with the clock still and 0.22 ms with it running at 60×.

### 6. Where we stopped — pick up here next time

**Last change, not yet verified visually:** the underwater Snell's window at sunset rendered as a solid dark red
disc. The last edit in `OceanSurface.js` (the `else` / back-face branch of the water shader) blends the zenith
into the window colour, partly desaturates it, and applies water absorption (`* vec3(.6,.92,1.06)`). **First
thing next session:** check underwater at ~18:10, looking up, and tune.

Remaining to-do list:

1. **Verify the Snell's-window fix** (above).
2. **07:00 toward the sun is still bright and washed out.** It's better than before, but the Mie glare, the water
   glitter path and the haze combine. Candidates: lower `MIE_SCALE` (now `.38`) or the path intensity, or an
   exposure pull-down when looking into the sun.
3. **Cloud shadows on the sea are subtle** from surface height. Consider more base-colour darkening (`.45`).
4. Horizon band at midday is plausible but could be a little less white.
5. Re-check the islands' fog colour. Scene fog uses the *average* horizon colour, not the bearing-specific ring,
   so an island toward a low sun may not match the sky behind it.
6. `Game.dispose()` does not yet call `world.surfaceWorld.model.dispose()` (noise and LUT textures leak on
   unmount).
7. Update README screenshots and features once the look is signed off, then run `npx oxlint` (the baseline was
   30 pre-existing errors; confirm none are new), commit and push the branch, and open a PR to `main`.
8. `.claude/launch.json` is still untracked. Decide whether to commit it.

**How the visuals were verified** (useful for continuing): run the preview with `.claude/launch.json` (`abyss-static`,
port 4173). In dev builds `window.__abyssDebug` is the `Game`. The method: set `g.disposed = true` to freeze the
loop, pin the mount to 1280×720, call `g.setWeather()` / `g.setHour()`, step `g.environment.update(g, .05, 0, 0)`
a few hundred times to settle, place the camera, then `g.effects.render()`. Several views were drawn into a
2D-canvas contact sheet so one screenshot compared times of day. Freeze `uCloudDrift` when A/B-measuring pixels,
or the clouds move between runs.

**Tuning knobs:** `SkyModel.js` → `SUN_POWER`, `MIE`, `MIE_G`, `MIE_SCALE`, `CLOUD_SCALE`, `CLOUD_HEIGHT`.
`Environment.js` → exposure curve (`^.62`, clamp 1–9), veil strength and `diffuse`, cloud sun factor, rainbow
gating. `OceanSurface.js` → cloud aerial perspective (`tCloud/34000`), cirrus strength (`ca*.3`), sun disc
(`*46`), moon size (`.018`).

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

