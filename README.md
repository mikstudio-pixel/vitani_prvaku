# Mícháš? — Vítání prváků

Independent browser-only copy for a new event.

Website: https://mikstudio-pixel.github.io/vitani_prvaku/

## Development

Use Node.js 24, then `npm ci` and `npm run dev` (port 3001).
Run `npm run typecheck`, `npm test`, and `npm run build` before review.
Production builds and previews default to `/vitani_prvaku/`.
Set `NEXT_PUBLIC_APP_VERSION` to the release commit;
`NEXT_PUBLIC_BASE_PATH` can explicitly override the build path. `npm run preview` serves `dist`.

Tap the bowl in Safari to grant sensor access and unlock audio. Desktop users
can drag the bowl or use arrow keys. The view switcher shows the center, left,
and right views; browser views use their own sensors and do not synchronize
with the exhibition's native iPads. Native BLE, kiosk power controls, native
updates and the Mac operator panel are not included. No offline service worker
is installed; loading the site requires an internet connection.

## Isolation and releases

The source was copied from the local Designblok working tree at base commit
`8311ecd`, including the then-current uncommitted web changes. Native apps,
native update packages, `.git`, environment files, build products, and the
original `.openai` hosting identity were excluded. Shared graphics live in
`web/` rather than `native/web/`.

Internal browser events use `vitani-prvaku:*` and ignore the exhibition’s
`michas:*` events. All persistent browser settings use `vitani-prvaku.*`, including sensor
calibration and legacy settings migrations. Opening this event on the same
Pages hostname does not intentionally read or write `michas.*` settings.
The native bridge is hard-disabled: injected native globals are ignored and
no commands or acknowledgements are sent to a Designblok WKWebView.
Neither building nor deploying this repository sends updates to native iPads.

`tests.yml` is manual so remote CI can run once after reviews are complete.
`pages.yml` deploys only this repository's `main` to its own Pages environment.
To roll back, revert the release change in this repository and redeploy.
Never select this folder as an update package in the exhibition's Mac panel.

The initial copy preserves the existing artwork, fonts, sound assets and QR
link. Event-specific content has not yet been changed. The combined final message
and twenty-second restart are preserved; QR reveal settings are limited to
5–20 seconds so they fit the final countdown. Asset provenance remains
in `web/sounds/README.md` and the font license files in `public/fonts/`; verify
that the event's licenses cover public web use before advertising the site.

For the browser recovery regression, start `npm run dev` and open
`/tests/browser-recovery.html` on the printed local port. The fixture deliberately
fails the first WebGL allocation and denies motion permission. Select Úsporný
in Nastavení: the graphics error must disappear and the bowl must become active.
Then select Detailní: the third allocation deliberately fails, disabling the
bowl while the quality selector stays available. Select Úsporný again to recover.
Press Enter on the bowl to deny sensors, then use arrow keys; the scenario must
still reach the mixing prompt. This fixture is not included in the Pages build.

The local-only `/tests/browser-repeat.html` fixture runs three consecutive gesture restarts with the material physics paused, using the real WebGL bowl and scenario indicator. Each reset clears input activity; circular browser input must leave standby without moving the frozen material.
