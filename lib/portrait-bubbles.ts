export type PortraitBubble = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  rise: number;
  drift: number;
  age: number;
  held: boolean;
};

const gap = 1;
const restitution = .35;

function overlaps(a: PortraitBubble, b: PortraitBubble, spacing = 0) {
  const distance = a.radius + b.radius + spacing;
  return (b.x - a.x) ** 2 + (b.y - a.y) ** 2 < distance ** 2;
}

/** Start near the intended entry point, using open space elsewhere when it is occupied. */
export function placePortraitBubble(bubble: PortraitBubble, others: PortraitBubble[], width: number, height: number) {
  const targetX = bubble.x;
  const targetY = bubble.y;
  const { radius } = bubble;
  if (others.every(other => !overlaps(bubble, other, gap))) return;

  let bestDistance = Infinity;
  let bestX = targetX;
  let bestY = Math.max(height, ...others.map(other => other.y + other.radius)) + radius + gap;
  for (let row = 0; row <= 12; row++) {
    bubble.y = radius + (height - 2 * radius) * row / 12;
    for (let column = 0; column <= 8; column++) {
      bubble.x = radius + (width - 2 * radius) * column / 8;
      const distance = (bubble.x - targetX) ** 2 + (bubble.y - targetY) ** 2;
      if (distance >= bestDistance || others.some(other => overlaps(bubble, other, gap))) continue;
      bestDistance = distance;
      bestX = bubble.x;
      bestY = bubble.y;
    }
  }
  bubble.x = bestX;
  bubble.y = bestY;
}

/** Resolve circle contact along the normal. A held portrait acts as a stationary obstacle. */
function separate(a: PortraitBubble, b: PortraitBubble) {
  const movable = Number(!a.held) + Number(!b.held);
  if (!movable || !overlaps(a, b, gap)) return false;

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.hypot(dx, dy);
  const nx = distance ? dx / distance : 0;
  const ny = distance ? dy / distance : 1;
  const push = (a.radius + b.radius + gap - distance) / movable;
  const closingSpeed = ((b.held ? 0 : b.vx) - (a.held ? 0 : a.vx)) * nx
    + ((b.held ? 0 : b.vy) - (a.held ? 0 : a.vy)) * ny;
  const impulse = Math.max(0, -closingSpeed) * (1 + restitution) / movable;

  if (!a.held) {
    a.x -= nx * push;
    a.y -= ny * push;
    a.vx -= nx * impulse;
    a.vy -= ny * impulse;
  }
  if (!b.held) {
    b.x += nx * push;
    b.y += ny * push;
    b.vx += nx * impulse;
    b.vy += ny * impulse;
  }
  return true;
}

function containHorizontally(bubble: PortraitBubble, width: number) {
  if (bubble.held) return;
  const x = Math.min(width - bubble.radius, Math.max(bubble.radius, bubble.x));
  if (x !== bubble.x && (bubble.x - x) * bubble.vx > 0) bubble.vx *= -restitution;
  bubble.x = x;
}

/** Advance one short animation frame and keep only positions with no visible intersection. */
export function stepPortraitBubbles(bubbles: PortraitBubble[], width: number, seconds: number) {
  const previous = bubbles.map(({ x, y }) => ({ x, y }));
  const damping = 1 - Math.exp(-seconds * 1.25);
  for (const bubble of bubbles) {
    if (bubble.held) continue;
    bubble.age += seconds;
    bubble.vx += (bubble.drift * Math.cos(bubble.age * .65) - bubble.vx) * damping;
    bubble.vy += (-bubble.rise - bubble.vy) * damping;
    bubble.x += bubble.vx * seconds;
    bubble.y += bubble.vy * seconds;
    containHorizontally(bubble, width);
  }

  // A contact can push a bubble into its neighbor or a side wall.
  for (let pass = 0; pass < 8; pass++) {
    let contact = false;
    for (let i = 0; i < bubbles.length; i++) {
      for (let j = i + 1; j < bubbles.length; j++) {
        if (separate(bubbles[i], bubbles[j])) contact = true;
      }
    }
    if (!contact) return;
    for (const bubble of bubbles) containHorizontally(bubble, width);
  }

  // In a tight cluster, keep the last valid frame while the new velocities spread it out.
  if (bubbles.some((a, i) => bubbles.slice(i + 1).some(b => overlaps(a, b)))) {
    bubbles.forEach((bubble, i) => Object.assign(bubble, previous[i]));
  }
}
