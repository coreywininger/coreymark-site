import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(
  process.env.HOME,
  'Documents/Claude/Projects/MiniGuru/stratum-it/handoffs/results/2026-05-10-coreymark-lab-jwt',
);
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4321';

const browser = await chromium.launch();

async function newPage(theme = 'dark', vw = 1280, vh = 1400) {
  const ctx = await browser.newContext({
    viewport: { width: vw, height: vh },
    colorScheme: theme,
  });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  return { ctx, page };
}

async function clickSample(page, sample) {
  await page.locator(`[data-sample="${sample}"]`).click();
  await page.locator('#panes').waitFor({ state: 'visible' });
  // give the chip flash a moment to fade so it doesn't draw attention in the screenshot
  await page.waitForTimeout(220);
}

async function shot(page, file, fullPage = true) {
  const path = resolve(OUT, file);
  await page.screenshot({ path, fullPage });
  console.log('wrote', path);
}

// /lab/ index — three disciplines, light mode
{
  const { ctx, page } = await newPage('light', 1280, 1400);
  await page.goto(BASE + '/lab/', { waitUntil: 'networkidle' });
  await shot(page, 'lab-index-3-disciplines.png');
  await ctx.close();
}

// /lab/jwt/ empty default, light mode
{
  const { ctx, page } = await newPage('light', 1280, 1100);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await shot(page, 'jwt-default.png');
  await ctx.close();
}

// HS256 decoded, light + dark
for (const theme of ['light', 'dark']) {
  const { ctx, page } = await newPage(theme, 1280, 1800);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'hs256');
  await shot(page, `jwt-decoded-hs256-${theme}.png`);
  await ctx.close();
}

// Entra ID — asymmetric explainer
{
  const { ctx, page } = await newPage('dark', 1280, 2400);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'entra');
  await shot(page, 'jwt-decoded-entra.png');
  await ctx.close();
}

// Expired token — red banner + red exp row
{
  const { ctx, page } = await newPage('dark', 1280, 1600);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'expired');
  await shot(page, 'jwt-expired.png');
  await ctx.close();
}

// alg:none — danger badge + warn banner
{
  const { ctx, page } = await newPage('dark', 1280, 1600);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'alg-none');
  await shot(page, 'jwt-alg-none.png');
  await ctx.close();
}

// HS256 + valid secret → success
{
  const { ctx, page } = await newPage('dark', 1280, 1900);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'hs256');
  await page.locator('#secret-input').fill('your-256-bit-secret');
  await page.locator('#verify-btn').click();
  await page.waitForFunction(() => {
    const r = document.getElementById('verify-result');
    return r && /Signature valid/.test(r.textContent || '');
  });
  await shot(page, 'jwt-verify-success.png');
  await ctx.close();
}

// Mobile — HS256 decoded, panes stack
{
  const { ctx, page } = await newPage('dark', 375, 2400);
  await page.goto(BASE + '/lab/jwt/', { waitUntil: 'networkidle' });
  await clickSample(page, 'hs256');
  await shot(page, 'jwt-mobile.png');
  await ctx.close();
}

await browser.close();
console.log('done');
