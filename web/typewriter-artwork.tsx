import { useLayoutEffect, useRef, type RefObject } from 'react';
import { replacedByIncoming } from '@/lib/typewriter-transition';
import { markStartupElements } from '@/lib/startup-flicker';

const ns = 'http://www.w3.org/2000/svg';
type Box = { x: number; y: number; width: number; height: number; d: string };
type Caption = { node: SVGGElement; glyphs: SVGPathElement[]; signature: string; outline: string; number: SVGTextElement | null; blank: SVGRectElement | null };
const cache = new Map<string, Box[]>();


/** Recover glyph regions from the original outlines, including counters and accents. */
function glyphBoxes(path: SVGPathElement, svg: SVGSVGElement): Box[] {
  const d = path.getAttribute('d')!;
  const cached = cache.get(d);
  if (cached) return cached;
  const probe = document.createElementNS(ns, 'path');
  probe.setAttribute('visibility', 'hidden');
  svg.appendChild(probe);
  const contours = (d.match(/[Mm][^Mm]+/g) ?? []).map(contour => {
    probe.setAttribute('d', contour);
    const { x, y, width, height } = probe.getBBox();
    return { x, y, width, height, d: contour };
  });
  probe.remove();
  const baselines: number[] = [];
  const bodyHeight = Math.max(...contours.map(box => box.height));
  contours.filter(box => box.height > bodyHeight * .8).map(box => box.y + box.height).sort((a, b) => a - b).forEach(bottom => {
    if (!baselines.some(line => Math.abs(line - bottom) < 5)) baselines.push(bottom);
  });
  const boxes = baselines.flatMap((_, line) => {
    const row = contours.filter(box => {
      const bottom = box.y + box.height;
      return baselines.findIndex(y => bottom <= y + 5) === line;
    }).sort((a, b) => a.x - b.x);
    const glyphs: Box[] = [];
    for (const box of row) {
      const previous = glyphs.at(-1);
      if (previous && box.x < previous.x + previous.width + .5) {
        const right = Math.max(previous.x + previous.width, box.x + box.width);
        const bottom = Math.max(previous.y + previous.height, box.y + box.height);
        previous.y = Math.min(previous.y, box.y);
        previous.width = right - previous.x;
        previous.height = bottom - previous.y;
        previous.d += box.d;
      } else glyphs.push({ ...box });
    }
    return glyphs;
  });
  cache.set(d, boxes);
  return boxes;
}

