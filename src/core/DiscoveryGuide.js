export class DiscoveryGuide {
  constructor() { this.active = false; this.elapsed = 0; this.offered = false; }
  update(dt, position, target, discovered) {
    this.elapsed += dt;
    if (discovered) { this.active = false; return false; }
    const distance = Math.hypot(position.x - target.p.x, position.y - target.p.y, position.z - target.p.z);
    if (!this.offered && this.elapsed >= 35 && distance < 100 && distance > target.radius) {
      this.offered = true;
      return true;
    }
    return false;
  }
  reading(position, target, discovered) {
    const dx = target.p.x - position.x, dz = target.p.z - position.z;
    return {
      active: this.active && !discovered, discovered,
      distance: Math.round(Math.hypot(dx, target.p.y - position.y, dz)),
      bearing: (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360,
      vertical: target.p.y - position.y,
    };
  }
}
