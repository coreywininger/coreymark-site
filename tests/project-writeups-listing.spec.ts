import { expect, test } from '@playwright/test';

test.describe('ProjectWriteups auto-list on project pages', () => {
  test('lists at least two writeups on DailyBriefing', async ({ page }) => {
    await page.goto('/projects/dailybriefing');

    const region = page.locator('[data-project-writeups]');
    await expect(region).toBeVisible();

    const links = region.locator('[data-writeup-link]');
    const count = await links.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });
});
