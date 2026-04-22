import { expect, test } from '@playwright/test';

test.describe('ProjectWriteups featured-exclusion guard', () => {
  test('no writeup href appears more than once on DailyBriefing', async ({
    page,
  }) => {
    await page.goto('/projects/dailybriefing');

    const region = page.locator('[data-project-writeups]');
    await expect(region).toBeVisible();

    const hrefs = await region
      .locator('[data-writeup-link]')
      .evaluateAll((els) =>
        els.map((el) => new URL((el as HTMLAnchorElement).href).pathname.replace(/\/+$/, '')),
      );

    const dedup = new Set(hrefs);
    expect(dedup.size).toBe(hrefs.length);
  });
});
