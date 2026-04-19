// Renders public/og-image.svg → public/og-default.png at 1200×630, embedding
// Inter (400 + 700) at render time so the PNG renders with the brand font
// even on machines without Inter system-installed. The committed SVG stays
// clean and editable — the font data is never written back to it.
//
// Usage: node scripts/build-og-image.mjs
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC = join(ROOT, 'public', 'og-image.svg');
const OUT = join(ROOT, 'public', 'og-default.png');
const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'og-fonts');

const FONTS = [
  { family: 'Inter', weight: 400, file: 'inter-400.woff2' },
  { family: 'Inter', weight: 700, file: 'inter-700.woff2' },
];

async function fetchFont({ family, weight, file }) {
  const cached = join(CACHE_DIR, file);
  if (existsSync(cached)) return readFile(cached);
  const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&display=swap`;
  const cssRes = await fetch(cssUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  if (!cssRes.ok) throw new Error(`CSS fetch failed: ${cssRes.status}`);
  const css = await cssRes.text();
  const match = css.match(/url\((https:\/\/[^)]+\.woff2)\)/);
  if (!match) throw new Error(`No woff2 URL found for ${family} ${weight}`);
  const fontRes = await fetch(match[1]);
  if (!fontRes.ok) throw new Error(`Font fetch failed: ${fontRes.status}`);
  const buf = Buffer.from(await fontRes.arrayBuffer());
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(cached, buf);
  return buf;
}

async function main() {
  const svg = await readFile(SRC, 'utf8');
  const fontBufs = await Promise.all(FONTS.map(fetchFont));
  const faces = FONTS.map(
    (f, i) =>
      `@font-face{font-family:'Inter';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${fontBufs[i].toString('base64')}) format('woff2');}`,
  ).join('');
  const styleBlock = `<defs><style type="text/css"><![CDATA[${faces}]]></style></defs>`;
  const svgWithFonts = svg.replace(/(<svg[^>]*>)/, `$1${styleBlock}`);

  const png = await sharp(Buffer.from(svgWithFonts), { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .png()
    .toBuffer();
  await writeFile(OUT, png);

  const meta = await sharp(OUT).metadata();
  const sizeKB = (png.length / 1024).toFixed(1);
  console.log(`Wrote ${OUT}`);
  console.log(`  ${meta.width}×${meta.height}  ${sizeKB} KB  (${meta.channels} channels, ${meta.format})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
