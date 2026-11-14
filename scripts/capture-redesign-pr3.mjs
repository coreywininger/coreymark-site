// Redesign PR 3 (post layout + Writing index) review captures + checks.
//
// Usage: with the dev server running on :4321,
//   node scripts/capture-redesign-pr3.mjs <output-dir>
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr3-shots');
const BASE = 'http://localhost:4321';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };
const SHORT = '/blog/it-depends-is-where-it-loses-the-business/';
const CODE = '/blog/claude-plus-github-actions-integration-playbook/';

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open(url, { viewport = D, theme = 'slate', reducedMotion = 'reduce' } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
  return { ctx, page };
}
const shot = (target, name, opts = {}) => target.screenshot({ path: path.join(OUT, name), ...opts });

// 1. Posts: short + code-heavy, Slate 1440 / 390, plus one other theme.
for (const [slug, url] of [['post-short', SHORT], ['post-code', CODE]]) {
  for (const [theme, viewport, w] of [['slate', D, 1440], ['slate', M, 390], ['catppuccin', D, 1440]]) {
    const { ctx, page } = await open(url, { theme, viewport });
    await shot(page, `${slug}-${theme}-${w}.png`, { fullPage: true });
    await ctx.close();
  }
}

// 2. Post details: TOC scroll-spy mid-article, code block close-ups, copied states.
{
  const { ctx, page } = await open(CODE);
  await page.locator('#step-3--github-secrets-and-how-to-set-them-safely, .post-prose h2').nth(3).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 300));
  await page.waitForTimeout(300);
  await shot(page, 'post-code-slate-1440-scrolled-toc.png');
  const pre = page.locator('.post-prose pre').first();
  await pre.scrollIntoViewIfNeeded();
  await shot(pre, 'post-code-slate-1440-codeblock.png');
  await pre.locator('[data-code-copy]').click();
  await shot(pre, 'post-code-slate-1440-codeblock-copied.png');
  await page.locator('[data-share-box]').scrollIntoViewIfNeeded();
  await page.locator('[data-copy-url]').click();
  await page.waitForTimeout(100);
  await shot(page.locator('[data-share-box]'), 'post-slate-1440-share-link-copied.png');
  await shot(page.locator('[data-author-card]'), 'post-slate-1440-author-card.png');
  await ctx.close();
}
{
  const { ctx, page } = await open(CODE, { viewport: M });
  const pre = page.locator('.post-prose pre').first();
  await pre.scrollIntoViewIfNeeded();
  await pre.evaluate((el) => { el.scrollLeft = 120; });
  await shot(pre, 'post-code-slate-390-codeblock-scrolled.png');
  await ctx.close();
}
for (const theme of ['gruvbox', 'dracula']) {
  const { ctx, page } = await open(CODE, { theme });
  const pre = page.locator('.post-prose pre').first();
  await pre.scrollIntoViewIfNeeded();
  await shot(pre, `post-code-${theme}-1440-codeblock.png`);
  await ctx.close();
}

