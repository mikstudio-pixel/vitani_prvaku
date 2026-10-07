/** Mark independent Figma groups without animating both parent and child opacity. */
export function markStartupElements(root: Element) {
  const groups = [...root.querySelectorAll<SVGGElement>('g')]
    .filter(group => !group.closest('defs') && !group.querySelector('g'));
  groups.forEach((group, index) => {
    group.dataset.startupFlicker = '';
    group.style.setProperty('--startup-delay', `${(index % 12) * .023}s`);
  });
}
