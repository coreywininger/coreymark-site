import { expect, test } from '@playwright/test';

test.describe('reading time', () => {
  test('every row on the Writing index shows minutes (regression for #12)', async ({ page }) => {
    await page.goto('/blog/');

    const rows = page.locator('[data-post-list] [data-post-row]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(rows.nth(i).locator('[data-reading-time]')).toHaveText(/\d+\s*min/);
    }
  });

  test('post byline shows minutes to read (regression for #12)', async ({ page }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');
    await expect(page.locator('[data-post] header [data-reading-time]')).toHaveText(/\d+\s*min/);
  });
});
