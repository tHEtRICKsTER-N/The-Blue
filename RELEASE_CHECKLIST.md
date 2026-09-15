# ABYSS release checks

These checks remain open. Automated checks and still-image reviews do not prove
animation quality, audio balance, assistive-technology compatibility or hardware performance.

## Desktop playtest

- Start at the reef, discover a species, open its journal portrait and details,
  search/filter, and revisit its history after reloading. Confirm portrait framing
  for a fish, turtle, ray, jellyfish and whale when available.
- Follow Mira's optional Crystal Grotto bearing all the way through the entrance
  and back out. Check collisions, visibility and the discovered-state transition.
- Near dolphins, wait calmly, approach quickly, then back away. Watch for smooth
  approach/retreat and recovery without snapping or repeated dialogue.
- At Basalt Cathedral, observe one complete ray circuit from beside the arch.
  Check wing/tail clearance, including the far side obscured in arrival views.
- At Seagrass Nursery, watch a full feeding/swimming cycle. Check head and flippers
  against terrain and grass. Compare a brief flashlight sweep with a sustained
  beam, then allow recovery. Repeat after approaching quickly and backing away.
- At the Smoking Gardens, compare day, dusk and night. Watch a complete light
  retraction and recovery at close range; check crown/tube contact and legibility.
- Listen with headphones and speakers at comfortable volume. Assess weather,
  breathing, whale calls and the quiet intervals around the new encounters.
  Retain the existing soundscape unless this review demonstrates a missing cue;
  no extra creature calls or per-encounter stingers are currently planned.

## Keyboard and comfort

- Complete entry, pause, settings, journal and photography navigation without a
  mouse. Swim with WASD and look with arrows (or their saved replacements).
  Verify Tab pauses, Escape cancels key assignment, and focus remains visible.
- Assign arrow keys to movement in an older saved profile. After upgrading,
  confirm those assignments remain and the new look bindings use free keys.
- With a fresh profile and system reduced motion enabled, confirm the title camera,
  swimming bob and menu entrances stay still. A saved Off choice must remain Off.
- Check 1024×550 and larger desktop views with keyboard focus and display scaling.
  The settings pane must scroll, and the resume button must not cause horizontal overflow.
- Screen-reader review is still required. Labeled controls and textual notes do
  not make the spatial exploration itself a fully nonvisual experience.

## Foreground performance

Use a foreground browser on an actual 60 Hz display, recording browser, GPU,
display resolution, device pixel ratio and preset. Allow a 30-second warm-up, then
record FPS, average frame interval, p95 and scale for 60 seconds at the reef,
Cathedral, nursery and vents. Repeat one route in storm weather.

With adaptive quality enabled, compare a demanding scene and a quieter scene.
Confirm scale decreases under sustained load and recovers on stable frames,
without exceeding the chosen resolution or continually oscillating. Background
tab throttling and automated-preview timing are not representative measurements.

## Controller assessment

Gamepads are not currently supported. The existing keyboard/mouse input path has
no gamepad polling, dead zones, disconnect handling or menu navigation. Preserve
the current desktop requirement; do not advertise controller/touch compatibility.
Before a controller implementation, validate an actual standard-mapped gamepad
for movement/look, dead zones, pause/disconnect safety, settings/journal/photo
navigation, on-screen hints and saved preferences. Controller implementation is
a follow-up scope, not a completed feature of this roadmap.
