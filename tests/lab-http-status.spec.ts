import { expect, test } from '@playwright/test';

test.describe('lab index — http-status tool', () => {
  test('http-status card appears under DevOps section', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-lab-section="devops"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="http-status"]')).toBeVisible();
  });

  test('http-status card links to /lab/http-status/', async ({ page }) => {
    await page.goto('/lab/');
    const card = page.locator('[data-lab-tool="http-status"]');
    await card.locator('a').first().click();
    await expect(page).toHaveURL(/\/lab\/http-status\/?$/);
  });
});

test.describe('HTTP Status Reference', () => {
  test('page loads and shows heading', async ({ page }) => {
    await page.goto('/lab/http-status/');
    await expect(page.locator('main h1')).toContainText('HTTP Status Reference');
  });

  test('default render shows more than 50 code rows', async ({ page }) => {
    await page.goto('/lab/http-status/');
    await expect(page.locator('[data-code-row]').first()).toBeVisible();
    const count = await page.locator('[data-code-row]').count();
    expect(count).toBeGreaterThan(50);
  });

  test('category filter "4xx" reduces results to only 4xx codes', async ({ page }) => {
    await page.goto('/lab/http-status/');
    await page.locator('.hs-chip[data-cat="4"]').click();
    // Wait for async render (RAF + setTimeout yield)
    await expect(page.locator('#stats-bar')).not.toContainText('Showing 57 of');
    const rows = page.locator('[data-code-row]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(30);
    // All visible codes should be 4xx
    for (let i = 0; i < Math.min(count, 5); i++) {
      await expect(rows.nth(i).locator('.hs-code-badge')).toHaveText(/^4\d\d$/);
    }
  });

  test('"Common only" toggle reduces result count', async ({ page }) => {
    await page.goto('/lab/http-status/');
    const allCount = await page.locator('[data-code-row]').count();
    await page.locator('#common-only').check();
    // Wait for the async render to settle (RAF + setTimeout yield)
    await expect(page.locator('#stats-bar')).not.toContainText('Showing ' + allCount + ' of');
    const commonCount = await page.locator('[data-code-row]').count();
    expect(commonCount).toBeLessThan(allCount);
  });

  test('search for "502" shows the 502 row', async ({ page }) => {
    await page.goto('/lab/http-status/');
    await page.locator('#search-input').fill('502');
    // Wait for debounce (120ms) + RAF render to settle
    await expect(page.locator('#stats-bar')).not.toContainText('Showing 57 of');
    await expect(page.locator('#code-502')).toBeVisible();
    // "502" substring also appears in 503's detail text, so count may be > 1
    const count = await page.locator('[data-code-row]').count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  test('search for "gateway" returns results including 502', async ({ page }) => {
    await page.goto('/lab/http-status/');
    await page.locator('#search-input').fill('gateway');
    await expect(page.locator('[data-code-row]').first()).toBeVisible();
    const count = await page.locator('[data-code-row]').count();
    expect(count).toBeGreaterThan(0);
    await expect(page.locator('#code-502')).toBeVisible();
  });

  test('copy button exists on first result row', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/lab/http-status/');
    await expect(page.locator('[data-code-row]').first().locator('.hs-btn-copy').first()).toBeVisible();
  });

  test('?code=502 param: 502 row is present and highlighted', async ({ page }) => {
    await page.goto('/lab/http-status/?code=502');
    await expect(page.locator('#code-502')).toBeVisible();
    await expect(page.locator('#code-502')).toHaveClass(/highlighted/);
  });

  test('no title echo: page title does not include "502" when ?code=502 is loaded', async ({ page }) => {
    await page.goto('/lab/http-status/?code=502');
    const title = await page.title();
    expect(title).not.toContain('502');
    expect(title).toContain('HTTP Status Reference');
  });

  test('breadcrumb is present', async ({ page }) => {
    await page.goto('/lab/http-status/');
    const crumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(crumb).toContainText('Home');
    await expect(crumb).toContainText('Lab');
    await expect(crumb).toContainText('HTTP Status Reference');
  });

  test('Lab nav item is active on /lab/http-status/', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/lab/http-status/');
    const labLink = page.locator('nav[aria-label="Primary"] a', { hasText: 'Lab' });
    await expect(labLink).toHaveAttribute('aria-current', 'page');
  });
});
