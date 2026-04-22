import { expect, test } from '@playwright/test';

test.describe('projects empty-state', () => {
  test('renders placeholder card after real projects (regression for #15)', async ({
    page,
  }) => {
    await page.goto('/projects');

    const placeholder = page.locator('[data-empty-state]');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('More builds in progress');
    await expect(placeholder.locator('a')).toHaveCount(0);
  });
});
