# Mícháš? — Vítání prváků

Independent browser-only copy for a new event.

Website: https://mikstudio-pixel.github.io/vitani_prvaku/

## Development

Use Node.js 24, then `npm ci` and `npm run dev` (port 3001).
Run `npm run typecheck`, `npm test`, and `npm run build` before review.
Production builds and previews default to `/vitani_prvaku/`.
Set `NEXT_PUBLIC_APP_VERSION` to the release commit;
`NEXT_PUBLIC_BASE_PATH` can explicitly override the build path. `npm run preview` serves `dist`.

Before the first visitor, press **Připravit kameru** and allow the front camera
and device motion in Safari. HTTPS is required; GitHub Pages provides it. The
operator can check framing in **Nastavení**. Keep the screen/front camera facing
the visitor and provide even lighting. The preview is square and mirrored like
a selfie; the bowl clips its corners.

A visitor holds one finger on the bowl for one continuous second. Releasing
sooner, dragging more than 24 CSS pixels, using multiple fingers, losing focus
or hiding the page cancels the capture. Space/Enter can be held on a keyboard.
The captured black-and-white portrait becomes the light/dark concentration of
the actual liquid, then deforms and disperses under the existing mixing flow.
A fine halftone preserves facial shades while starting with separate material;
a gray photograph must not count as already mixed. Existing intro, sounds,
mixing rules and final QR remain.

Frames are processed in memory on the device: no upload, download, photo storage,
microphone or face recognition. The active camera stays ready between visitors;
Safari displays its camera-use indicator. A new portion, automatic scenario
restart, quality change or page exit clears the previous portrait. **Nový
návštěvník** also clears it immediately. Hiding/leaving the page stops the camera;
prepare it again after returning. **Vypnout kameru** stops it manually. A pending
permission request can be cancelled; any stream that arrives later is stopped.
Actual Safari camera permissions, framing and performance must still be checked
on the event's iPad before use.

After the photograph, desktop users can drag the bowl or use arrow keys. The center view owns the real fluid simulation and measured mixing result.
The left/right views are visual previews: local sensors animate their pose,
while the Mix/Still demo controls show the full story without fabricating a
measured mixture from motion. They do not synchronize with the exhibition's
native iPads or with separate web devices. Native BLE, kiosk power controls, native
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

The local-only `/tests/browser-tilt.html?display=left` (or `right`) fixture sends five seconds of tilt readings with missing compass yaw. The side display must leave standby and identify its local gyroscope as the data source.

The local-only `/tests/browser-portrait.html` uses a synthetic canvas camera,
never the real camera. It exercises the production center view, one-second
visitor capture, readiness, reset and consecutive visitors.
`/tests/browser-portrait-fluid.html` verifies the real GPU portrait upload,
starting mixing measurement, transport and reset using a synthetic portrait.
Neither fixture is included in the Pages build.