/** Out and in share one clock: erase old glyphs from the left while typing new ones. */
function useOutlinedCaption(root: RefObject<HTMLSpanElement | null>, overlay: RefObject<SVGSVGElement | null>, markup: string, retrySeconds: number | null, selector: string, slot: string, delay: number, entry: string, frameTime?: number) {
  const current = useRef<Caption | null>(null);
  const generation = useRef(0);
  const animation = useRef(0);
  const manualTime = useRef(frameTime);
  useLayoutEffect(() => { manualTime.current = frameTime; }, [frameTime]);
  const seek = useRef<((elapsed: number) => void) | null>(null);
  useLayoutEffect(() => () => cancelAnimationFrame(animation.current), []);
  useLayoutEffect(() => {
    const svg = root.current!.querySelector('svg')!;
    const path = svg.querySelector<SVGPathElement>(selector);
    if (!path) {
      cancelAnimationFrame(animation.current);
      current.current?.node.remove(); current.current = null;
      for (const child of Array.from(overlay.current!.children)) if ((child as SVGElement).dataset.captionSlot === slot) child.remove();
      return;
    }
    const bounds = path.getBBox(), origin = svg.viewBox.baseVal;
    const signature = `${entry}:${path.id.replace(/_\d+$/, '')}:${(bounds.x - origin.x).toFixed(1)}:${(bounds.y - origin.y).toFixed(1)}`;
    path.style.visibility = 'hidden';
    if (current.current?.signature === signature) return;
    cancelAnimationFrame(animation.current);
    let old = current.current;
    // Waking repeats the standby artwork, but the first visible headline starts empty.
    if (old?.outline === path.getAttribute('d')) { old.node.remove(); old = null; }
    // An interrupted transition retains only its latest caption.
    for (const child of Array.from(overlay.current!.children)) if ((child as SVGElement).dataset.captionSlot === slot && child !== old?.node) child.remove();
    const node = document.createElementNS(ns, 'g');
    node.dataset.captionSlot = slot;
    const ink = document.createElementNS(ns, 'g');
    const glyphs = glyphBoxes(path, svg).map(box => {
      const glyph = path.cloneNode(false) as SVGPathElement;
      glyph.removeAttribute('id'); glyph.style.removeProperty('visibility');
      glyph.setAttribute('d', box.d);
      glyph.setAttribute('transform', `translate(${-origin.x} ${-origin.y})`);
      glyph.dataset.glyph = JSON.stringify({ x: box.x - origin.x, y: box.y - origin.y, width: box.width, height: box.height });
      glyph.style.visibility = 'hidden';
      ink.appendChild(glyph);
      return glyph;
    });
    node.appendChild(ink);
    let number: SVGTextElement | null = null;
    let blank: SVGRectElement | null = null;
    if (path.id.startsWith('Počkej')) {
      blank = document.createElementNS(ns, 'rect');
      for (const [key, value] of Object.entries({ x: 402, y: 334, width: 54, height: 32, fill: '#000' })) blank.setAttribute(key, String(value));
      number = document.createElementNS(ns, 'text');
      for (const [key, value] of Object.entries({ x: 402, y: 363, 'font-family': 'PP Neue Machina', 'font-weight': 400, 'font-size': 38, fill: '#BFBAB2' })) number.setAttribute(key, String(value));
      number.textContent = '10';
      ink.appendChild(blank); ink.appendChild(number);
    }
    overlay.current!.appendChild(node);
    current.current = { node, glyphs, signature, outline: path.getAttribute('d')!, number, blank };
    const frameRect = path.parentElement?.parentElement?.querySelector(':scope > rect');
    const panel = frameRect instanceof SVGRectElement ? frameRect.getBBox() : null;
    const token = ++generation.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count = Math.max(glyphs.length, Math.ceil((old?.glyphs.length ?? 0) / 2));
    const interval = Math.min(55, 1400 / Math.max(1, count));
    const started = performance.now();
    let sounded = 0;
    const tick = (now: number) => {
      if (generation.current !== token) return;
      const cursor = reduced ? count : Math.max(0, Math.floor((now - started - delay) / interval));
      const typed = Math.min(cursor, glyphs.length);
      if (typed > sounded && !reduced && manualTime.current === undefined) window.dispatchEvent(new Event('vitani-prvaku:typing'));
      sounded = typed;
      const region = (glyph: SVGPathElement) => JSON.parse(glyph.dataset.glyph!) as Box;
      const revealed = glyphs.slice(0, cursor).map(region);
      glyphs.forEach((glyph, i) => { glyph.style.visibility = i < cursor ? 'visible' : 'hidden'; });
      old?.glyphs.forEach((rect, i) => {
        // Erase the entire old glyph wherever incoming ink arrives.
        const box = region(rect);
        const outsidePanel = panel && (box.y < panel.y - origin.y || box.y + box.height > panel.y + panel.height - origin.y);
        if (i < cursor * 2 || outsidePanel || replacedByIncoming(box, revealed)) rect.style.visibility = 'hidden';
      });
      if (number && blank) {
        const digits = glyphs.filter(glyph => { const box = region(glyph); return box.x < 456 && box.y > 330 && box.y < 366; });
        const visible = digits[0]?.style.visibility === 'visible';
        number.style.visibility = blank.style.visibility = visible ? 'visible' : 'hidden';
      }
      if (old?.number && old.blank && old.glyphs.find(glyph => { const box = region(glyph); return box.x < 456 && box.y > 330 && box.y < 366; })?.style.visibility === 'hidden') {
        old.number.style.visibility = old.blank.style.visibility = 'hidden';
      }
      node.dataset.typed = String(Math.min(cursor, glyphs.length));
      if (cursor < count) {
        if (manualTime.current === undefined) animation.current = requestAnimationFrame(tick);
      } else old?.node.remove();
    };
    seek.current = elapsed => tick(started + elapsed);
    tick(started + (manualTime.current ?? 0));
  }, [markup, selector, slot, delay, entry, root, overlay]);
  useLayoutEffect(() => {
    if (frameTime !== undefined) seek.current?.(frameTime);
  }, [frameTime]);
  useLayoutEffect(() => {
    const caption = current.current;
    if (caption?.number && caption.blank && retrySeconds !== null) {
      caption.number.textContent = String(retrySeconds);
      // The initial 10 remains the exact Figma outline.
      caption.number.style.display = caption.blank.style.display = retrySeconds === 10 ? 'none' : '';
    }
  }, [retrySeconds, markup]);
}

export function TypewriterArtwork({ markup, retrySeconds, flickerMessage = false, entry = '', frameTime }: { markup: string; retrySeconds: number | null; flickerMessage?: boolean; entry?: string; frameTime?: number }) {
  const root = useRef<HTMLSpanElement>(null);
  const overlay = useRef<SVGSVGElement>(null);
  // React must not restore the static outlines on telemetry/countdown renders.
  useLayoutEffect(() => { root.current!.innerHTML = markup; }, [markup]);
  useLayoutEffect(() => {
    const svg = root.current!.querySelector('svg')!;
    markStartupElements(svg);
    // Animate independent message groups, including the QR as one intact unit.
    // The body text is typed separately; its parent must not flicker over it.
    const message = svg.querySelector('[id="Frame 2147207736"]');
    if (flickerMessage && message) {
      const elements = [...message.querySelectorAll('[data-startup-flicker]'), ...svg.querySelectorAll('[id="Zprává"], [id^="Vector 71_"]')];
      elements.forEach((node, index) => {
        if (node.querySelector('[id^="Koukej, co u nás vaříme"]')) return;
        node.setAttribute('data-phase-entry', '');
        (node as SVGElement).style.setProperty('--startup-delay', `${(index % 12) * .023}s`);
      });
    }
  }, [markup, flickerMessage]);
  useOutlinedCaption(root, overlay, markup, retrySeconds, '[id^="Frame 2147207677"] > path', 'main', 0, entry, frameTime);
  useOutlinedCaption(root, overlay, markup, null, '[id^="Koukej, co u nás vaříme"]', 'message', flickerMessage ? 580 : 0, '', frameTime);
  return <span className="typewriter-artwork">
    <span className="scenario-artwork" ref={root} />
    <svg ref={overlay} className="typewriter-caption" viewBox="0 0 744 1073" aria-hidden="true" />
  </span>;
}
