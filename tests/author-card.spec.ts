import { expect, test } from '@playwright/test';

test.describe('author card', () => {
  test('renders at the end of posts with the badge and links to /about/ (regression for #13)', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');

    const card = page.locator('[data-author-card]');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('aria-label', /.+/);

    // Badge, not the headshot: the photo lives on /about/ only.
    await expect(card.locator('img')).toHaveCount(0);
    await expect(card.locator('.keycap')).toBeVisible();

    await expect(card.locator('[data-author-more]')).toHaveAttribute('href', '/about/');
    expect(await card.locator('a[href="/about/"]').count()).toBeGreaterThanOrEqual(2);
  });

  test('the old headshot footer is gone', async ({ page }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');
    await expect(page.locator('[data-author-footer]')).toHaveCount(0);
  });
});
