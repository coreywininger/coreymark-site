// Redesign PR 4 (Lab index + tool pages) review captures + checks.
//
// Usage: with the dev server running on :4321,
//   node scripts/capture-redesign-pr4.mjs <output-dir>
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr4-shots');
const BASE = 'http://localhost:4321';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const TOOLS = ['subnet', 'whatsmyip', 'cron', 'jwt', 'cert-decoder', 'base64', 'regex', 'json-yaml', 'http-status'];
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open(url, { viewport = D, theme = 'slate' } = {}) {
  // Phone-width captures emulate a touch device (pointer: coarse), which is
  // what switches the tools to 44px controls.
  const touch = viewport.width < 600;
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  // Keep the IP tool deterministic and offline: documentation-range address.
  await page.route('https://ip.coreymark.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ ip: '203.0.113.42', ip_decimal: 3405803818, country: 'US', country_name: 'United States', is_eu: false, region: 'Indiana', region_code: 'IN', city: 'Indianapolis', postal: '46204', metro_code: 527, latitude: 39.77, longitude: -86.16, time_zone: 'America/Indiana/Indianapolis', asn: 64496, asn_org: 'Example Net', colo: 'IND', user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0 Safari/537.36' }),
    }),
  );
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  return { ctx, page };
}
const shot = (target, name, opts = {}) => target.screenshot({ path: path.join(OUT, name), ...opts });

// 1. Lab index.
{
  const { ctx, page } = await open('/lab/');
  await shot(page, 'lab-slate-1440.png', { fullPage: true });
  await page.locator('[data-filter="security"]').click();
  await shot(page, 'lab-slate-1440-area-security.png');
  await ctx.close();
}
for (const [theme, viewport, w] of [['slate', M, 390], ['dracula', D, 1440]]) {
  const { ctx, page } = await open('/lab/', { theme, viewport });
  await shot(page, `lab-${theme}-${w}.png`, { fullPage: true });
  await ctx.close();
}

// 2. Every tool page at 1440 Slate.
for (const slug of TOOLS) {
  const { ctx, page } = await open(`/lab/${slug}/`);
  await shot(page, `lab-${slug}-slate-1440.png`, { fullPage: true });
  await ctx.close();
}

// 3. Cron + subnet at 390; cron error; cron in another theme.
for (const slug of ['cron', 'subnet']) {
  const { ctx, page } = await open(`/lab/${slug}/`, { viewport: M });
  await shot(page, `lab-${slug}-slate-390.png`, { fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await open('/lab/cron/');
  await page.locator('#cron-input').fill('0 25 * * 1-5');
  await page.locator('#parse-btn').click();
  await page.waitForTimeout(300);
  await shot(page.locator('[data-tool-panel]'), 'lab-cron-slate-1440-error.png');
  await ctx.close();
}
{
  const { ctx, page } = await open('/lab/cron/', { theme: 'dracula' });
  await shot(page, 'lab-cron-dracula-1440.png', { fullPage: true });
  await ctx.close();
}

// 4. Checks: contrast on all ten pages in six themes; layout at two widths.
const report = { contrast: {}, layout: {} };
for (const theme of THEMES) {
  const entry = {};
  for (const url of ['/lab/', ...TOOLS.map((s) => `/lab/${s}/`)]) {
    const { ctx, page } = await open(url, { theme });
    const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    entry[url] = res.violations.flatMap((v) =>
      v.nodes.map((n) => ({ target: n.target.join(' ').slice(0, 70), ratio: n.any[0]?.data?.contrastRatio, fg: n.any[0]?.data?.fgColor, bg: n.any[0]?.data?.bgColor, html: n.html.slice(0, 90) })),
    );
    await ctx.close();
  }
  report.contrast[theme] = entry;
}
for (const [w, viewport] of [[390, M], [1440, D]]) {
  const row = {};
  for (const url of ['/lab/', ...TOOLS.map((s) => `/lab/${s}/`)]) {
    const { ctx, page } = await open(url, { viewport });
    row[url] = await page.evaluate(() => {
      const main = document.querySelector('main');
      const panel = document.querySelector('[data-tool-panel]');
      const els = [...main.querySelectorAll('a, button, input, select, textarea, summary')].filter((e) => e.checkVisibility());
      const small = (list) => list.filter((e) => {
        const r = e.getBoundingClientRect();
        const after = parseFloat(getComputedStyle(e, '::after').height) || 0;
        return Math.max(r.height, after) < 44 && !e.closest('.prose');
      });
      return {
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
        smallOutsidePanel: small(els.filter((e) => !panel || !panel.contains(e))).map((e) => (e.getAttribute('class') || e.tagName).slice(0, 20)),
        smallInsidePanel: panel ? small(els.filter((e) => panel.contains(e))).length : 0,
        controlsInsidePanel: panel ? els.filter((e) => panel.contains(e)).length : 0,
      };
    });
    await ctx.close();
  }
  report.layout[w] = row;
}
await writeFile(path.join(OUT, 'checks.json'), JSON.stringify(report, null, 2));
await browser.close();

for (const [w, v] of Object.entries(report.layout)) for (const [u, f] of Object.entries(v)) console.log(w, u, JSON.stringify(f));
for (const [t, v] of Object.entries(report.contrast)) {
  for (const [u, f] of Object.entries(v)) if (f.length) console.log(t, u, f.length, [...new Set(f.map((x) => `${x.ratio} ${x.fg}/${x.bg} ${x.html.slice(0, 60)}`))].slice(0, 5).join(' || '));
}
console.log('contrast total', Object.values(report.contrast).flatMap((v) => Object.values(v)).reduce((n, f) => n + f.length, 0));
