// Redesign PR 5 (About, Now, Projects, Contact, 404, Search) captures + checks.
//
// Usage: build first, then serve the build (search needs the Pagefind index):
//   npm run build && npm run preview
//   node scripts/capture-redesign-pr5.mjs <output-dir>
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr5-shots');
const BASE = 'http://localhost:4321';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };
const ROUTES = [
  ['about', '/about/'],
  ['now', '/now/'],
  ['projects', '/projects/'],
  ['project-dailybriefing', '/projects/dailybriefing/'],
  ['contact', '/contact/'],
  ['404', '/this-page-does-not-exist/'],
];

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open(url, { viewport = D, theme = 'slate' } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  return { ctx, page };
}
const shot = (target, name, opts = {}) => target.screenshot({ path: path.join(OUT, name), ...opts });
const search = async (page, q) => {
  await page.keyboard.press('Control+k');
  await page.locator('[data-search-input]').fill(q);
  if (q) await page.locator('[data-search-results] [data-search-item][data-kind]').first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
};

// 1. Each route: Slate 1440 + 390.
for (const [slug, url] of ROUTES) {
  for (const [viewport, w] of [[D, 1440], [M, 390]]) {
    const { ctx, page } = await open(url, { viewport });
    await shot(page, `${slug}-slate-${w}.png`, { fullPage: true });
    await ctx.close();
  }
}
// 2. About and Now in one other theme; the other project pages.
for (const [slug, url] of [['about', '/about/'], ['now', '/now/']]) {
  const { ctx, page } = await open(url, { theme: 'tokyo' });
  await shot(page, `${slug}-tokyo-1440.png`, { fullPage: true });
  await ctx.close();
}
for (const id of ['coreymark-site', 'ip-worker']) {
  const { ctx, page } = await open(`/projects/${id}/`);
  await shot(page, `project-${id}-slate-1440.png`, { fullPage: true });
  await ctx.close();
}
// 3. Search: quick links, results, arrow-key selection, no matches; 390; other theme.
{
  const { ctx, page } = await open('/');
  await search(page, '');
  await shot(page, 'search-slate-1440-open.png');
  await page.locator('[data-search-input]').fill('cron');
  await page.locator('[data-search-results] [data-search-item][data-kind]').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
  await shot(page, 'search-slate-1440-results.png');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await shot(page, 'search-slate-1440-results-arrow-down.png');
  await page.locator('[data-search-input]').fill('zzzqqq');
  await page.waitForTimeout(700);
  await shot(page, 'search-slate-1440-no-matches.png');
  await ctx.close();
}
{
  const { ctx, page } = await open('/', { viewport: M });
  await page.locator('#search-trigger').click();
  await page.locator('[data-search-input]').fill('vendor');
  await page.locator('[data-search-results] [data-search-item][data-kind]').first().waitFor({ timeout: 8000 });
  await page.waitForTimeout(300);
  await shot(page, 'search-slate-390-results.png');
  await ctx.close();
}
{
  const { ctx, page } = await open('/', { theme: 'gruvbox' });
  await search(page, 'security');
  await shot(page, 'search-gruvbox-1440-results.png');
  await ctx.close();
}

// 4. Checks.
const report = { contrast: {}, layout: {}, search: {} };
const fails = async (builder) =>
  (await builder.analyze()).violations.flatMap((v) =>
    v.nodes.map((n) => ({ target: n.target.join(' ').slice(0, 70), ratio: n.any[0]?.data?.contrastRatio, fg: n.any[0]?.data?.fgColor, bg: n.any[0]?.data?.bgColor, html: n.html.slice(0, 90) })),
  );
const ALL = [...ROUTES, ['project-coreymark-site', '/projects/coreymark-site/'], ['project-ip-worker', '/projects/ip-worker/']];
for (const theme of THEMES) {
  const entry = {};
  for (const [slug, url] of ALL) {
    const { ctx, page } = await open(url, { theme });
    entry[slug] = await fails(new AxeBuilder({ page }).withRules(['color-contrast']));
    await ctx.close();
  }
  const { ctx, page } = await open('/now/', { theme });
  await search(page, '');
  entry['search:quick'] = await fails(new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-search-overlay]'));
  await page.locator('[data-search-input]').fill('cron');
  await page.locator('[data-search-results] [data-search-item][data-kind]').first().waitFor({ timeout: 8000 });
  await page.keyboard.press('ArrowDown');
  entry['search:results'] = await fails(new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-search-overlay]'));
  await page.locator('[data-search-input]').fill('zzzqqq');
  await page.waitForTimeout(700);
  entry['search:none'] = await fails(new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-search-overlay]'));
  await ctx.close();
  report.contrast[theme] = entry;
}
for (const [w, viewport] of [[360, { width: 360, height: 800 }], [390, M], [768, { width: 768, height: 1024 }], [1440, D]]) {
  const row = {};
  for (const [slug, url] of ALL) {
    const { ctx, page } = await open(url, { viewport });
    row[slug] = await page.evaluate(() => {
      const main = document.querySelector('main');
      const small = [...main.querySelectorAll('a, button, input, select')]
        .filter((e) => e.checkVisibility() && !e.closest('.prose'))
        .filter((e) => Math.max(e.getBoundingClientRect().height, parseFloat(getComputedStyle(e, '::after').height) || 0) < 44)
        .map((e) => (e.getAttribute('class') || e.tagName).slice(0, 22));
      return { hScroll: document.documentElement.scrollWidth > window.innerWidth, h1: main.querySelectorAll('h1').length, small: [...new Set(small)] };
    });
    await ctx.close();
  }
  report.layout[w] = row;
}
{
  const { ctx, page } = await open('/');
  for (const q of ['cron', 'vendor', 'dailybriefing', 'subnet', 'contact']) {
    await page.keyboard.press('Control+k');
    await page.locator('[data-search-input]').fill(q);
    await page.locator('[data-search-results] [data-search-item][data-kind]').first().waitFor({ timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(400);
    report.search[q] = await page.locator('[data-search-results] [data-search-item]').evaluateAll((els) =>
      els.map((e) => `${e.dataset.kind}|${e.querySelector('.t').textContent}|${e.querySelector('.d').textContent.slice(0, 50)}|${e.style.getPropertyValue('--c')}`),
    );
    await page.keyboard.press('Escape');
  }
  await ctx.close();
}
await writeFile(path.join(OUT, 'checks.json'), JSON.stringify(report, null, 2));
await browser.close();

for (const [w, v] of Object.entries(report.layout)) for (const [u, f] of Object.entries(v)) if (f.hScroll || f.h1 !== 1 || f.small.length) console.log('LAYOUT', w, u, JSON.stringify(f));
for (const [t, v] of Object.entries(report.contrast)) for (const [u, f] of Object.entries(v)) if (f.length) console.log('CONTRAST', t, u, f.length, [...new Set(f.map((x) => `${x.ratio} ${x.fg}/${x.bg} ${x.html.slice(0, 60)}`))].slice(0, 4).join(' || '));
console.log('contrast total', Object.values(report.contrast).flatMap((v) => Object.values(v)).reduce((n, f) => n + f.length, 0));
for (const [q, r] of Object.entries(report.search)) console.log('SEARCH', q, r.slice(0, 4));
