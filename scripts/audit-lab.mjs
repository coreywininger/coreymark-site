// Lab audit: touch-target sizes and color contrast for every tool in every
// output state, in all six themes.
//
// Usage: npm run build && npm run preview   (in another terminal)
//        npm run audit:lab        (or: node scripts/audit-lab.mjs <output-dir>)
//
// Writes audit.json and prints a summary.
// The IP tool is mocked with a documentation-range address; nothing here
// contacts ip.coreymark.com.

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { THEMES, TOOLS, panel, gotoState, findSmallTargets } from './lab-states.mjs';

const OUT = path.resolve(process.argv[2] ?? 'lab-audit');
const BASE = 'http://localhost:4321';
const browser = await chromium.launch();
await mkdir(OUT, { recursive: true });

async function open(slug, state, { theme = 'slate', touch = false } = {}) {
  const ctx = await browser.newContext({
    viewport: touch ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    reducedMotion: 'reduce', deviceScaleFactor: 1, hasTouch: touch, isMobile: touch,
  });
  await ctx.addInitScript((t) => { try { localStorage.setItem('theme', t); } catch {} }, theme);
  const page = await ctx.newPage();
  const driveError = await gotoState(page, BASE, slug, state);
  return { ctx, page, driveError };
}

const report = { contrast: [], targets: [], driveErrors: [] };

// 1. Contrast: every tool x state x theme, inside the tool panel.
for (const [slug, states] of Object.entries(TOOLS)) {
  for (const state of Object.keys(states)) {
    for (const theme of THEMES) {
      const { ctx, page, driveError } = await open(slug, state, { theme });
      if (driveError && theme === 'slate') report.driveErrors.push({ slug, state, driveError });
      const res = await new AxeBuilder({ page }).withRules(['color-contrast']).include(panel).analyze();
      const fails = res.violations.flatMap((v) => v.nodes.map((n) => ({
        target: n.target.join(' ').slice(0, 90), ratio: n.any[0]?.data?.contrastRatio, fg: n.any[0]?.data?.fgColor, bg: n.any[0]?.data?.bgColor,
        text: n.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50), html: n.html.slice(0, 110),
      })));
      report.contrast.push({ slug, state, theme, fails, incomplete: res.incomplete.reduce((a, v) => a + v.nodes.length, 0) });
      await ctx.close();
    }
  }
}

// 2. Touch targets: every tool x state at 390 on a touch device, whole page.
for (const [slug, states] of Object.entries(TOOLS)) {
  for (const state of Object.keys(states)) {
    const { ctx, page } = await open(slug, state, { touch: true });
    const small = await findSmallTargets(page);
    report.targets.push({ slug, state, small });
    await ctx.close();
  }
}

await writeFile(path.join(OUT, 'audit.json'), JSON.stringify(report, null, 2));
await browser.close();

// Summary
for (const d of report.driveErrors) console.log('DRIVE ERROR', d.slug, d.state, d.driveError);
const cf = {};
for (const c of report.contrast) for (const f of c.fails) {
  const k = `${c.slug} | ${c.state} | ${f.text || f.target} | ${f.html.match(/class="([^"]*)"/)?.[1]?.slice(0, 30) ?? ''}`;
  (cf[k] ??= []).push(`${c.theme}:${f.ratio}`);
}
console.log(`CONTRAST: ${report.contrast.length} checks, ${report.contrast.filter((c) => c.fails.length).length} with failures, ${Object.keys(cf).length} distinct elements`);
for (const [k, v] of Object.entries(cf)) console.log('  ', k, '→', v.join(' '));
const tg = {};
for (const t of report.targets) for (const s of t.small) {
  const k = `${t.slug} | ${s.where} | ${s.tag}${s.id ? '#' + s.id : ''}.${s.cls.split(' ')[0]} | "${s.text}" | ${s.w}x${s.h}`;
  (tg[k] ??= new Set()).add(t.state);
}
console.log(`TARGETS: ${Object.keys(tg).length} distinct controls under 44px`);
for (const [k, v] of Object.entries(tg)) console.log('  ', k, '→', [...v].join(','));
