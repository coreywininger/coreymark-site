import { expect, test } from '@playwright/test';

test.describe('Nav search overlay', () => {
  test('search icon is visible in nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#search-trigger')).toBeVisible();
  });

  test('clicking search icon opens overlay', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-trigger').click();
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
  });

  test('Escape key closes overlay', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-trigger').click();
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });

  test('⌘K / Ctrl+K opens overlay', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Meta+k');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
  });

  test('clicking backdrop closes overlay', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-trigger').click();
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.locator('.search-overlay-backdrop').click();
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });

  test('searching "base64" returns a result', async ({ page }) => {
    await page.goto('/');
    await page.locator('#search-trigger').click();
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    const searchInput = page.locator('#pagefind-ui input[type="text"]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.fill('base64');
    await expect(page.locator('.pagefind-ui__result').first()).toBeVisible({ timeout: 8000 });
  });
});
