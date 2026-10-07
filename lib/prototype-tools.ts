import type { Tilt } from './tilt';

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => Promise<unknown>;
};
type ToolContext = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };

export function registerPrototypeTools(setTilt: (value: Tilt) => void, reset: () => void) {
  const context = (document as Document & { modelContext?: ToolContext }).modelContext;
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  const painted = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const register = (tool: Tool) => {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser capability. */ }
  };
  register({
    name: 'set_tray_tilt',
    description: 'Set the same virtual tray tilt as dragging directly on the bowl. X is right and Y is down. Zero on both axes levels the tray.',
    inputSchema: { type: 'object', properties: { x: { type: 'number', minimum: -1, maximum: 1 }, y: { type: 'number', minimum: -1, maximum: 1 } }, required: ['x', 'y'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      if (!input || typeof input !== 'object') throw new Error('Expected x and y.');
      const { x, y } = input as Tilt;
      if (Object.keys(input).some((key) => key !== 'x' && key !== 'y') || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1 || Math.abs(y) > 1) throw new Error('x and y must be finite numbers between -1 and 1.');
      const magnitude = Math.max(1, Math.hypot(x, y));
      const value = { x: x / magnitude, y: y / magnitude };
      setTilt(value); await painted(); return value;
    },
  });
  register({
    name: 'reset_bowl', description: 'Replace the mixed contents with a new portion, using the same action as the R keyboard shortcut.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    async execute(input) {
      if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Expected an empty object.');
      reset(); await painted(); return { reset: true };
    },
  });
  return () => lifecycle.abort();
}
