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

- Hide HUD, frame photographs, capture and download snapshots.
- Attach photos to field notes; design storage limits and deletion controls before
  introducing a local photo library.

## Milestone 4 — Distinct destinations and wildlife

- Signature encounters at existing sites: a ray through Basalt Cathedral, nursery
  feeding, and vent colonies that change after dark.
- Turtle feeding, distinct species reactions and carefully tuned flashlight response.
- Connect encounters through sound, environmental clues and optional Mira dialogue.

## Milestone 5 — Comfort and performance

- Mouse sensitivity, remappable controls and reduced camera motion.
- Fix adaptive-resolution recovery on displays capped at 60 Hz; measure frame
  pacing before expanding optimization scope.
- Assess controller support, device defaults and accessibility after desktop polish.

## Working approach

Implement and validate one complete expedition slice before expanding the world.
Retain existing weather/sky work. Keep changes local until deployment is requested.
DEVLOG.md records implementation decisions, verification and handoff context.
