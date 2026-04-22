import { expect, test } from '@playwright/test';

test.describe('code copy button', () => {
  test('every <pre> in post body gets a copy button; click shows success state (regression for #11)', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/blog/shipping-a-site-with-ai-field-report/');
    await page.waitForLoadState('networkidle');

    const pres = page.locator('article .prose pre');
    const preCount = await pres.count();
    expect(preCount).toBeGreaterThan(0);

    for (let i = 0; i < preCount; i++) {
      await expect(pres.nth(i).locator('[data-code-copy]')).toHaveCount(1);
    }

    const firstBtn = pres.first().locator('[data-code-copy]');
    await firstBtn.click();
    await expect(firstBtn).toHaveText('Copied!');
    await expect(firstBtn).toHaveAttribute('data-state', 'copied');
  });

  test('inline <code> in prose does not get a copy button', async ({ page }) => {
    await page.goto('/blog/shipping-a-site-with-ai-field-report/');
    await page.waitForLoadState('networkidle');

    const inlineCodeBtns = page.locator(
      'article .prose :not(pre) > code [data-code-copy]',
    );
    await expect(inlineCodeBtns).toHaveCount(0);
  });
});
