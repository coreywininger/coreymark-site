import { expect, test } from '@playwright/test';

test.describe('author footer', () => {
  test('renders on posts with headshot and social links (regression for #13)', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');

    const footer = page.locator('[data-author-footer]');
    await expect(footer).toBeVisible();

    await expect(footer.locator('img[alt="Corey Wininger"]')).toBeVisible();
    await expect(footer).toContainText('Corey Wininger');

    await expect(
      footer.locator('a[href*="linkedin.com/in/coreywininger"]'),
    ).toHaveCount(1);
    await expect(
      footer.locator('a[href*="github.com/coreywininger"]'),
    ).toHaveCount(1);
    await expect(footer.locator('a[href="/rss.xml"]')).toHaveCount(1);
    await expect(footer.locator('a[href^="mailto:"]')).toHaveCount(1);
  });
});
