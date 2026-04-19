import { expect, test } from '@playwright/test';

test.describe('mobile nav drawer', () => {
  test('opens full-screen and renders all nav items (regression for #1)', async ({ page }) => {
    await page.goto('/');

    const panel = page.locator('#mobile-menu');
    await expect(panel).toBeHidden();

    await page.getByRole('button', { name: 'Open menu' }).click();

    await expect(panel).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) throw new Error('viewport size unavailable');
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(viewport.height * 0.9);
    expect(box!.width).toBeGreaterThan(viewport.width * 0.9);

    const labels = ['Home', 'Blog', 'Projects', 'About', 'Now', 'Contact'];
    for (const label of labels) {
      const link = panel.getByRole('link', { name: label });
      await expect(link).toBeVisible();
      const linkBox = await link.boundingBox();
      expect(linkBox).not.toBeNull();
      expect(linkBox!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('Enter on hamburger transfers focus into drawer (regression for #4)', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.focus();
    await toggle.press('Enter');

    await expect(page.locator('#mobile-menu')).toBeVisible();
    const focused = page.locator(':focus');
    await expect(focused).toHaveJSProperty('tagName', 'A');
    await expect(focused).toHaveAttribute('href', '/');
  });

  test('close button dismisses drawer', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(page.locator('#mobile-menu')).toBeHidden();
  });
});
