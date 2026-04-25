import { expect, test } from '@playwright/test';

test.describe('theme toggle', () => {
  test.beforeEach(async ({ page }) => {
    // The FOUC script in Base.astro reads localStorage before paint. Clear
    // before the very first script runs so default-resolution tests don't
    // see a value from a prior test. Gate on window.name (preserved across
    // same-tab reloads) so reloads WITHIN a test don't clear values the
    // test itself just persisted.
    await page.addInitScript(() => {
      if (window.name !== '__theme_test_active') {
        try { localStorage.clear(); } catch {}
        window.name = '__theme_test_active';
      }
    });
  });

  test('defaults to dark when no localStorage and OS is dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('defaults to light when no localStorage and OS is light', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('clicking the toggle flips data-theme and persists across reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const toggle = page.locator('[data-theme-toggle]').first();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await toggle.click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });

  test('aria-pressed mirrors current theme state', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    const toggle = page.locator('[data-theme-toggle]').first();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  });

  test("toggle replaces paired theme-color metas with a single un-media'd tag", async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/');

    // Before any toggle: two paired media-query meta tags from Base.astro.
    const before = page.locator('meta[name="theme-color"]');
    await expect(before).toHaveCount(2);

    await page.locator('[data-theme-toggle]').first().click();

    // After toggle: exactly one tag, no media attribute, content matches LIGHT_BG.
    const after = page.locator('meta[name="theme-color"]');
    await expect(after).toHaveCount(1);
    await expect(after).toHaveAttribute('content', '#FAFAF7');
    await expect(after).not.toHaveAttribute('media', /.+/);

    // After reload: FOUC script honors stored value and emits a single un-media'd tag.
    await page.reload();
    const reloaded = page.locator('meta[name="theme-color"]');
    await expect(reloaded).toHaveCount(1);
    await expect(reloaded).toHaveAttribute('content', '#FAFAF7');
  });
});
