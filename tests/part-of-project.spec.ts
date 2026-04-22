import { expect, test } from '@playwright/test';

test.describe('PartOfProject breadcrumb on blog posts', () => {
  test('renders breadcrumb on a post tagged with a project', async ({
    page,
  }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report');

    const breadcrumb = page.locator('[data-part-of-project]');
    await expect(breadcrumb).toBeVisible();

    const link = breadcrumb.locator('a').first();
    await expect(link).toHaveAttribute('href', /^\/projects\//);
  });

  test('omits breadcrumb on a post without a project', async ({ page }) => {
    await page.goto('/blog/what-ai-wont-do-for-your-it-org');
    await expect(page.locator('[data-part-of-project]')).toHaveCount(0);
  });
});
