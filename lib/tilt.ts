export type Tilt = { x: number; y: number };

export function clampTilt(value: Tilt): Tilt {
  const x = Number.isFinite(value.x) ? value.x : 0;
  const y = Number.isFinite(value.y) ? value.y : 0;
  const length = Math.max(1, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

export function smoothTilt(current: Tilt, target: Tilt, dt: number): Tilt {
  const blend = 1 - Math.exp(-Math.max(0, dt) / 0.10);
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend };
}

export function tiltForces(previous: Tilt, current: Tilt, dt: number): Tilt {
  const seconds = Math.max(dt, 0.001);
  const dx = Math.max(-8, Math.min(8, (current.x - previous.x) / seconds));
  const dy = Math.max(-8, Math.min(8, (current.y - previous.y) / seconds));
  return {
    // Gravity acts downhill across the whole bowl. A small opposing impulse
    // approximates tray motion; actual translation needs an accelerometer later.
    x: current.x * 0.16 - dx * 0.006,
    y: -current.y * 0.16 + dy * 0.006,
  };
}

// Signed swept area of the tilt gesture drives circulation. A held tilt or
// back-and-forth movement along one axis supplies no continuous torque.
// Screen Y points down, so reverse the cross product for the GPU's upward Y.
export function stepStirring(drive: number, previous: Tilt, current: Tilt, dt: number, sensitivity = 1): number {
  if (dt <= 0) return drive;
  const rate = (previous.y * current.x - previous.x * current.y) / dt;
  const target = Math.sign(rate) * Math.min(2, Math.max(0, Math.abs(rate) - 0.02) * sensitivity);
  const response = target === 0 ? 0.65 : 0.20;
  return drive + (target - drive) * (1 - Math.exp(-dt / response));
}

export type Slosh = { offset: Tilt; velocity: Tilt };

// Low-order companion for the text thumbnail; the GPU simulates the full surface.
export function stepSlosh(state: Slosh, force: Tilt, dt: number): Slosh {
  const velocity = {
    x: state.velocity.x + (force.x - state.offset.x * 3.2 - state.velocity.x * 1.45) * dt,
    y: state.velocity.y + (force.y - state.offset.y * 3.2 - state.velocity.y * 1.45) * dt,
  };
  return { velocity, offset: { x: state.offset.x + velocity.x * dt, y: state.offset.y + velocity.y * dt } };
}
