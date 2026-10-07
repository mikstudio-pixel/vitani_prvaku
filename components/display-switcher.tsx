import type { DisplayRole } from '@/lib/display-calibration';

/** All three browser views belong to this event's Pages path. */
export function DisplaySwitcher({ current }: {
  current: DisplayRole | 'center';
  sidePreview?: boolean;
}) {
  const base = `${process.env.NEXT_PUBLIC_BASE_PATH || ''}/`;
  const links = [
    { role: 'left', label: 'Levý', href: `${base}?display=left` },
    { role: 'center', label: 'Střed', href: base },
    { role: 'right', label: 'Pravý', href: `${base}?display=right` },
  ];
  return <nav className="display-switcher" data-operator-ui data-display={current} aria-label="Výběr displeje">
    {links.map(({ role, label, href }) => <a key={role} href={href} aria-current={role === current ? 'page' : undefined}>{label}</a>)}
  </nav>;
}
