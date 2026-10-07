# Mícháš? — Vítání prváků

Independent browser-only copy for a new event.

Website: https://mikstudio-pixel.github.io/vitani_prvaku/

## Development

Use Node.js 24, then `npm ci` and `npm run dev` (port 3001).
Run `npm run typecheck`, `npm test`, and `npm run build` before review.
Production builds and previews default to `/vitani_prvaku/`.
Set `NEXT_PUBLIC_APP_VERSION` to the release commit;
`NEXT_PUBLIC_BASE_PATH` can explicitly override the build path. `npm run preview` serves `dist`.

## Event flow

The visitor view contains only a continuously running liquid simulation and its
24 LEDs. There are no instructions, countdowns, story panels, sounds or final QR.
Open `?operator=1` before the event, press **Připravit kameru**, allow the front
camera and device motion, check framing, then press **Skrýt obsluhu**. The camera
stays warm when this panel closes. The O key also toggles operator controls.
On the plain visitor URL, the first touch requests camera permission directly;
start the one-second hold after permission is granted. HTTPS is required.

One continuous finger hold fills the LED ring clockwise over one second. A short
touch, drag over 24 CSS pixels, multiple fingers or loss of focus cancels it.
Once full, the ring flashes twice. The square mirrored camera frame is averaged
into a **90 × 90 binary mask**, with an adaptive brightness threshold. It uses
the same mask resolution and GPU gathering shader as the Bob easter egg.
The current liquid rearranges into the portrait over three seconds, holds for
three seconds, then dissolves over two seconds back into the previous liquid.
The next visitor can then start automatically. No image overlay is used.

Frames and masks remain in device memory; nothing is uploaded, saved or sent to
face recognition. Completing the portrait clears its GPU mask. Reset, quality
change and page exit clear the active image; hiding/leaving the page also stops
the camera. Prepare it again after returning. **Nový návštěvník** or R resets
immediately. Space/Enter can be held for capture; mouse dragging and arrow keys
control tilt, while the iPad uses its gyroscope. Provide even lighting and test
actual Safari permission, framing and performance on the event iPad.

This is a single web bowl. Old `display=left/right` URLs show the same bowl.
Native BLE, native updates and the Mac operator panel are excluded. No offline
service worker is installed; loading the site requires an internet connection.

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

Asset provenance remains in `web/sounds/README.md` and the font license files
in `public/fonts/`. Legacy exhibition modules and assets remain in the source,
but are not part of the visitor flow.

Local-only `/tests/browser-portrait.html?operator=1` uses a synthetic canvas
camera, never hardware. It exercises cancellation, capture, the flash/reveal
sequence, reset and consecutive visitors. `/tests/browser-portrait-fluid.html`
exercises the actual GPU mask, gradual gathering, dissolve and reset.
Neither fixture is included in the Pages build.
