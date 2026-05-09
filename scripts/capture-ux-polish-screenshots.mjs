import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(
  process.env.HOME,
  'Documents/Claude/Projects/MiniGuru/stratum-it/handoffs/results/2026-05-09-coreymark-lab-ux-polish',
);
mkdirSync(OUT, { recursive: true });

const BASE = 'http://localhost:4321';

const browser = await chromium.launch();

async function captureBusy(page, urlPath, presetText, file) {
  await page.goto(BASE + urlPath, { waitUntil: 'networkidle' });
  // Let initial render finish.
  await page.waitForFunction(() => {
    const b = document.getElementById('parse-btn');
    return b && !b.disabled;
  });
  // Click a preset and capture mid-flight while the wrapper is busy.
  await page.evaluate((preset) => {
    const c = Array.from(
      document.querySelectorAll('#preset-row button'),
    ).find((b) => b.textContent === preset);
    c?.click();
  }, presetText);
  await page.waitForTimeout(20);
  const path = resolve(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log('wrote', path);
}

async function captureFlash(page, urlPath, presetText, file) {
  await page.goto(BASE + urlPath, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => {
    const b = document.getElementById('parse-btn');
    return b && !b.disabled;
  });
  await page.evaluate((preset) => {
    const c = Array.from(
      document.querySelectorAll('#preset-row button'),
    ).find((b) => b.textContent === preset);
    c?.click();
  }, presetText);
  // 60ms in — well within the 140ms flash window
  await page.waitForTimeout(60);
  const path = resolve(OUT, file);
  await page.screenshot({ path, fullPage: false });
  console.log('wrote', path);
}

const desktop = { viewport: { width: 1280, height: 1100 } };

// cron busy + flash, dark
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await captureBusy(page, '/lab/cron/', '0 9 * * 1-5', 'cron-busy-state.png');
  await captureFlash(page, '/lab/cron/', '*/5 * * * *', 'cron-chip-flashed.png');
  await ctx.close();
}

// subnet busy + flash, dark
{
  const ctx = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await captureBusy(page, '/lab/subnet/', '192.168.0.0/16', 'subnet-busy-state.png');
  await captureFlash(page, '/lab/subnet/', '10.0.0.0/8', 'subnet-chip-flashed.png');
  await ctx.close();
}

await browser.close();
console.log('done');
