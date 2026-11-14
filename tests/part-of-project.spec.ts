import { expect, test } from '@playwright/test';

test.describe('PartOfProject link on blog posts', () => {
  test('renders the link on a post tagged with a project', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report');

    const partOf = page.locator('[data-part-of-project]');
    await expect(partOf).toBeVisible();

    const link = partOf.locator('a').first();
    await expect(link).toHaveAttribute('href', /^\/projects\//);
  });

  test('omits the link on a post without a project', async ({ page }) => {
    await page.goto('/blog/what-ai-wont-do-for-your-it-org');
    await expect(page.locator('[data-part-of-project]')).toHaveCount(0);
  });
});
