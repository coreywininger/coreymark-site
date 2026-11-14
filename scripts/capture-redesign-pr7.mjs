// Redesign PR 7 (brand assets) review images.
//
// Usage: npm run build && node scripts/capture-redesign-pr7.mjs <output-dir>
// Copies the generated icons and OG images out of public/ and dist/, and
// makes one enlarged favicon sheet (16px icons are hard to judge at 1x).
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr7-shots');
await mkdir(OUT, { recursive: true });

const copies = [
  ['public/favicon-16x16.png', 'favicon-16.png'],
  ['public/favicon-32x32.png', 'favicon-32.png'],
  ['public/apple-touch-icon.png', 'favicon-180-apple-touch.png'],
  ['public/android-chrome-512x512.png', 'icon-512.png'],
  ['public/android-chrome-512x512-maskable.png', 'icon-512-maskable.png'],
  ['public/og-default.png', 'og-default.png'],
  // short title · long title · three different pillars
  ['dist/og/welcome.png', 'og-post-short-personal.png'],
  ['dist/og/making-personal-repo-public-security-review.png', 'og-post-long-ai.png'],
  ['dist/og/it-depends-is-where-it-loses-the-business.png', 'og-post-business.png'],
  ['dist/og/reading-a-cloud-bill-like-an-it-leader.png', 'og-post-cloud.png'],
  ['dist/og/vendor-management-skill-not-inbox.png', 'og-post-ops.png'],
];
for (const [from, to] of copies) await copyFile(from, path.join(OUT, to));

const uri = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
const f16 = await uri('public/favicon-16x16.png');
const f32 = await uri('public/favicon-32x32.png');
const f180 = await uri('public/apple-touch-icon.png');
const mask = await uri('public/android-chrome-512x512-maskable.png');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 620 }, deviceScaleFactor: 1 });
await page.setContent(`<style>
  body{margin:0;padding:28px;font:13px ui-monospace,monospace;color:#444;background:#fff}
  .row{display:flex;gap:28px;align-items:flex-end;margin-bottom:26px}
  figure{margin:0} figcaption{margin-top:8px}
  .tab{display:flex;align-items:center;gap:8px;padding:8px 14px;border-radius:8px 8px 0 0;font:13px system-ui;width:210px}
  .light{background:#f1f3f4;color:#222} .dark{background:#202124;color:#e8eaed}
  .px{image-rendering:pixelated}
  .chk{background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0 0/16px 16px}
  .circle{border-radius:50%}
</style>
<div class="row">
  <figure><div class="tab light"><img src="${f16}" width="16" height="16">Corey Wininger</div><figcaption>16px, light tab</figcaption></figure>
  <figure><div class="tab dark"><img src="${f16}" width="16" height="16">Corey Wininger</div><figcaption>16px, dark tab</figcaption></figure>
  <figure><div class="tab light"><img src="${f32}" width="32" height="32">32px</div><figcaption>32px, light</figcaption></figure>
  <figure><div class="tab dark"><img src="${f32}" width="32" height="32">32px</div><figcaption>32px, dark</figcaption></figure>
</div>
<div class="row">
  <figure><img class="px chk" src="${f16}" width="160" height="160"><figcaption>16px at 10x</figcaption></figure>
  <figure><img class="px chk" src="${f32}" width="160" height="160"><figcaption>32px at 5x</figcaption></figure>
  <figure><img src="${f180}" width="180" height="180" style="border-radius:40px"><figcaption>180px apple-touch (iOS corner mask)</figcaption></figure>
  <figure><img class="circle" src="${mask}" width="180" height="180"><figcaption>512 maskable, circle mask</figcaption></figure>
</div>`);
await page.screenshot({ path: path.join(OUT, 'favicon-sheet.png'), fullPage: true });
await browser.close();
console.log('done →', OUT);
