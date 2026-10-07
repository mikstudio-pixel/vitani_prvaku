// Bind before mounting React so saved presentation mode applies to the first frame.
export function bindPresentationMode() {
  const apply = (enabled: boolean) => {
    document.documentElement.dataset.presentation = String(enabled);
    if (enabled && document.activeElement instanceof HTMLElement && document.activeElement.closest('[data-operator-ui]')) {
      document.activeElement.blur();
    }
  };
  apply(false);
  const receive = (event: Event) => {
    const enabled: unknown = (event as CustomEvent).detail;
    if (typeof enabled !== 'boolean') return;
    apply(enabled);
    event.preventDefault();
  };
  window.addEventListener('michas:presentation', receive);
  return () => window.removeEventListener('michas:presentation', receive);
}
