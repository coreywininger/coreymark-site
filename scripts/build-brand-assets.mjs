// Renders the brand images from code so they can be regenerated at any time:
//
//   src/assets/brand/favicon.svg       source key-cap mark (not served)
//   public/favicon-16x16.png, -32x32   linked from <head>
//   public/favicon.ico                 16 + 32 + 48, for clients that ask for /favicon.ico
//   public/apple-touch-icon.png        180, key-cap on Slate
//   public/android-chrome-*.png        192, 512, 512 maskable
//   public/og-default.png              rendered from public/og-image.svg
//   src/assets/og/bg-<pillar>.png      backgrounds for per-post OG cards
//                                      (astro-og-canvas draws title + path on top)
//
// Everything is drawn by headless Chromium (Playwright, already a dev
// dependency), using the Red Hat font files from the site's own build.
//
// Usage: npm run build && node scripts/build-brand-assets.mjs
// Needs Node 22.18+ (imports src/data/topics.ts directly).

import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOPICS } from '../src/data/topics.ts';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PUBLIC = join(ROOT, 'public');
const OG_BG = join(ROOT, 'src', 'assets', 'og');

// Slate palette (src/styles/global.css). OG images and icons are always Slate.
const C = {
  bg: '#101822', surface: '#16212C', surface2: '#121C26', line: '#243243', line2: '#2F3F51',
  text: '#DCE4EB', text2: '#B0BDCA', text3: '#8B9DAE',
  red: '#E38D95', green: '#7FCCA5', yellow: '#DDBC7E', blue: '#8DAEE3', magenta: '#B99DD6', cyan: '#76CCBF',
};

// Red Hat fonts come from the site's own build output (the Astro fonts API
// self-hosts them), embedded as data URIs. No network access is needed.
async function fontCss() {
  let html;
  try {
    html = await readFile(join(ROOT, 'dist', 'index.html'), 'utf8');
  } catch {
    throw new Error('dist/ not found. Run `npm run build` first: the fonts are read from the build output.');
  }
  const wanted = { 'Red Hat Display': '500 800', 'Red Hat Mono': '400 500' };
  let css = '';
  for (const [family, weight] of Object.entries(wanted)) {
    const m = html.match(new RegExp(`@font-face\\{font-family:"${family}-[0-9a-f]+";src:url\\("?(/_astro/fonts/[^")]+\\.woff2)"?\\)`));
    if (!m) throw new Error(`Could not find the ${family} font file in dist/index.html`);
    const data = (await readFile(join(ROOT, 'dist', m[1]))).toString('base64');
    css += `@font-face{font-family:'${family}';font-weight:${weight};font-style:normal;src:url(data:font/woff2;base64,${data}) format('woff2');}`;
  }
  return `<style>${css}</style>`;
}
const FONT_LINK = await fontCss();

/** The `>_` key-cap, drawn as shapes so it never depends on a font. 64-unit box. */
const keycap = (id = 'k') => `
  <defs>
    <linearGradient id="${id}-tile" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${C.surface}"/><stop offset="1" stop-color="${C.surface2}"/>
    </linearGradient>
  </defs>
  <rect x="1.5" y="1.5" width="61" height="61" rx="15" fill="url(#${id}-tile)" stroke="${C.line2}" stroke-width="3"/>
  <polyline points="15,21 28,32 15,43" fill="none" stroke="${C.green}" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
  <line x1="34" y1="45" x2="50" y2="45" stroke="${C.text}" stroke-width="6.5" stroke-linecap="round"/>`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Corey Wininger">${keycap()}
</svg>
`;

/** Key-cap centered on a full-bleed Slate square. `scale` = tile size / canvas. */
const appIconSvg = (scale) => {
  const size = 64 / scale;
  const off = (size - 64) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${C.bg}"/>
  <g transform="translate(${off} ${off})">${keycap()}</g>
</svg>`;
};

/** Shared OG backdrop: Slate, faded 48px grid, two soft glows. */
const backdrop = (glowA, glowB) => `
  <defs>
    <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M48 0H0V48" fill="none" stroke="${C.line}" stroke-width="1"/>
    </pattern>
    <radialGradient id="fade" cx="0.5" cy="0" r="0.95">
      <stop offset="0.25" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="gridmask"><rect width="1200" height="630" fill="url(#fade)"/></mask>
    <radialGradient id="ga" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${glowA}" stop-opacity="0.22"/><stop offset="1" stop-color="${glowA}" stop-opacity="0"/></radialGradient>
    <radialGradient id="gb" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${glowB}" stop-opacity="0.16"/><stop offset="1" stop-color="${glowB}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="${C.bg}"/>
  <rect width="1200" height="630" fill="url(#grid)" mask="url(#gridmask)"/>
  <circle cx="60" cy="-20" r="460" fill="url(#ga)"/>
  <circle cx="1180" cy="170" r="420" fill="url(#gb)"/>`;

/** Brand row: key-cap + name. */
const brandRow = (x, y, size = 72) => `
  <g transform="translate(${x} ${y}) scale(${size / 64})">${keycap('b')}</g>
  <text x="${x + size + 24}" y="${y + size * 0.5}" dominant-baseline="central" font-family="'Red Hat Display', sans-serif" font-weight="700" font-size="${size * 0.52}" letter-spacing="-0.4" fill="${C.text}">Corey Wininger</text>`;

const ogDefaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${backdrop(C.cyan, C.magenta)}
  ${brandRow(88, 80)}
  <g font-family="'Red Hat Display', sans-serif" font-weight="800" font-size="78" letter-spacing="-2.4" fill="${C.text}">
    <text x="88" y="318">I run IT operations.</text>
    <text x="88" y="408">This is where I write</text>
    <text x="88" y="498">down what works.</text>
  </g>
  <text x="88" y="566" font-family="'Red Hat Mono', monospace" font-weight="500" font-size="24" fill="${C.text3}"><tspan fill="${C.green}">$</tspan> coreymark.com</text>
</svg>
`;

/** Per-pillar card background: brand row bottom-left, topic chip bottom-right.
    astro-og-canvas draws the title and `~/writing/<slug>` line from the top
    at build time, so the top two thirds are left clear for them. */
const postBgSvg = (topic) => {
  const color = C[topic.color];
  const chipW = Math.round(topic.label.length * 10.7) + 68;
  const chipX = 1200 - 88 - chipW;
  const rowY = 630 - 80 - 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">${backdrop(color, C.magenta)}
  <rect x="0" y="0" width="10" height="630" fill="${color}"/>
  <line x1="88" y1="${rowY - 36}" x2="1112" y2="${rowY - 36}" stroke="${C.line2}" stroke-width="1.5"/>
  ${brandRow(88, rowY, 60)}
  <g>
    <rect x="${chipX}" y="${rowY + 8}" width="${chipW}" height="44" rx="22" fill="${C.bg}" stroke="${color}" stroke-opacity="0.6" stroke-width="1.5"/>
    <rect x="${chipX + 20}" y="${rowY + 24}" width="12" height="12" rx="3" fill="${color}"/>
    <text x="${chipX + 44}" y="${rowY + 30}" dominant-baseline="central" font-family="'Red Hat Display', sans-serif" font-weight="700" font-size="22" fill="${color}">${topic.label}</text>
  </g>
</svg>`;
};

/** Minimal ICO writer: PNG-compressed entries. */
function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const o = i * 16;
    dir.writeUInt8(size === 256 ? 0 : size, o);
    dir.writeUInt8(size === 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

/** Render an SVG string to a PNG buffer at width x height CSS pixels. */
async function render(svg, width, height, { transparent = false, fonts = false } = {}) {
  await page.setViewportSize({ width, height });
  const sized = svg.replace('<svg ', `<svg style="display:block;width:${width}px;height:${height}px" `);
  await page.setContent(
    `<!doctype html><html><head>${fonts ? FONT_LINK : ''}<style>html,body{margin:0;background:transparent}</style></head><body>${sized}</body></html>`,
    { waitUntil: 'load' },
  );
  if (fonts) {
    const ok = await page.evaluate(async () => {
      await Promise.all([document.fonts.load("800 20px 'Red Hat Display'"), document.fonts.load("500 20px 'Red Hat Mono'")]);
      await document.fonts.ready;
      return document.fonts.check("800 20px 'Red Hat Display'") && document.fonts.check("500 20px 'Red Hat Mono'");
    });
    if (!ok) throw new Error('Red Hat fonts did not load; refusing to render with a fallback font.');
  }
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width, height } });
}

await mkdir(OG_BG, { recursive: true });

// Icons
await mkdir(join(ROOT, 'src', 'assets', 'brand'), { recursive: true });
await writeFile(join(ROOT, 'src', 'assets', 'brand', 'favicon.svg'), faviconSvg);
const fav = {};
for (const size of [16, 32, 48]) fav[size] = await render(faviconSvg, size, size, { transparent: true });
await writeFile(join(PUBLIC, 'favicon-16x16.png'), fav[16]);
await writeFile(join(PUBLIC, 'favicon-32x32.png'), fav[32]);
await writeFile(join(PUBLIC, 'favicon.ico'), ico([16, 32, 48].map((size) => ({ size, png: fav[size] }))));
await writeFile(join(PUBLIC, 'apple-touch-icon.png'), await render(appIconSvg(0.7), 180, 180));
await writeFile(join(PUBLIC, 'android-chrome-192x192.png'), await render(appIconSvg(0.7), 192, 192));
await writeFile(join(PUBLIC, 'android-chrome-512x512.png'), await render(appIconSvg(0.7), 512, 512));
// Maskable: the mark stays inside the 80% safe zone.
await writeFile(join(PUBLIC, 'android-chrome-512x512-maskable.png'), await render(appIconSvg(0.52), 512, 512));

// Default OG image (og-image.svg is the editable source; rewritten here so
// the two never drift).
await writeFile(join(PUBLIC, 'og-image.svg'), ogDefaultSvg);
await writeFile(join(PUBLIC, 'og-default.png'), await render(await readFile(join(PUBLIC, 'og-image.svg'), 'utf8'), 1200, 630, { fonts: true }));

// Per-post card backgrounds, one per blog pillar.
for (const topic of TOPICS.filter((t) => t.id !== 'lab')) {
  await writeFile(join(OG_BG, `bg-${topic.id}.png`), await render(postBgSvg(topic), 1200, 630, { fonts: true }));
}

await browser.close();
console.log('Brand assets written to public/, src/assets/brand/ and src/assets/og/.');
