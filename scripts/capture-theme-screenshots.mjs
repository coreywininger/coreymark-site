// One-off helper: drive a headless browser through every primary surface
// in both themes and dump PNGs to .github/pr-screenshots/.
//
// Usage: with the dev server running on :4321,
//   node scripts/capture-theme-screenshots.mjs
//
// Not part of the test suite. Safe to delete after the PR lands.

import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve(
  '.github/pr-screenshots/2026-04-25-theme-toggle',
);
const BASE = 'http://localhost:4321';

const DESKTOP = { width: 1280, height: 800 };
const MOBILE = { width: 393, height: 852 };

// (label, path, viewport, special)
const SURFACES = [
  ['home',          '/',                                          DESKTOP, null],
  ['blog-index',    '/blog',                                      DESKTOP, null],
  ['blog-post',     '/blog/shipping-a-site-with-ai-field-report', DESKTOP, null],
  ['projects',      '/projects',                                  DESKTOP, null],
  ['project-page',  '/projects/dailybriefing/',                   DESKTOP, null],
  ['about',         '/about',                                     DESKTOP, null],
  ['now',           '/now',                                       DESKTOP, null],
  ['contact',       '/contact',                                   DESKTOP, null],
  ['404',           '/this-path-does-not-exist',                  DESKTOP, null],
  ['mobile-drawer', '/',                                          MOBILE,  'open-drawer'],
];

async function captureAll() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();

  for (const theme of ['dark', 'light']) {
    for (const [label, urlPath, viewport, special] of SURFACES) {
      const ctx = await browser.newContext({
        viewport,
        colorScheme: theme,
      });
      // Seed localStorage for the chosen theme so the FOUC script picks it up
      // synchronously — emulating a returning visitor with an explicit choice.
      // For first-visit behavior the dev server's prefers-color-scheme
      // emulation alone would also suffice.
      await ctx.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);

      const page = await ctx.newPage();

      // Hide Astro's dev toolbar (the floating bar Astro injects in dev mode)
      // before any paint, so it never appears in the captured PNG.
      await page.addStyleTag({
        content: 'astro-dev-toolbar, astro-dev-overlay { display: none !important; }',
      });

      const fullUrl = BASE + urlPath;
      const resp = await page.goto(fullUrl, { waitUntil: 'networkidle' });

      // The toolbar is a Web Component injected post-load. addStyleTag's CSS
      // applies to the previously-empty document; re-inject after navigation
      // to make sure it survives.
      await page.addStyleTag({
        content: 'astro-dev-toolbar, astro-dev-overlay { display: none !important; }',
      });

      // For 404, Astro serves the 404 page with a 404 status — that's expected.
      if (label !== '404' && resp && !resp.ok()) {
        console.warn(`[${label}/${theme}] non-OK status: ${resp.status()}`);
      }

      if (special === 'open-drawer') {
        await page.locator('[data-menu-toggle]').click();
        await page.locator('#mobile-menu').waitFor({ state: 'visible' });
      }

      const file = path.join(OUT_DIR, `${label}-${theme}.png`);
      await page.screenshot({
        path: file,
        fullPage: special !== 'open-drawer', // drawer covers viewport; full-page would just be drawer height
      });
      console.log(`✓ ${file}`);

      await ctx.close();
    }
  }

  await browser.close();
}

captureAll().catch((e) => {
  console.error(e);
  process.exit(1);
});
