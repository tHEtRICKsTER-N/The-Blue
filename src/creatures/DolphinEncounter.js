// Time-based hysteresis keeps a single slow movement from flipping behavior.
export function updateDolphinEncounter(state, dt, distance, diverSpeed) {
  state.cooldown = Math.max(0, (state.cooldown || 0) - dt);
  const startled = distance < 4 || (distance < 20 && diverSpeed > 2.5);
  if (startled) {
    state.mode = 'retreat'; state.cooldown = 10; state.calm = 0;
  } else if (state.cooldown > 0) {
    state.mode = 'retreat';
  } else {
    state.calm = distance < 32 && diverSpeed < 1.2 ? (state.calm || 0) + dt : 0;
    if (distance > 42 || diverSpeed > 1.8) state.mode = 'cruise';
    else if (state.calm >= 3) state.mode = 'curious';
    else if (state.mode !== 'curious') state.mode = 'cruise';
  }
  return state.mode;
}
