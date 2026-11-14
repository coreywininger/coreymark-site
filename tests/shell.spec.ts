import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const POST = '/blog/claude-plus-github-actions-integration-playbook/';
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];

// Force the platform the pre-paint script sees (userAgentData first, then
// navigator.platform), regardless of the machine running the tests.
const mockPlatform = (platform: string) => `
  Object.defineProperty(navigator, 'userAgentData', { get: () => ({ platform: ${JSON.stringify(platform)} }) });
  Object.defineProperty(navigator, 'platform', { get: () => ${JSON.stringify(platform)} });
`;

test.describe('search shortcut label', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('Apple platforms get the mac label', async ({ page }) => {
    await page.addInitScript(mockPlatform('macOS'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'mac');
    const label = page.locator('[data-search-shortcut]');
    await expect(label.locator('.k-mac')).toBeVisible();
    await expect(label.locator('.k-other')).toBeHidden();
  });

  test('other platforms get the Ctrl label', async ({ page }) => {
    await page.addInitScript(mockPlatform('Windows'));
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-platform');
    const label = page.locator('[data-search-shortcut]');
    await expect(label.locator('.k-other')).toBeVisible();
    await expect(label.locator('.k-mac')).toBeHidden();
  });

  test('falls back to navigator.platform without userAgentData', async ({ page }) => {
    await page.addInitScript(`
      Object.defineProperty(navigator, 'userAgentData', { get: () => undefined });
      Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    `);
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-platform', 'mac');
  });

  test('Ctrl+K opens search', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('Control+k');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
  });
});

test.describe('header + footer', () => {
  test('header gains data-scrolled after scrolling', async ({ page }) => {
    await page.goto(POST);
    const header = page.locator('[data-site-header]');
    await expect(header).not.toHaveAttribute('data-scrolled');
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveAttribute('data-scrolled', '');
  });

  test('footer has the three links and a copyright line', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer.locator('a[href*="linkedin.com/in/"]')).toHaveCount(1);
    await expect(footer.locator('a[href^="https://github.com/"]')).toHaveCount(1);
    await expect(footer.locator('a[href="/rss.xml"]')).toHaveCount(1);
    await expect(footer.locator('[data-copyright]')).toContainText(String(new Date().getFullYear()));
  });
});

test.describe('reading progress', () => {
  test('bar grows with scroll on a post', async ({ page }) => {
    await page.goto(POST);
    const bar = page.locator('[data-reading-progress] .rp-bar');
    await expect(bar).toBeAttached();
    const scale = () =>
      bar.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
    expect(await scale()).toBeLessThan(0.05);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(scale).toBeGreaterThan(0.95);
  });

  test('is not rendered on non-post pages', async ({ page }) => {
    await page.goto('/now/');
    await expect(page.locator('[data-reading-progress]')).toHaveCount(0);
  });
});

test.describe('removed integrations', () => {
  test('posts have no comments embed or newsletter form', async ({ page }) => {
    await page.goto(POST);
    await expect(page.locator('#giscus-container, iframe.giscus-frame, script[src*="giscus"]')).toHaveCount(0);
    await expect(page.locator('form[action*="buttondown"]')).toHaveCount(0);
  });

  test('contact page has no newsletter form', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('form[action*="buttondown"]')).toHaveCount(0);
  });

  test('CSP no longer allows giscus and still allows Pagefind wasm', () => {
    const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8'));
    const csp: string = config.globalHeaders['Content-Security-Policy'];
    expect(csp).not.toContain('giscus');
    expect(csp).toContain("'wasm-unsafe-eval'");
  });
});

test.describe('contrast', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const theme of THEMES) {
    test(`shell and code blocks pass 4.5:1 in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(POST);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      await page.locator('[data-theme-button]').click();

      const results = await new AxeBuilder({ page })
        .withRules(['color-contrast'])
        .include('[data-site-header]')
        .include('footer')
        .include('pre.astro-code code')
        .analyze();
      const failures = results.violations.flatMap((v) =>
        v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
      );
      expect(failures).toEqual([]);
    });
  }
});
