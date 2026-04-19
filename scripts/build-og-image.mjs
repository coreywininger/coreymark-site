// Renders public/og-image.svg → public/og-default.png at 1200×630, embedding
// Inter (400 + 700) at render time so the PNG renders with the brand font
// even on machines without Inter system-installed. The committed SVG stays
// clean and editable — the font data is never written back to it.
//
// The teal accent bar beneath the name has its `x` attribute computed at
// render time. The source SVG intentionally omits `x` on the `#accent-bar`
// rect; the script rasterizes the name in isolation, scans the raw pixel
// buffer to find the text's left/right extents, and centers the bar (whose
// width is honored from the source SVG) under the measured span.
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

function pullAttr(chunk, attr) {
  const m = chunk.match(new RegExp(`\\b${attr}="([^"]*)"`));
  return m ? m[1] : undefined;
}

async function measureNameWidth(svg, fontFaceCss) {
  const nameMatch = svg.match(/<text\b([^>]*\bid="name"[^>]*)>([^<]+)<\/text>/);
  if (!nameMatch) throw new Error('Source SVG missing <text id="name">');
  const nameAttrs = nameMatch[1];
  const nameText = nameMatch[2];
  const svgFontFamily =
    svg.match(/<svg\b[^>]*\bfont-family="([^"]+)"/)?.[1] ?? 'Inter, sans-serif';

  const fontSize = pullAttr(nameAttrs, 'font-size') ?? '96';
  const fontWeight = pullAttr(nameAttrs, 'font-weight') ?? '700';
  const letterSpacing = pullAttr(nameAttrs, 'letter-spacing') ?? '0';

  // Transparent background; solid white text at x=0 so we can scan for
  // non-zero alpha columns to find left/right extents.
  const measureSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="300" font-family="${svgFontFamily}">
  <defs><style type="text/css"><![CDATA[${fontFaceCss}]]></style></defs>
  <text x="0" y="200" fill="#ffffff" font-size="${fontSize}" font-weight="${fontWeight}" letter-spacing="${letterSpacing}">${nameText}</text>
</svg>`;

  const { data, info } = await sharp(Buffer.from(measureSvg))
    .raw()
    .toBuffer({ resolveWithObject: true });

  let minX = info.width;
  let maxX = -1;
  const alphaOffset = info.channels - 1; // assumes RGBA
  for (let y = 0; y < info.height; y++) {
    const rowStart = y * info.width * info.channels;
    for (let x = 0; x < info.width; x++) {
      const alpha = data[rowStart + x * info.channels + alphaOffset];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
    }
  }
  if (maxX < 0) throw new Error('Measurement found no text pixels');
  return { left: minX, right: maxX, width: maxX - minX + 1 };
}

function centerAccentBar(svg, measuredTextWidth, measuredTextLeft) {
  const rectMatch = svg.match(/<rect\s+[^>]*\bid="accent-bar"[^>]*?\/?>/);
  if (!rectMatch) throw new Error('Source SVG missing <rect id="accent-bar">');
  const original = rectMatch[0];
  const barWidthStr = pullAttr(original, 'width');
  if (!barWidthStr) throw new Error('accent-bar rect is missing width');
  const barWidth = Number(barWidthStr);

  // Text is drawn at local x=0 in the source; the measurement SVG also draws
  // at x=0. So the measured left/right are directly usable as local coords.
  const textCenter = measuredTextLeft + (measuredTextWidth - 1) / 2;
  const barX = Math.round(textCenter - barWidth / 2);

  const attrs = [...original.matchAll(/\b([\w-]+)="([^"]*)"/g)].reduce(
    (acc, m) => {
      acc[m[1]] = m[2];
      return acc;
    },
    {},
  );
  attrs.x = String(barX);
  const rebuilt = `<rect ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`;
  return { svg: svg.replace(original, rebuilt), barX, barWidth };
}

async function main() {
  const svg = await readFile(SRC, 'utf8');
  const fontBufs = await Promise.all(FONTS.map(fetchFont));
  const fontFaceCss = FONTS.map(
    (f, i) =>
      `@font-face{font-family:'Inter';font-style:normal;font-weight:${f.weight};src:url(data:font/woff2;base64,${fontBufs[i].toString('base64')}) format('woff2');}`,
  ).join('');
  const styleBlock = `<defs><style type="text/css"><![CDATA[${fontFaceCss}]]></style></defs>`;

  const extents = await measureNameWidth(svg, fontFaceCss);
  const { svg: svgWithBar, barX, barWidth } = centerAccentBar(
    svg,
    extents.width,
    extents.left,
  );

  const svgWithFonts = svgWithBar.replace(
    /(<svg[^>]*>)/,
    `$1${styleBlock}`,
  );
  const png = await sharp(Buffer.from(svgWithFonts), { density: 144 })
    .resize(1200, 630, { fit: 'fill' })
    .png()
    .toBuffer();
  await writeFile(OUT, png);

  const meta = await sharp(OUT).metadata();
  const sizeKB = (png.length / 1024).toFixed(1);
  console.log(`Measured name: left=${extents.left}, right=${extents.right}, width=${extents.width}px`);
  console.log(`Accent bar: width=${barWidth}, x=${barX} (local, inside translate(110,0) group)`);
  console.log(`Wrote ${OUT}`);
  console.log(`  ${meta.width}×${meta.height}  ${sizeKB} KB`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
