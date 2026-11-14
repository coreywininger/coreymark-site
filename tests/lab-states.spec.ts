import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
// Shared with `npm run audit:lab`, which runs the same states in all six themes.
import { TOOLS, panel, gotoState, findSmallTargets } from '../scripts/lab-states.mjs';

const TOOL_STATES = Object.entries(TOOLS as Record<string, Record<string, unknown>>).map(
  ([slug, states]) => [slug, Object.keys(states)] as const,
);
// Slate (default) plus the two themes where failures have actually occurred.
// The full six-theme matrix lives in `npm run audit:lab`.
const THEMES = ['slate', 'dracula', 'gruvbox'];

test('the state list covers every tool on the Lab index', async ({ page }) => {
  await page.goto('/lab/');
  const slugs = await page
    .locator('[data-lab-list] [data-lab-tool]')
    .evaluateAll((els) => els.map((e) => e.getAttribute('data-lab-tool')!));
  expect([...slugs].sort()).toEqual(TOOL_STATES.map(([slug]) => slug).sort());
});

test.describe('lab: touch targets in every output state', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [slug, states] of TOOL_STATES) {
    test(`${slug}: every control is at least 44 x 44`, async ({ page, baseURL }) => {
      test.setTimeout(90_000);
      const problems: string[] = [];
      for (const state of states) {
        const driveError = await gotoState(page, baseURL, slug, state);
        expect(driveError, `${slug} / ${state} could not be driven`).toBeNull();
        for (const s of await findSmallTargets(page)) {
          problems.push(`${state}: ${s.tag}${s.id ? '#' + s.id : ''}.${s.cls.split(' ')[0]} "${s.text}" ${s.w}x${s.h}`);
        }
      }
      expect([...new Set(problems)]).toEqual([]);
    });
  }

  test('breadcrumb keeps the same visible spacing as with a mouse', async ({ page, browser, baseURL }) => {
    // Gaps between the visible glyphs of each part and separator.
    const gaps = (p: import('@playwright/test').Page) =>
      p.evaluate(() => {
        const nav = document.querySelector('main nav[aria-label="Breadcrumb"]')!;
        const ink = [...nav.children].map((el) => {
          const r = document.createRange();
          r.selectNodeContents(el);
          return r.getBoundingClientRect();
        });
        return ink.slice(1).map((r, i) => Math.round(r.left - ink[i].right));
      });

    await page.goto('/lab/cron/');
    const touchGaps = await gaps(page);

    const mouse = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mousePage = await mouse.newPage();
    await mousePage.goto(`${baseURL}/lab/cron/`);
    const mouseGaps = await gaps(mousePage);
    await mouse.close();

    expect(touchGaps.length).toBeGreaterThan(2);
    expect(touchGaps).toEqual(mouseGaps);
    expect(new Set(touchGaps).size).toBe(1); // evenly spaced
  });
});

test.describe('lab: contrast in every output state', () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  for (const theme of THEMES) {
    for (const [slug, states] of TOOL_STATES) {
      test(`${slug} passes 4.5:1 in ${theme} (${states.length} states)`, async ({ page, baseURL }) => {
        test.setTimeout(90_000);
        await page.addInitScript((t) => {
          try { localStorage.setItem('theme', t); } catch {}
        }, theme);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const problems: string[] = [];
        for (const state of states) {
          const driveError = await gotoState(page, baseURL, slug, state);
          expect(driveError, `${slug} / ${state} could not be driven`).toBeNull();
          await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
          const res = await new AxeBuilder({ page }).withRules(['color-contrast']).include(panel).analyze();
          for (const v of res.violations) {
            for (const n of v.nodes) problems.push(`${state}: ${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`);
          }
        }
        expect(problems).toEqual([]);
      });
    }
  }
});

test.describe('subnet: error state', () => {
  test('an error hides the address-space bar and split table; valid input brings them back', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await page.waitForLoadState('networkidle');
    const sections = page.locator('[data-subnet-result]');
    await expect(sections).toHaveCount(2);
    for (const s of await sections.all()) await expect(s).toBeVisible();

    await page.locator('#cidr-input').fill('10.0.0.0');
    await page.locator('#cidr-input').press('Enter');
    await expect(page.locator('#error-row')).toBeVisible();
    await expect(page.locator('#error-row')).toHaveAttribute('role', 'alert');
    for (const s of await sections.all()) await expect(s).toBeHidden();
    await expect(page.locator('#stats-grid > *')).toHaveCount(0);

    await page.locator('#cidr-input').fill('10.0.0.0/24');
    await page.locator('#cidr-input').press('Enter');
    await expect(page.locator('#error-row')).toBeHidden();
    for (const s of await sections.all()) await expect(s).toBeVisible();
    expect(await page.locator('#stats-grid > *').count()).toBeGreaterThan(3);
  });
});
