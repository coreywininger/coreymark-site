// Redesign PR 2 (homepage) review captures + checks.
//
// Usage: with the dev server running on :4321,
//   node scripts/capture-redesign-pr2.mjs <output-dir>
//
// Not part of the test suite. Safe to delete after the redesign lands.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';

const OUT = path.resolve(process.argv[2] ?? 'redesign-pr2-shots');
const BASE = 'http://localhost:4321';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const TOPICS = ['ops', 'business', 'ai', 'cloud', 'personal', 'lab'];
const D = { width: 1440, height: 900 };
const M = { width: 390, height: 844 };

const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open({ viewport = D, theme = 'slate', reducedMotion = 'no-preference', js = true, settle = 3600 } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion, javaScriptEnabled: js, deviceScaleFactor: 1 });
  if (js) await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (js) {
    await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });
    await page.evaluate(() => document.fonts.ready);
  }
  await page.waitForTimeout(settle); // let the load sequence finish
  return { ctx, page };
}
const shot = (target, name, opts = {}) => target.screenshot({ path: path.join(OUT, name), ...opts });

// 1. Full page: Slate 1440 + 390, two other themes at 1440.
for (const [theme, viewport, w] of [['slate', D, 1440], ['slate', M, 390], ['tokyo', D, 1440], ['gruvbox', D, 1440]]) {
  const { ctx, page } = await open({ theme, viewport });
  await shot(page, `home-${theme}-${w}.png`, { fullPage: true });
  await ctx.close();
}

// 2. Topic map with each topic selected, one contact sheet per width.
for (const [viewport, w] of [[D, 1440], [M, 390]]) {
  const { ctx, page } = await open({ viewport, reducedMotion: 'reduce', settle: 300 });
  await page.addStyleTag({ content: '[data-back-to-top]{display:none!important}' });
  const cells = [];
  for (const id of TOPICS) {
    await page.locator(`[data-topic="${id}"]`).click();
    await page.waitForTimeout(150);
    const buf = await page.locator('[data-topic-map]').screenshot();
    cells.push(`<figure><img src="data:image/png;base64,${buf.toString('base64')}"><figcaption>${id}</figcaption></figure>`);
  }
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: w === 1440 ? 2400 : 1260, height: 800 });
  await sheet.setContent(`<style>body{margin:0;padding:24px;background:#0b1118;display:grid;grid-template-columns:repeat(${w === 1440 ? 2 : 3},max-content);gap:24px;font:14px ui-monospace,monospace;color:#b0bdca}figure{margin:0}img{display:block;border:1px solid #243243}figcaption{padding:8px 0}</style>${cells.join('')}`);
  await shot(sheet, `home-slate-${w}-map-topics.png`, { fullPage: true });
  await ctx.close();
}

// 3. Reduced motion on, captured immediately after load (nothing mid-animation).
{
  const { ctx, page } = await open({ reducedMotion: 'reduce', settle: 0 });
  await shot(page, 'home-slate-1440-reduced-motion.png');
  await ctx.close();
}

// 4. Extras: no-JS fallback, subnet error + IPv6, hero at 768.
{
  const { ctx, page } = await open({ js: false, settle: 300 });
  await shot(page.locator('#writing'), 'home-slate-1440-no-js-writing.png');
  await ctx.close();
}
{
  const { ctx, page } = await open({ reducedMotion: 'reduce', settle: 300 });
  await page.locator('[data-cidr-input]').fill('10.0.0.0/40');
  await shot(page.locator('[data-home-subnet]'), 'home-slate-1440-subnet-error.png');
  await page.locator('[data-cidr-input]').fill('2001:db8::/48');
  await shot(page.locator('[data-home-subnet]'), 'home-slate-1440-subnet-ipv6.png');
  await ctx.close();
}
{
  const { ctx, page } = await open({ viewport: M, reducedMotion: 'reduce', settle: 300 });
  await page.addStyleTag({ content: '[data-back-to-top]{display:none!important}' });
  await shot(page.locator('[data-things-i-run]'), 'home-slate-390-things-i-run-cards.png');
  await ctx.close();
}
{
  const { ctx, page } = await open({ viewport: { width: 768, height: 1024 } });
  await shot(page, 'home-slate-768.png', { fullPage: true });
  await ctx.close();
}

