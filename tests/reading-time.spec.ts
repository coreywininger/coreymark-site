import { expect, test } from '@playwright/test';

test.describe('reading time', () => {
  test('every blog card surfaces N min read (regression for #12)', async ({
    page,
  }) => {
    await page.goto('/blog');

    const cards = page.locator('article[data-pillar]');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i)).toContainText(/\d+ min read/);
    }
  });

  test('post header surfaces N min read (regression for #12)', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');
    await expect(page.locator('article header')).toContainText(
      /\d+ min read/,
    );
  });
});
