import { expect, test } from '@playwright/test';

const HREFS = ['/blog/', '/lab/', '/projects/', '/now/', '/about/', '/contact/'];

test.describe('mobile nav menu', () => {
  test('opens a sheet that fits the viewport with all six links', async ({ page }) => {
    await page.goto('/');

    const sheet = page.locator('#mobile-menu');
    const summary = page.locator('[data-mobile-nav] > summary');
    await expect(sheet).toBeHidden();

    await summary.click();
    await expect(sheet).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport size unavailable');
    const box = await sheet.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);

    await expect(sheet.locator('a')).toHaveCount(HREFS.length);
    for (const href of HREFS) {
      const link = sheet.locator(`a[href="${href}"]`);
      await expect(link).toBeVisible();
      const linkBox = await link.boundingBox();
      expect(linkBox!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('header stays on one row with 44px controls', async ({ page }) => {
    await page.goto('/');
    const facts = await page.evaluate(() => {
      const header = document.querySelector('[data-site-header]')!;
      const controls = [...header.querySelectorAll<HTMLElement>('a, button, summary')].filter(
        (e) => e.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }),
      );
      const mids = controls.map((e) => {
        const r = e.getBoundingClientRect();
        return Math.round(r.top + r.height / 2);
      });
      return {
        rows: new Set(mids).size,
        minHeight: Math.min(...controls.map((e) => e.getBoundingClientRect().height)),
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(facts.rows).toBe(1);
    expect(facts.minHeight).toBeGreaterThanOrEqual(44);
    expect(facts.hScroll).toBe(false);
  });

  test('marks the current page with aria-current', async ({ page }) => {
    await page.goto('/now/');
    await page.locator('[data-mobile-nav] > summary').click();
    const sheet = page.locator('#mobile-menu');
    await expect(sheet.locator('a[aria-current="page"]')).toHaveCount(1);
    await expect(sheet.locator('a[aria-current="page"]')).toHaveAttribute('href', '/now/');
  });

  test('Escape and click-away close the menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('[data-mobile-nav]');
    const summary = nav.locator('> summary');
    const sheet = page.locator('#mobile-menu');

    await summary.click();
    await expect(sheet).toBeVisible();
    await expect(summary).toHaveAttribute('aria-label', 'Close menu');
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(summary).toHaveAttribute('aria-label', 'Open menu');
    await expect(summary).toBeFocused();

    await summary.click();
    await expect(sheet).toBeVisible();
    await page.locator('main').click({ position: { x: 10, y: 400 } });
    await expect(sheet).toBeHidden();
  });

  test('keyboard: Enter on the menu button opens it', async ({ page }) => {
    await page.goto('/');
    const summary = page.locator('[data-mobile-nav] > summary');
    await summary.focus();
    await summary.press('Enter');
    await expect(page.locator('#mobile-menu')).toBeVisible();
  });
});

test.describe('desktop nav', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('shows six inline links, no menu button, aria-current on the active page', async ({ page }) => {
    await page.goto('/lab/');
    const nav = page.locator('[data-site-header] nav[aria-label="Main"]');
    await expect(page.locator('[data-mobile-nav]')).toBeHidden();
    for (const href of HREFS) {
      await expect(nav.locator(`a.top[href="${href}"]`)).toBeVisible();
    }
    await expect(nav.locator('a.top[aria-current="page"]')).toHaveCount(1);
    await expect(nav.locator('a.top[aria-current="page"]')).toHaveAttribute('href', '/lab/');
  });

  test('brand links home', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-brand]')).toHaveAttribute('href', '/');
  });
});
