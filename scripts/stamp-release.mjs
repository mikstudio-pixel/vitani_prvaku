import { readFile, writeFile } from 'node:fs/promises';

const version = process.env.NEXT_PUBLIC_APP_VERSION || 'development';
const directory = new URL('../dist/', import.meta.url);
const manifestPath = new URL('manifest.webmanifest', directory);
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

// New Home Screen installations start at an uncached URL for this release.
// Existing installations can check version.json and refresh inside the app.
manifest.start_url = `./?v=${encodeURIComponent(version)}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(new URL('version.json', directory), `${JSON.stringify({ version })}\n`);
