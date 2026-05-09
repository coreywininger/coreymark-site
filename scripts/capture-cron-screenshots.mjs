import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(
  process.env.HOME,
  'Documents/Claude/Projects/MiniGuru/stratum-it/handoffs/results/2026-05-09-coreymark-lab-cron',
);
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4321';

async function snap(page, url, file, opts = {}) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(opts.wait ?? 300);
  if (opts.do) await opts.do(page);
  const path = resolve(OUT, file);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log('wrote', path);
}

const desktop = { viewport: { width: 1280, height: 1100 } };
const mobile = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 };

const browser = await chromium.launch();

// /lab/ index — both disciplines now visible (light)
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await snap(page, '/lab/', 'lab-index-2-disciplines.png', { fullPage: true });
  await ctx.close();
}

// cron-default light
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await snap(page, '/lab/cron/', 'cron-default.png', { fullPage: true });
  await ctx.close();
}

// cron-default dark
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/cron/', 'cron-default-dark.png', { fullPage: true });
  await ctx.close();
}

// translate panel expanded
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/cron/', 'cron-translate-expanded.png', {
    fullPage: true,
    do: async (p) => { await p.locator('#translate-details summary').click(); await p.waitForTimeout(150); },
  });
  await ctx.close();
}

// warnings — day 31 in February
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/cron/?expr=0+0+31+2+*', 'cron-warnings.png', { fullPage: true });
  await ctx.close();
}

// UTC mode
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/cron/', 'cron-utc-mode.png', {
    fullPage: true,
    do: async (p) => { await p.locator('#tz-utc-btn').click(); await p.waitForTimeout(200); },
  });
  await ctx.close();
}

// mobile
{
  const ctx = await browser.newContext({ ...mobile, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/cron/', 'cron-mobile.png', { fullPage: true });
  await ctx.close();
}

await browser.close();
console.log('all screenshots written to', OUT);
