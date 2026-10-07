import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GyroscopePose, browserGyro, gyroQuaternion, rotationMatrix, ringMarkerPoint, modelQuaternion } from '../lib/gyroscope-pose';
import { orientationGravity, screenTilt } from '../lib/device-tilt';
import { lightFromTilt } from '../lib/tilt-light';

const zero = { x: 0, y: 0, z: 0 };
const near = (a: number, b: number, tolerance = 1e-6) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);
const settle = (pose: GyroscopePose) => { for (let i = 0; i < 120; i++) pose.advance(1 / 60); return rotationMatrix(pose.advance(1 / 60)); };

void test('Core Motion roll rotates about Y and pitch about X; browser axes agree', () => {
  const roll = rotationMatrix(gyroQuaternion({ ...zero, x: 30 }));
  near(roll[2], 0.5); near(roll[6], -0.5);
  const pitch = rotationMatrix(gyroQuaternion({ ...zero, y: 30 }));
  near(pitch[5], -0.5); near(pitch[7], 0.5);
  assert.deepEqual(browserGyro(350, 15, -25), { x: -25, y: 15, z: -10 });
});

void test('landscape maps device roll onto the screen horizontal axis', () => {
  const landscape = rotationMatrix(gyroQuaternion({ ...zero, x: 30 }, 90));
  near(landscape[2], 0); near(landscape[5], 0.5); near(landscape[7], -0.5);
});

void test('shared tilt light selects the downhill side of the horizontal model ring', () => {
  const mesh = JSON.parse(readFileSync('web/artwork/gyroscope/mesh.json', 'utf8')) as { vertices: number[][]; lightRing: number[] };
  for (let step = 0; step < 72; step++) {
    const angle = step * Math.PI / 36;
    const roll = 18 * Math.sin(angle), pitch = -18 * Math.cos(angle);
    const light = lightFromTilt(screenTilt(orientationGravity(pitch, roll)!, { x: 0, y: 0 }, 0));
    // Yaw must not change gravity in the tray plane or the downhill marker.
    for (const yaw of [0, 45, 120]) {
      const m = rotationMatrix(modelQuaternion(gyroQuaternion({ x: roll, y: pitch, z: yaw })));
      const height = ([x, y, z]: readonly number[]) => m[3] * x + m[4] * y + m[5] * z;
      const marker = ringMarkerPoint(mesh.vertices, mesh.lightRing, light.direction);
      const lowest = Math.min(...mesh.lightRing.map(index => height(mesh.vertices[index])));
      assert.ok(Math.abs(height(marker) - lowest) < 0.002, 'Marker must stay on the lowered side for the same roll/pitch sample');
    }
  }
  const yaw = rotationMatrix(modelQuaternion(gyroQuaternion({ x: 0, y: 0, z: 90 })));
  near(yaw[4], 1); // A flat tray spun around its normal stays flat.
});

void test('first sensor pose establishes rest; a held tilt stops the animation', () => {
  const pose = new GyroscopePose();
  pose.receive({ x: 35, y: 0, z: 80 }, 'bluetooth');
  near(settle(pose)[0], 1);
  pose.receive({ x: 65, y: 0, z: 80 }, 'bluetooth');
  near(settle(pose)[2], 0.5);
  assert.equal(pose.settled, true);
  const fixed = pose.advance(1);
  assert.deepEqual(pose.advance(1), fixed);
});

void test('crossing plus/minus 180 follows the short path, never a full spin', () => {
  const pose = new GyroscopePose();
  pose.receive({ ...zero, z: 179 }, 'local');
  pose.receive({ ...zero, z: -179 }, 'local');
  const halfway = rotationMatrix(pose.advance(0.05));
  assert.ok(halfway[0] > 0.999 && halfway[3] > 0);
  const final = settle(pose);
  near(final[3], Math.sin(2 * Math.PI / 180));
});

void test('disconnect freezes the visible pose and a new source keeps continuity', () => {
  const pose = new GyroscopePose();
  pose.receive(zero, 'bluetooth');
  pose.receive({ ...zero, x: 40 }, 'bluetooth');
  pose.advance(0.05);
  pose.receive(null, 'none');
  const held = pose.advance(0);
  assert.deepEqual(pose.advance(10), held);
  pose.receive({ x: -110, y: 75, z: 150 }, 'local');
  const recovered = pose.advance(0.1);
  held.forEach((value, i) => near(value, recovered[i]));
  pose.receive({ x: NaN, y: 0, z: 0 }, 'local');
  assert.ok(pose.advance(1).every(Number.isFinite));
});

void test('marker stays on the horizontal model rim for an entire turn, including wraparound', () => {
  const mesh = JSON.parse(readFileSync('web/artwork/gyroscope/mesh.json', 'utf8')) as { vertices: number[][]; edges: number[][]; lightRing: number[] };
  const { vertices, lightRing } = mesh;
  assert.equal(lightRing.length, 48);
  const edges = new Set(mesh.edges.map(([a, b]) => [Math.min(a, b), Math.max(a, b)].join(':')));
  for (let i = 0; i < lightRing.length; i++) {
    const a = lightRing[i], b = lightRing[(i + 1) % lightRing.length];
    assert.ok(edges.has([Math.min(a, b), Math.max(a, b)].join(':')), 'Every segment is an actual model edge');
  }
  for (let i = 0; i <= 720; i++) {
    const point = ringMarkerPoint(vertices, lightRing, i * Math.PI / 360);
    near(point[1], 0.051238);
    assert.ok(Math.hypot(point[0], point[2]) > 0.996, 'No jumps to the inner ring, vertical ring or supports');
  }
  const before = ringMarkerPoint(vertices, lightRing, -0.0001);
  const after = ringMarkerPoint(vertices, lightRing, 0.0001);
  assert.ok(Math.hypot(...before.map((v, i) => v - after[i])) < 0.001);
  // A nearly edge-on pose must still move continuously on the same rim.
  for (const pitch of [-0.01, 0, 0.01, 45, 90]) {
    const m = rotationMatrix(gyroQuaternion({ x: 0, y: pitch, z: 0 }));
    const projected = vertices.map(([x, y, z]) => [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z]);
    let last = ringMarkerPoint(projected, lightRing, 0);
    for (let step = 1; step <= 720; step++) {
      const point = ringMarkerPoint(projected, lightRing, step * Math.PI / 360);
      assert.ok(Math.hypot(...point.map((v, i) => v - last[i])) < 0.009);
      last = point;
    }
  }
});
