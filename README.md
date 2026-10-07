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
There are no operator panels, camera preview, calibration controls or display
switchers, including on old `operator=1` URLs. The first touch on the bowl asks
for camera and iPad motion permission. After granting permission, hold again
for one second. HTTPS is required. Camera permission comes from the browser;
there are no app buttons surrounding the bowl.

Touch bends the simulated gravity toward the finger: a smooth local potential
well draws surrounding liquid into that point. It follows dragging, ramps up
while touching and fades after release. Multiple fingers cancel the well. Its
force acts on both surface waves and material currents; the fluid is transported
rather than painted or deleted. Capture releases the well during the flashes.

Touch also changes the liquid's own color. RGB pigment is deposited into a
material field and travels with the liquid current; the injected hue cycles
through rainbow colors while touching. Pigment tints both phases before the
existing lighting, including flat areas. Reflections remain neutral. Color
fades after release, pauses its transport with physics, stays hidden during
portraits and resets with the liquid.

One continuous finger hold fills the LED ring clockwise over one second. A short
touch, drag over 24 CSS pixels, multiple fingers or loss of focus cancels it.
Once full, the ring flashes twice. The face is isolated from the mirrored camera
frame with room around the head, then converted into a five-tone monochrome
mask at a fixed 128 × 128 resolution. Stretch and pixelation are always enabled.
The visitor sees only the bowl and its purple LED ring, without portrait
controls or camera preview images.
The current liquid rearranges into the portrait over three seconds, holds for
three seconds, then dissolves over two seconds back into the previous liquid.
The next visitor can then start automatically. No image overlay is used.

Frames and masks remain in device memory; nothing is uploaded, saved or sent to
face recognition. Completing the portrait clears its GPU mask. Reset and page exit clear the active image; hiding/leaving the page also stops
the camera. Tap the bowl again after returning to prepare the camera. R resets
immediately. Space/Enter can be held for capture; mouse dragging moves the gravity well and arrow keys
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

Local-only `/tests/browser-portrait.html` uses a synthetic canvas
camera, never hardware. It exercises cancellation, capture, the flash/reveal
sequence, reset and consecutive visitors. `/tests/browser-portrait-fluid.html`
exercises the actual GPU mask, gradual gathering, dissolve and reset.
Neither fixture is included in the Pages build.

`/tests/browser-touch-gravity.html` is a local GPU fixture for inward surface and
material currents, release fade, edge coordinates and reset, without a camera.

`/tests/browser-touch-oil.html` checks colored liquid including flat areas,
passive pigment transport, bounded concentration, rim alignment, unchanged
phase material, monochrome portraits, paused transport, release fade and reset.
It also provides a paused preview and direct touch/drag interaction.

## Soukromá galerie portrétů

Backend je samostatný Supabase projekt `efezpjzltynkfrqpasju` (Frankfurt).
Počáteční schéma v `supabase/setup.sql` bylo aplikováno 7. 10. 2026; znovu ho nespouštějte.
Veřejný publishable klíč v klientu není heslo. Tabulky i privátní bucket vyžadují přihlášení a schválený řádek `portrait_access`.

- `/pripojeni/`: jednorázové přihlášení zařízení e-mailem a heslem, nebo odhlášení.
- `/`: iPad; po začátku vynořování se jednou uloží zpracovaný monochromní PNG s aktuálními čtverečky a roztažením. Pozdější změna slideru neupravuje již uloženou fotku.
- `/galerie/`: počítač; všechny portréty se automaticky zmenšují na jednu obrazovku. Nové přicházejí přes Realtime. Křížek smaže chybnou fotku ze soukromého úložiště i galerie; po výpadku se stav synchronizuje každých 30 s.

V Authentication → Users vytvořte dva účty pomocí Add user → Create new user, ne pomocí e-mailové pozvánky.
Jejich UUID přidejte administrátorským SQL do `portrait_access`: oba účty `can_upload=true` pro čtení, ukládání a mazání. Účet s `false` má pouze čtení.
Pro mazání aplikujte jednou `supabase/allow-portrait-deletion.sql` po počátečním schématu.
Samotné založení nebo veřejná registrace účtu nezpřístupňuje fotky. Schválená zařízení nemohou přepisovat záznamy.
Přihlášení má vlastní klíč `vitani-prvaku.portrait-auth`, oddělený od původní aplikace.

Ukládají se pouze hotové černobílé portréty. Plný snímek a barevný izolovaný portrét zůstávají v paměti prohlížeče.
Při výpadku iPad drží maximálně pět neodeslaných PNG v paměti a nabízí opakování. Obnovení nebo zavření stránky tuto frontu ztratí.
Po akci smažte soubory přes Storage dashboard/API a následně řádky portrétů; samotné SQL mazání storage.objects fyzické soubory neodstraní.
Nativní aplikace ani výstavní instalace tento projekt nepoužívají.
