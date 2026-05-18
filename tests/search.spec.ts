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

test.describe('Blog search + pillar filter', () => {
  test('search input is visible on /blog/', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.locator('#blog-search-input')).toBeVisible();
  });

  test('typing "cloud bill" filters to the matching post', async ({ page }) => {
    await page.goto('/blog/');
    await page.locator('#blog-search-input').fill('cloud bill');
    const visible = page.locator('[data-post-list] [data-pillar]:not([hidden])');
    await expect(visible).toHaveCount(1);
    await expect(visible.first()).toContainText('cloud bill');
  });

  test('typing a term with no matches hides all cards', async ({ page }) => {
    await page.goto('/blog/');
    await page.locator('#blog-search-input').fill('zzznomatch');
    await expect(page.locator('[data-post-list] [data-pillar]:not([hidden])')).toHaveCount(0);
  });

  test('clearing search input restores all posts', async ({ page }) => {
    await page.goto('/blog/');
    const totalCount = await page.locator('[data-post-list] [data-pillar]').count();
    await page.locator('#blog-search-input').fill('cloud bill');
    await expect(page.locator('[data-post-list] [data-pillar]:not([hidden])')).toHaveCount(1);
    await page.locator('#blog-search-input').fill('');
    await expect(page.locator('[data-post-list] [data-pillar]:not([hidden])')).toHaveCount(totalCount);
  });

  test('pillar chip + search: only posts matching both are shown', async ({ page }) => {
    await page.goto('/blog/');
    // Activate "Hybrid Cloud" pillar — cloud posts only
    await page.locator('[data-pillar-filters] [data-filter="cloud"]').click();
    // Search for a term that only appears in a non-cloud post
    await page.locator('#blog-search-input').fill('change management');
    await expect(page.locator('[data-post-list] [data-pillar]:not([hidden])')).toHaveCount(0);
  });

  test('pillar chip alone still works (regression)', async ({ page }) => {
    await page.goto('/blog/');
    await page.locator('[data-pillar-filters] [data-filter="cloud"]').click();
    const visible = page.locator('[data-post-list] [data-pillar]:not([hidden])');
    const count = await visible.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await expect(visible.nth(i)).toHaveAttribute('data-pillar', 'cloud');
    }
  });
});
