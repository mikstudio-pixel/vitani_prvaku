import { COLONY_COLORS, type ColonyValue } from '@/lib/colony-status';

const namespace = 'http://www.w3.org/2000/svg';

/** Replace only the outlined values, keeping the Figma labels and badge alignment. */
export function mountColonyValues(svg: SVGSVGElement, idPrefix = '') {
  const warning = svg.querySelector<SVGGElement>('[id="Warning / Triangle_Warning"]')!;
  const initialVisibility = warning.getAttribute('visibility');
  warning.setAttribute('visibility', 'hidden');
  const rows = [181, 182, 183, 184, 185].map(id => {
    const group = svg.querySelector<SVGGElement>(`[id="Frame 2147207696_${id}"]`)!;
    const rect = group.querySelector('rect')!;
    const original = group.querySelector('path')!;
    const label = svg.querySelector<SVGGElement>(`[id="Frame 2147207695_${id}"]`)!;
    // Figma exports the title and decorative slash leader as separate paths.
    // Keep fixed titles outside the dynamic clip when badge widths change.
    const leader = label.querySelector<SVGPathElement>('path[fill-opacity]')!;
    const clip = document.createElementNS(namespace, 'clipPath');
    clip.id = `${idPrefix}colony-label-${id}`;
    clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
    const bounds = document.createElementNS(namespace, 'rect');
    bounds.setAttribute('x', '1301'); bounds.setAttribute('y', rect.getAttribute('y')!);
    bounds.setAttribute('height', '17'); clip.appendChild(bounds); svg.querySelector('defs')!.appendChild(clip);
    leader.setAttribute('clip-path', `url(#${clip.id})`);
    const text = document.createElementNS(namespace, 'text');
    text.setAttribute('x', '1573'); text.setAttribute('y', String(Number(rect.getAttribute('y')) + 13));
    text.setAttribute('text-anchor', 'end'); text.setAttribute('class', 'colony-value-text');
    original.replaceWith(text);
    rect.classList.add('colony-value-badge');
    return { group, rect, original, leader, clip, bounds, text, initialRect: { x: rect.getAttribute('x')!, width: rect.getAttribute('width')!, fill: rect.getAttribute('fill')! }, value: '' };
  });
  let disposed = false;
  const resize = () => rows.forEach(({ rect, bounds, text }) => {
    const width = Math.ceil(text.getComputedTextLength()) + 10;
    rect.setAttribute('x', String(1578 - width)); rect.setAttribute('width', String(width));
    // Shorten the decorative slash leaders, never the label or the value.
    bounds.setAttribute('width', String(1578 - width - 8 - 1301));
  });
  void document.fonts.load('12px "Space Mono"').then(() => { if (!disposed) resize(); });
  return {
    update(values: ColonyValue[]) {
      warning.setAttribute('visibility', values.some(value => value.tone !== 'positive') ? 'visible' : 'hidden');
      let changed = false;
      rows.forEach((row, index) => {
        const value = values[index], color = COLONY_COLORS[value.tone];
        if (row.value === value.label) return;
        changed = true;
        row.value = value.label; row.text.textContent = value.label.toLocaleUpperCase('cs');
        row.text.style.fill = color; row.rect.style.fill = color;
        row.group.setAttribute('aria-label', value.label);
        row.group.dataset.tone = value.tone;
        row.text.getAnimations().forEach(animation => animation.cancel());
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          row.text.animate([{ opacity: 0, transform: 'translateY(2px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 240, easing: 'ease-out' });
        }
      });
      if (changed) resize();
    },
    dispose() {
      disposed = true;
      if (initialVisibility === null) warning.removeAttribute('visibility');
      else warning.setAttribute('visibility', initialVisibility);
      rows.forEach(({ text, original, leader, clip, rect, group, initialRect }) => {
        text.getAnimations().forEach(animation => animation.cancel()); text.replaceWith(original);
        clip.remove(); leader.removeAttribute('clip-path');
        rect.classList.remove('colony-value-badge'); rect.style.removeProperty('fill');
        for (const [name, value] of Object.entries(initialRect)) rect.setAttribute(name, value);
        group.removeAttribute('aria-label'); delete group.dataset.tone;
      });
    },
  };
}
