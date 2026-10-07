import { useEffect, useRef } from 'react';
import { isNativePaused, type GyroAngles, type TiltLight } from '@/lib/native-host';
import { TiltLightMotion } from '@/lib/tilt-light';
import { GyroscopePose, gyroscopeModelMatrix, ringMarkerPoint, type Quaternion } from '@/lib/gyroscope-pose';
import mesh from './artwork/gyroscope/mesh.json';

// The model is projected at the original 140 × 140 Figma location. Only creases
// and changing silhouette edges are drawn; triangulation never becomes visible.
const side = 140;
function drawModel(context: CanvasRenderingContext2D, pose: Quaternion, ratio: number, light: TiltLight) {
  const m = gyroscopeModelMatrix(pose);
  const points = mesh.vertices.map(([x, y, z]) => {
    const scale = 64; // Orthographic camera keeps silhouette tests and the UI size exact.
    return [70 + (m[0] * x + m[1] * y + m[2] * z) * scale,
      70 - (m[3] * x + m[4] * y + m[5] * z) * scale];
  });
  const facing = mesh.normals.map(([x, y, z]) => m[6] * x + m[7] * y + m[8] * z);
  const outline = new Path2D();
  for (const [a, b, first, second, crease] of mesh.edges) {
    if (!crease && facing[first] * facing[second] >= 0) continue;
    const p = points[a], q = points[b];
    outline.moveTo(p[0], p[1]); outline.lineTo(q[0], q[1]);
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.clearRect(0, 0, side, side);
  context.strokeStyle = '#bfbab2'; context.lineWidth = 0.75; context.lineCap = 'round'; context.lineJoin = 'round';
  context.globalAlpha = 1; context.stroke(outline);
  if (light.strength > 0.001) {
    // Interpolate the same horizontal rim in every pose. Projecting its fixed
    // vertices with the model prevents jumps to another ring or a support.
    const [x, y] = ringMarkerPoint(points, mesh.lightRing, light.direction);
    context.save();
    context.globalAlpha = Math.pow(light.strength, 0.3);
    context.shadowColor = '#1279ff'; context.shadowBlur = 8 * ratio;
    context.fillStyle = '#1279ff'; context.beginPath(); context.arc(x, y, 3, 0, Math.PI * 2); context.fill();
    context.shadowBlur = 0; context.fillStyle = '#1279ff'; context.beginPath(); context.arc(x, y, 1.4, 0, Math.PI * 2); context.fill();
    context.restore();
  }
}

export function GyroscopeModel({ gyro, light, source, active }: { gyro: GyroAngles | null; light: TiltLight | null; source: string; active: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const pose = useRef(new GyroscopePose());
  const indicator = useRef(new TiltLightMotion());
  const visible = useRef(active);
  const wake = useRef<() => void>(() => {});

  useEffect(() => {
    const node = canvas.current;
    const context = node?.getContext('2d');
    if (!node || !context) return;
    let frame = 0, previous = 0, ratio = 1;
    let drawn: Quaternion | null = null;
    let drawnLight: TiltLight | null = null;
    const enabled = () => visible.current && !document.hidden && !isNativePaused();
    const tick = (time: number) => {
      frame = 0;
      if (!enabled()) return;
      const dt = previous ? Math.min(0.1, (time - previous) / 1000) : 1 / 60;
      previous = time;
      const next = pose.current.advance(dt);
      const signal = indicator.current.advance(dt);
      if (!drawn || next.some((value, index) => value !== drawn![index]) || signal.direction !== drawnLight?.direction || signal.strength !== drawnLight?.strength) {
        drawModel(context, next, ratio, signal);
        drawn = next;
        drawnLight = signal;
        node.dataset.lightDirection = String(signal.direction);
        node.dataset.lightStrength = String(signal.strength);
      }
      if (!pose.current.settled || !indicator.current.settled) frame = requestAnimationFrame(tick);
    };
    const refresh = () => {
      if (!enabled()) { cancelAnimationFrame(frame); frame = 0; previous = 0; }
      else if (!frame) { previous = 0; frame = requestAnimationFrame(tick); }
    };
    const resize = () => {
      ratio = Math.min(3, window.devicePixelRatio || 1);
      drawn = null;
      node.width = Math.round(side * ratio); node.height = Math.round(side * ratio);
      refresh();
    };
    wake.current = refresh;
    resize();
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('michas:power', refresh);
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(frame); wake.current = () => {};
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('michas:power', refresh);
      window.removeEventListener('resize', resize);
    };
  }, []);

  useEffect(() => {
    visible.current = active;
    // UIKit and Safari report the screen's rotation relative to portrait.
    // eslint-disable-next-line typescript/no-deprecated -- Safari/iPad orientation compatibility.
    const legacyAngle = window.orientation;
    const angle = Number.isFinite(legacyAngle) ? legacyAngle : window.screen.orientation?.angle ?? 0;
    pose.current.receive(gyro, source, angle);
    wake.current();
  }, [gyro, source, active]);

  useEffect(() => { indicator.current.receive(light); wake.current(); }, [light]);

  return <canvas ref={canvas} className="gyroscope-model" width={side} height={side}
    style={{ visibility: active ? 'visible' : 'hidden' }} aria-hidden="true" />;
}
