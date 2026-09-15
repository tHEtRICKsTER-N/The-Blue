# ABYSS improvement roadmap

Agreed 2026-09-14. Preserve calm, optional exploration: no mandatory objectives,
timers, combat, or pressure to finish a collection.

## Milestone 1 — A meaningful first expedition

- [x] Persistent field notes: restore discoveries across visits, prevent duplicates,
  record first encounter date, location and depth, and tolerate unavailable storage.
- [x] One guided discovery: Mira offers a contextual Crystal Grotto clue; players
  can choose a bearing and distance hint in field notes and stop following anytime.
- [x] One richer animal encounter: dolphins approach a calm nearby diver, maintain
  space, retreat from a fast approach, and return to their normal route.
- [x] Verify persistence, corrupted storage, guidance, encounter transitions and
  production compilation; record remaining visual validation explicitly.

Implemented and checked locally on 2026-09-14. The complete grotto swim and dolphin
animation still need an interactive visual playtest before release.

Acceptance: discover something, reload and find the same note; follow or ignore
Mira's clue; observe different dolphin behavior when waiting versus rushing.

## Milestone 2 — A journal worth returning to

- [x] Species portraits from the actual game models, habitat descriptions and authored encounter observations.
- [x] Browse by species, habitat and location; search names and places; revisit recent dive history.
- [x] Keep collection progress optional and avoid checklist pressure.

Implemented locally on 2026-09-14. Existing notes migrate automatically. Each
discovery retains its first sighting and up to 30 recent dive encounters. Portrait
rendering and the expanded journal still need visual review before release.

## Milestone 3 — Underwater photography

- [x] Pause the scene, hide the HUD and diver, aim and zoom, choose original / 16:9 / square framing, capture and download JPEGs.
- [x] Local photo album with optional field-note attachments, 24-photo / 48 MB limits, and per-photo deletion confirmation.

Implemented locally on 2026-09-15. Browser checks confirmed square and wide captures,
zoom, save and attachment persistence after reload, download, and deletion cancellation.
Photos use browser-local storage; downloads remain available when album saving fails.

## Milestone 4 — Distinct destinations and wildlife

- [x] Resident ray circuit through Basalt Cathedral, optional calm-observation radio exchange, and site/journal clues. Route clearance and discovery checked; visual encounter playtest pending.
- [ ] Nursery feeding and vent colonies that change after dark.
- Turtle feeding, distinct species reactions and carefully tuned flashlight response.
- Connect encounters through sound, environmental clues and optional Mira dialogue.

## Return-visit persistence audit — 2026-09-15

- [x] Verified keybindings, sensitivity and camera comfort preferences.
- [x] Added saved camera mode, appearance, sound/radio, flashlight, optional guidance, weather/time/cycle choices and photo framing/grid/lens.
- [x] Hardened graphics loading and added a visible save-failure notice.
- [x] Browser reload confirmed bindings, inverted look, camera, appearance, audio/radio, weather and photo framing restoration.

Data stays in the same browser/site origin: preferences and notes use localStorage;
saved photos and attachments use IndexedDB. Browser-data clearing or storage
restrictions can remove/prevent saves. No account or cross-device sync. Each visit
starts a fresh dive; location, active menus, unsaved photo drafts, live weather
progress and radio transcript are session state. The chosen starting clock and
cycle speed persist, rather than advancing the ocean while the player is away.

## Milestone 5 — Comfort and performance

- [x] Mouse sensitivity, remappable dive and photo keys, invert vertical look, and reduced camera motion. Implemented locally on 2026-09-15 with saved preferences, conflict checks, alternate bindings, and restore defaults.
- Fix adaptive-resolution recovery on displays capped at 60 Hz; measure frame
  pacing before expanding optimization scope.
- Assess controller support, device defaults and accessibility after desktop polish.

## Working approach

Implement and validate one complete expedition slice before expanding the world.
Retain existing weather/sky work. Keep changes local until deployment is requested.
DEVLOG.md records implementation decisions, verification and handoff context.
