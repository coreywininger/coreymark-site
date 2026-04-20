import { expect, test } from '@playwright/test';

test.describe('post card focus ring', () => {
  test('card shows focus-within ring when inner link is focused (regression for #3)', async ({
    page,
  }) => {
    await page.goto('/blog');

    const card = page.locator('article[data-pillar]').first();
    const link = card.locator('a').first();

    await link.focus();

    const cardClasses = await card.getAttribute('class');
    expect(cardClasses).toContain('focus-within:ring-2');
    expect(cardClasses).toContain('focus-within:ring-accent-primary');
  });
});
