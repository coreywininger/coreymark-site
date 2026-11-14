import { expect, test } from '@playwright/test';

const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const FONTS = ['redhat', 'plex', 'geist', 'martian', 'jetbrains'];

test.describe('theme + font picker', () => {
  test.beforeEach(async ({ page }) => {
    // The pre-paint script in Base.astro reads localStorage before paint.
    // Clear once per test (window.name survives same-tab reloads, so reloads
    // inside a test keep what the test itself saved).
    await page.addInitScript(() => {
      if (window.name !== '__appearance_test_active') {
        try { localStorage.clear(); } catch {}
        window.name = '__appearance_test_active';
      }
    });
  });

  test('defaults to slate + redhat with nothing saved', async ({ page }) => {
    await page.goto('/now/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'redhat');
  });

  test('panel offers six themes and five fonts', async ({ page }) => {
    await page.goto('/now/');
    const button = page.locator('[data-theme-button]');
    const panel = page.locator('[data-theme-panel]');
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');

    await button.click();
    await expect(panel).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');

    for (const t of THEMES) {
      await expect(panel.locator(`[data-theme-option="${t}"]`)).toBeVisible();
    }
    for (const f of FONTS) {
      await expect(panel.locator(`[data-font-select] option[value="${f}"]`)).toBeAttached();
    }
    await expect(panel.locator('[data-theme-option="slate"]')).toHaveAttribute('aria-pressed', 'true');

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(button).toBeFocused();
  });

  test('picking a theme sets data-theme, aria-pressed, theme-color, and persists', async ({ page }) => {
    await page.goto('/now/');
    await page.locator('[data-theme-button]').click();
    const swatch = page.locator('[data-theme-option="dracula"]');
    const bg = await swatch.getAttribute('data-theme-bg');
    await swatch.click();

    const html = page.locator('html');
    const meta = page.locator('meta[name="theme-color"]');
    await expect(html).toHaveAttribute('data-theme', 'dracula');
    await expect(swatch).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-theme-option="slate"]')).toHaveAttribute('aria-pressed', 'false');
    await expect(meta).toHaveCount(1);
    await expect(meta).toHaveAttribute('content', bg!);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dracula');
    await expect(meta).toHaveCount(1);
    await expect(meta).toHaveAttribute('content', bg!);
  });

  test('picking a font sets data-font and persists', async ({ page }) => {
    await page.goto('/now/');
    await page.locator('[data-theme-button]').click();
    await page.locator('[data-font-select]').selectOption('plex');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'plex');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-font', 'plex');
    await expect(page.locator('[data-font-select]')).toHaveValue('plex');
  });

  test('saved theme + font are applied before <body> exists (no flash)', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'tokyo');
        localStorage.setItem('font', 'geist');
      } catch {}
      // Record <html> state at the moment the parser creates <body>.
      new MutationObserver((_, obs) => {
        if (document.body) {
          const d = document.documentElement;
          (window as any).__atBody = [d.getAttribute('data-theme'), d.getAttribute('data-font')];
          obs.disconnect();
        }
      }).observe(document, { childList: true, subtree: true });
    });
    await page.goto('/now/');
    expect(await page.evaluate(() => (window as any).__atBody)).toEqual(['tokyo', 'geist']);
  });

  test('stale saved values are removed and defaults apply', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('theme', 'light');
        localStorage.setItem('font', 'inter');
      } catch {}
    });
    await page.goto('/now/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
    await expect(page.locator('html')).toHaveAttribute('data-font', 'redhat');
    const stored = await page.evaluate(() => [localStorage.getItem('theme'), localStorage.getItem('font')]);
    expect(stored).toEqual([null, null]);
  });
});
