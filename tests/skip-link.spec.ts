import { expect, test } from '@playwright/test';

test.describe('skip to content', () => {
  test('first Tab focuses skip link, Enter jumps to #main (regression for #14)', async ({
    page,
  }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.keyboard.press('Tab');

    const focused = page.locator(':focus');
    await expect(focused).toHaveJSProperty('tagName', 'A');
    await expect(focused).toHaveAttribute('href', '#main');
    await expect(focused).toBeVisible();

    await focused.press('Enter');

    await expect(page).toHaveURL(/#main$/);
  });
});
