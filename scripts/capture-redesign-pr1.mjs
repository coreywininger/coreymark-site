// Redesign PR 1 (foundation) review captures + per-theme contrast check.
//
// Usage: with the dev server running on :4321,
//   node scripts/capture-redesign-pr1.mjs <output-dir>
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr1-shots');
const BASE = 'http://localhost:4321';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const FONTS = ['redhat', 'plex', 'geist', 'martian', 'jetbrains'];
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };
const POST = '/blog/claude-plus-github-actions-integration-playbook/';

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open(url, { viewport = D, theme = 'slate', font = 'redhat', reducedMotion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion, deviceScaleFactor: 1 });
  await ctx.addInitScript(([t, f]) => {
    try { localStorage.setItem('theme', t); localStorage.setItem('font', f); } catch {}
  }, [theme, font]);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page };
}
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(OUT, name), ...opts });

// 1. Header + footer on an existing page, all six themes at 1440.
for (const theme of THEMES) {
  const { ctx, page } = await open('/now/', { theme });
  await shot(page, `now-${theme}-1440.png`, { fullPage: true });
  await ctx.close();
}

// 2. Slate at 390: menu closed, menu open, theme panel open.
{
  const { ctx, page } = await open('/now/', { viewport: M });
  await shot(page, 'now-slate-390.png', { fullPage: true });
  await page.locator('[data-mobile-nav] > summary').click();
  await shot(page, 'now-slate-390-menu-open.png');
  await page.locator('[data-mobile-nav] > summary').click();
  await page.locator('[data-theme-button]').click();
  await shot(page, 'now-slate-390-theme-panel.png');
  await ctx.close();
}

// 3. Theme panel open at 1440 (Slate, plus one alternate).
for (const theme of ['slate', 'dracula']) {
  const { ctx, page } = await open('/now/', { theme });
  await page.locator('[data-theme-button]').click();
  await shot(page, `now-${theme}-1440-theme-panel.png`);
  await ctx.close();
}

// 4. Each of the five font sets on one page (a post: headings, body, code).
for (const font of FONTS) {
  const { ctx, page } = await open(POST, { font });
  await shot(page, `post-slate-1440-font-${font}.png`);
  await ctx.close();
}

// 5. Scrolled state: header border/frost, reading progress, back to top.
{
  const { ctx, page } = await open(POST);
  await page.evaluate(() => window.scrollTo(0, 2400));
  await page.waitForTimeout(300);
  await shot(page, 'post-slate-1440-scrolled.png');
  await ctx.close();
}
{
  const { ctx, page } = await open(POST, { viewport: M });
  await page.evaluate(() => window.scrollTo(0, 2400));
  await page.waitForTimeout(300);
  await shot(page, 'post-slate-390-scrolled.png');
  await ctx.close();
}

// 6. Tablet width (768) sanity: collapsed nav.
{
  const { ctx, page } = await open('/now/', { viewport: { width: 768, height: 1024 } });
  await shot(page, 'now-slate-768.png');
  await ctx.close();
}

// 7. Contrast (axe color-contrast) per theme across the existing routes,
//    plus layout facts the handoff asks for.
const ROUTES = ['/', '/blog/', POST, '/lab/', '/lab/subnet/', '/projects/', '/now/', '/about/', '/contact/', '/404'];
const report = { contrast: {}, layout: {} };
for (const theme of THEMES) {
  report.contrast[theme] = {};
  for (const route of ROUTES) {
    const { ctx, page } = await open(route, { theme });
    await page.locator('[data-theme-button]').click(); // include the open panel
    const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    const fails = res.violations.flatMap((v) =>
      v.nodes.map((n) => ({
        target: n.target.join(' '),
        ratio: n.any[0]?.data?.contrastRatio,
        fg: n.any[0]?.data?.fgColor,
        bg: n.any[0]?.data?.bgColor,
        html: n.html.slice(0, 120),
      })),
    );
    const incomplete = res.incomplete.reduce((n, v) => n + v.nodes.length, 0);
    report.contrast[theme][route] = { failures: fails, incomplete };
    await ctx.close();
  }
}
for (const w of [360, 390, 560, 768, 920, 921, 1280, 1920]) {
  const { ctx, page } = await open('/now/', { viewport: { width: w, height: 800 } });
  report.layout[w] = await page.evaluate(() => {
    const h = document.querySelector('[data-site-header]');
    const kids = [...h.querySelectorAll('.brand, .main-nav > *')].filter((e) => e.offsetParent);
    const tops = new Set(kids.map((e) => Math.round(e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)));
    return {
      headerHeight: h.getBoundingClientRect().height,
      oneRow: tops.size === 1,
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      smallTargets: [...h.querySelectorAll('a, button, summary')]
        .filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44)
        .map((e) => `${e.className || e.tagName}:${Math.round(e.getBoundingClientRect().height)}`),
    };
  });
  await ctx.close();
}
await writeFile(path.join(OUT, 'checks.json'), JSON.stringify(report, null, 2));
await browser.close();
console.log('done →', OUT);
