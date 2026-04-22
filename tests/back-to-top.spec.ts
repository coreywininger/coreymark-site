import { expect, test } from '@playwright/test';

test.describe('back to top', () => {
  test('hidden until scrolled, clicking returns to top (regression for #10)', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');

    const btn = page.locator('[data-back-to-top]');
    await expect(btn).toBeAttached();
    await expect(btn).not.toHaveAttribute('data-visible', 'true');

    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect(btn).toHaveAttribute('data-visible', 'true');

    await btn.click();
    await page.waitForFunction(() => window.scrollY < 50);
    expect(await page.evaluate(() => window.scrollY)).toBeLessThan(50);
  });

  test('does not render on non-post pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-back-to-top]')).toHaveCount(0);
  });
});