// 5. Checks: contrast per theme (whole page, then the map with each topic
//    selected), plus layout facts.
const report = { contrast: {}, layout: {} };
const failures = (res) =>
  res.violations.flatMap((v) =>
    v.nodes.map((n) => ({
      target: n.target.join(' '),
      ratio: n.any[0]?.data?.contrastRatio,
      fg: n.any[0]?.data?.fgColor,
      bg: n.any[0]?.data?.bgColor,
      html: n.html.slice(0, 110),
    })),
  );
for (const theme of THEMES) {
  const { ctx, page } = await open({ theme, reducedMotion: 'reduce', settle: 300 });
  const whole = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
  const entry = { page: failures(whole), incomplete: whole.incomplete.reduce((n, v) => n + v.nodes.length, 0), topics: {} };
  for (const id of TOPICS) {
    await page.locator(`[data-topic="${id}"]`).click();
    const res = await new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-topic-map]').analyze();
    entry.topics[id] = failures(res);
  }
  await page.locator('[data-cidr-input]').fill('nope');
  const err = await new AxeBuilder({ page }).withRules(['color-contrast']).include('[data-home-subnet]').analyze();
  entry.subnetError = failures(err);
  report.contrast[theme] = entry;
  await ctx.close();
}
for (const w of [360, 390, 560, 768, 1024, 1280, 1920]) {
  const { ctx, page } = await open({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', settle: 300 });
  report.layout[w] = await page.evaluate(() => {
    const map = document.querySelector('.map').getBoundingClientRect();
    const rack = document.querySelector('.rack').getBoundingClientRect();
    const nodes = [...document.querySelectorAll('[data-topic]')].map((n) => ({ id: n.dataset.topic, r: n.getBoundingClientRect() }));
    const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const clashes = [];
    nodes.forEach((a, i) => {
      if (overlap(a.r, rack)) clashes.push(`${a.id}×rack`);
      nodes.slice(i + 1).forEach((b) => { if (overlap(a.r, b.r)) clashes.push(`${a.id}×${b.id}`); });
    });
    const main = document.querySelector('main');
    const small = [...main.querySelectorAll('a, button, input, [tabindex]')]
      .filter((e) => e.checkVisibility())
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44)
      .map(({ e, r }) => `${(e.className || e.tagName).toString().slice(0, 24)}:${Math.round(r.height)}`);
    return {
      hScroll: document.documentElement.scrollWidth > window.innerWidth,
      nodesOutsideMap: nodes.filter((n) => n.r.left < map.left || n.r.right > map.right || n.r.top < map.top || n.r.bottom > map.bottom).map((n) => n.id),
      clashes,
      listBesideMap: document.querySelector('[data-topic-list]').getBoundingClientRect().top < map.bottom,
      hubCentered: Math.abs((rack.left + rack.width / 2) - (map.left + map.width / 2)) < 1 && Math.abs((rack.top + rack.height / 2) - (map.top + map.height / 2)) < 1,
      smallTargets: [...new Set(small)],
    };
  });
  await ctx.close();
}
await writeFile(path.join(OUT, 'checks.json'), JSON.stringify(report, null, 2));
await browser.close();

for (const [w, v] of Object.entries(report.layout)) console.log(w, JSON.stringify(v));
for (const [t, v] of Object.entries(report.contrast)) {
  const topicFails = Object.entries(v.topics).filter(([, f]) => f.length).map(([id, f]) => `${id}:${f.map((x) => x.ratio).join('/')}`);
  console.log(t, 'page', v.page.map((f) => `${f.ratio} ${f.html.slice(0, 60)}`), 'incomplete', v.incomplete, 'topics', topicFails, 'err', v.subnetError.map((f) => f.ratio));
}
