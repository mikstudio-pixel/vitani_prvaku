import type { GyroAngles } from './native-host';

export type Quaternion = [number, number, number, number];
const identity = (): Quaternion => [0, 0, 0, 1];
const inverse = ([x, y, z, w]: Quaternion): Quaternion => [-x, -y, -z, w];
export function multiplyQuaternion(a: Quaternion, b: Quaternion): Quaternion {
  const [x, y, z, w] = a, [X, Y, Z, W] = b;
  return [w * X + x * W + y * Z - z * Y, w * Y - x * Z + y * W + z * X,
    w * Z + x * Y - y * X + z * W, w * W - x * X - y * Y - z * Z];
}
function axisRotation(axis: 0 | 1 | 2, degrees: number): Quaternion {
  const half = degrees * Math.PI / 360;
  const q: Quaternion = [0, 0, 0, Math.cos(half)];
  q[axis] = Math.sin(half);
  return q;
}

/** Wire X/Y/Z are Core Motion roll/pitch/yaw, not rotations about X/Y/Z.
 * Roll is about the device's Y axis, pitch about X; attitude uses Z-X-Y order.
 * https://developer.apple.com/documentation/coremotion/cmattitude/roll
 */
export function gyroQuaternion(gyro: GyroAngles, screenAngle = 0): Quaternion {
  const device = multiplyQuaternion(axisRotation(2, gyro.z), multiplyQuaternion(axisRotation(0, gyro.y), axisRotation(1, gyro.x)));
  const screen = axisRotation(2, screenAngle);
  return multiplyQuaternion(screen, multiplyQuaternion(device, inverse(screen)));
}

/** Put browser Z-X-Y Euler angles in the same roll/pitch/yaw slots as iOS. */
export function browserGyro(alpha: number, beta: number, gamma: number): GyroAngles {
  return { x: gamma, y: beta, z: ((alpha + 180) % 360) - 180 };
}

export function rotationMatrix(q: Quaternion): number[] {
  const [x, y, z, w] = q;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
}

// Device XY is the tray plane; the OBJ uses XZ with +Y up.
// Map device +Y (top) to model −Z (far), and device +Z to model +Y.
const deviceToModel = axisRotation(0, -90);
export function modelQuaternion(pose: Quaternion): Quaternion {
  return multiplyQuaternion(deviceToModel, multiplyQuaternion(pose, inverse(deviceToModel)));
}

// Keep the illustration's camera fixed while rotating in the tray's own axes.
const modelView = gyroQuaternion({ x: 25, y: 18, z: -6 });
export function gyroscopeModelMatrix(pose: Quaternion): number[] {
  return rotationMatrix(multiplyQuaternion(modelView, modelQuaternion(pose)));
}

/** Travel on one closed model-space rim, preserving the same rim through
 * every pose (including an edge-on projection). Zero is the ring's far side. */
export function ringMarkerPoint(points: readonly (readonly number[])[], ring: readonly number[], direction: number): number[] {
  const turn = Math.PI * 2;
  const position = ((direction % turn + turn) % turn) / turn * ring.length;
  const index = Math.floor(position), fraction = position - index;
  const a = points[ring[index]], b = points[ring[(index + 1) % ring.length]];
  return a.map((value, axis) => value + (b[axis] - value) * fraction);
}

export class GyroscopePose {
  private reference: Quaternion | null = null;
  private anchor = identity();
  private target = identity();
  private current = identity();
  private source = '';

  receive(gyro: GyroAngles | null, source: string, screenAngle = 0) {
    if (!gyro || !Object.values(gyro).every(Number.isFinite)) {
      // Keep the last visible pose on disconnect; don't animate toward a fake zero.
      this.reference = null;
      this.target = [...this.current];
      return;
    }
    const q = gyroQuaternion(gyro, screenAngle);
    const key = `${source}:${screenAngle}`;
    if (!this.reference || this.source !== key) {
      this.reference = q;
      this.anchor = [...this.current];
      this.source = key;
    }
    this.target = multiplyQuaternion(this.anchor, multiplyQuaternion(inverse(this.reference), q));
  }

  advance(seconds: number): Quaternion {
    const dot = this.current.reduce((sum, value, i) => sum + value * this.target[i], 0);
    const sign = dot < 0 ? -1 : 1; // q and -q represent the same rotation.
    const amount = 1 - Math.exp(-Math.max(0, seconds) / 0.075);
    const next = this.current.map((value, i) => value + (sign * this.target[i] - value) * amount) as Quaternion;
    const length = Math.hypot(...next);
    this.current = next.map(value => value / length) as Quaternion;
    if (this.settled) this.current = this.target.map(value => value * sign) as Quaternion;
    return this.current;
  }

  get settled() {
    return 1 - Math.abs(this.current.reduce((sum, value, i) => sum + value * this.target[i], 0)) < 1e-7;
  }
}