// 3. Writing index: default, one topic filtered, empty state; 390; other theme.
{
  const { ctx, page } = await open('/blog/');
  await shot(page, 'writing-slate-1440.png', { fullPage: true });
  await page.locator('[data-filter="ai"]').click();
  await shot(page, 'writing-slate-1440-topic-ai.png', { fullPage: true });
  await page.locator('#blog-search-input').fill('kubernetes');
  await shot(page, 'writing-slate-1440-empty.png', { fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await open('/blog/?topic=business');
  await shot(page, 'writing-slate-1440-query-topic-business.png');
  await ctx.close();
}
{
  const { ctx, page } = await open('/blog/', { viewport: M });
  await shot(page, 'writing-slate-390.png', { fullPage: true });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(250);
  await shot(page, 'writing-slate-390-sticky-filters.png');
  await page.locator('#blog-search-input').fill('zzz');
  await shot(page, 'writing-slate-390-empty.png');
  await ctx.close();
}
{
  const { ctx, page } = await open('/blog/', { theme: 'catppuccin' });
  await shot(page, 'writing-catppuccin-1440.png', { fullPage: true });
  await ctx.close();
}

// 4. Checks.
const report = { contrast: {}, layout: {} };
const failures = (res) =>
  res.violations.flatMap((v) =>
    v.nodes.map((n) => ({ target: n.target.join(' ').slice(0, 80), ratio: n.any[0]?.data?.contrastRatio, fg: n.any[0]?.data?.fgColor, bg: n.any[0]?.data?.bgColor, html: n.html.slice(0, 100) })),
  );
for (const theme of THEMES) {
  const entry = {};
  for (const [name, url] of [['short', SHORT], ['code', CODE], ['shipping', '/blog/shipping-a-site-with-ai-field-report/'], ['writing', '/blog/']]) {
    const { ctx, page } = await open(url, { theme });
    if (name !== 'writing') {
      await page.evaluate(() => window.scrollTo(0, 1500)); // TOC active state
      await page.waitForTimeout(150);
    }
    const res = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
    entry[name] = { fail: failures(res), incomplete: res.incomplete.reduce((n, v) => n + v.nodes.length, 0) };
    if (name === 'writing') {
      for (const f of ['ops', 'business', 'ai', 'cloud', 'personal']) {
        await page.locator(`[data-filter="${f}"]`).click();
        const r = await new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-filter-bar]').include('[data-post-list]').analyze();
        entry[`writing:${f}`] = { fail: failures(r) };
      }
      await page.locator('#blog-search-input').fill('zzz');
      const r = await new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-post-list]').analyze();
      entry['writing:empty'] = { fail: failures(r) };
    }
    await ctx.close();
  }
  report.contrast[theme] = entry;
}
for (const w of [360, 390, 768, 960, 1024, 1280, 1920]) {
  const row = {};
  for (const [name, url] of [['code', CODE], ['writing', '/blog/']]) {
    const { ctx, page } = await open(url, { viewport: { width: w, height: 900 } });
    row[name] = await page.evaluate(() => {
      const main = document.querySelector('main');
      const small = [...main.querySelectorAll('a, button, input')]
        .filter((e) => e.checkVisibility() && !e.closest('.prose'))
        .map((e) => {
          const r = e.getBoundingClientRect();
          const after = parseFloat(getComputedStyle(e, '::after').height) || 0;
          return { e, h: Math.max(r.height, after) };
        })
        .filter(({ h }) => h < 44)
        .map(({ e, h }) => `${(e.getAttribute('class') || e.tagName).slice(0, 22)}:${Math.round(h)}`);
      const article = document.querySelector('.article');
      const side = document.querySelector('.side');
      const bar = document.querySelector('[data-filter-bar]');
      return {
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
        articleWidth: article ? Math.round(article.getBoundingClientRect().width) : undefined,
        tocVisible: side ? !!side.querySelector('[data-toc]')?.checkVisibility() : undefined,
        preOverflowsArticle: article ? [...article.querySelectorAll('pre')].some((p) => p.getBoundingClientRect().right > article.getBoundingClientRect().right + 1) : undefined,
        filterBarHeight: bar ? Math.round(bar.getBoundingClientRect().height) : undefined,
        smallTargets: [...new Set(small)],
      };
    });
    await ctx.close();
  }
  report.layout[w] = row;
}
await writeFile(path.join(OUT, 'checks.json'), JSON.stringify(report, null, 2));
await browser.close();

for (const [w, v] of Object.entries(report.layout)) console.log(w, JSON.stringify(v));
for (const [t, v] of Object.entries(report.contrast)) {
  const bad = Object.entries(v).filter(([, x]) => x.fail.length).map(([k, x]) => `${k}: ` + [...new Set(x.fail.map((f) => `${f.ratio} ${f.html.slice(0, 70)}`))].slice(0, 6).join(' || '));
  console.log(t, bad.length ? bad : 'OK', 'incomplete', Object.values(v).map((x) => x.incomplete ?? '').join(','));
}
