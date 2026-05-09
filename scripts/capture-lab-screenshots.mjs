import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(
  process.env.HOME,
  'Documents/Claude/Projects/MiniGuru/stratum-it/handoffs/results/2026-05-09-coreymark-lab-subnet',
);
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4321';

async function snap(page, url, file, opts = {}) {
  await page.goto(BASE + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const path = resolve(OUT, file);
  await page.screenshot({ path, fullPage: opts.fullPage ?? false });
  console.log('wrote', path);
}

const desktop = { viewport: { width: 1280, height: 900 } };
const mobile = { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 };

const browser = await chromium.launch();

// dark, desktop
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/', 'lab-index-desktop.png', { fullPage: true });
  await snap(page, '/lab/subnet/', 'subnet-default.png', { fullPage: true });
  await snap(page, '/lab/subnet/?cidr=2001%3Adb8%3A%3A%2F32', 'subnet-ipv6.png', { fullPage: true });
  await ctx.close();
}

// light, desktop
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await snap(page, '/lab/', 'lab-index-light.png', { fullPage: true });
  await snap(page, '/lab/subnet/', 'subnet-default-light.png', { fullPage: true });
  await ctx.close();
}

// mobile
{
  const ctx = await browser.newContext({ ...mobile, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await snap(page, '/lab/', 'lab-index-mobile.png', { fullPage: true });
  await snap(page, '/lab/subnet/', 'subnet-mobile.png', { fullPage: true });
  await ctx.close();
}

// nav-after, desktop, dark — crop to header only via viewport-only screenshot
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 120 },
    colorScheme: 'dark',
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  await page.screenshot({ path: resolve(OUT, 'nav-fix-after.png') });
  console.log('wrote nav-fix-after.png');
  await ctx.close();
}

await browser.close();
console.log('all screenshots written to', OUT);
