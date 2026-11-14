import { readFileSync } from 'node:fs';
import { expect, test, type APIRequestContext } from '@playwright/test';

// Icons and Open Graph images. Dimensions are read from each PNG's IHDR
// header, so the checks follow the files that are actually served.

async function png(request: APIRequestContext, path: string) {
  const res = await request.get(path);
  expect(res.status(), path).toBe(200);
  expect(res.headers()['content-type'], path).toContain('image/png');
  const body = await res.body();
  expect(body.subarray(1, 4).toString('latin1'), path).toBe('PNG');
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20), bytes: body.length };
}

test.describe('icons', () => {
  test('pages link PNG icons only: no SVG and no .ico link', async ({ page }) => {
    for (const route of ['/', '/about/', '/lab/cron/', '/blog/it-depends-is-where-it-loses-the-business/']) {
      await page.goto(route);
      const icons = await page.locator('head link[rel~="icon"]').evaluateAll((els) =>
        els.map((e) => ({ href: e.getAttribute('href'), type: e.getAttribute('type'), sizes: e.getAttribute('sizes') })),
      );
      expect(icons, route).toEqual([
        { href: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
        { href: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      ]);
      await expect(page.locator('head link[href$=".svg"], head link[href$=".ico"]')).toHaveCount(0);
      const touch = page.locator('head link[rel="apple-touch-icon"]');
      await expect(touch).toHaveCount(1);
      await expect(touch).toHaveAttribute('href', '/apple-touch-icon.png');
      await expect(touch).toHaveAttribute('sizes', '180x180');
    }
  });

  test('icon files have the dimensions their names and link tags claim', async ({ request }) => {
    const expected: [string, number][] = [
      ['/favicon-16x16.png', 16],
      ['/favicon-32x32.png', 32],
      ['/apple-touch-icon.png', 180],
      ['/android-chrome-192x192.png', 192],
      ['/android-chrome-512x512.png', 512],
      ['/android-chrome-512x512-maskable.png', 512],
    ];
    for (const [path, size] of expected) {
      const info = await png(request, path);
      expect([info.width, info.height], path).toEqual([size, size]);
    }
  });

  test('/favicon.ico is still served with 16, 32 and 48px entries', async ({ request }) => {
    const res = await request.get('/favicon.ico');
    expect(res.status()).toBe(200);
    const body = await res.body();
    expect([body.readUInt16LE(0), body.readUInt16LE(2)]).toEqual([0, 1]); // ICO header
    const count = body.readUInt16LE(4);
    const sizes = Array.from({ length: count }, (_, i) => body.readUInt8(6 + i * 16));
    expect(sizes).toEqual([16, 32, 48]);
  });

  test('the SVG source is not served from the site root', async ({ request }) => {
    expect((await request.get('/favicon.svg')).status()).toBe(404);
  });

  test('web manifest icons exist at their declared sizes', async ({ request }) => {
    const res = await request.get('/site.webmanifest');
    expect(res.status()).toBe(200);
    const manifest = JSON.parse(await res.text());
    expect(manifest.icons.length).toBeGreaterThanOrEqual(3);
    expect(manifest.icons.some((i: any) => i.purpose === 'maskable')).toBe(true);
    for (const icon of manifest.icons) {
      const [w, h] = String(icon.sizes).split('x').map(Number);
      const info = await png(request, icon.src);
      expect([info.width, info.height], icon.src).toEqual([w, h]);
      expect(icon.type).toBe('image/png');
    }
    // Matches the default theme's background (see src/data/appearance.ts).
    const slate = readFileSync('src/data/appearance.ts', 'utf8').match(/id: 'slate'[^}]*bg: '(#[0-9A-Fa-f]{6})'/)![1];
    expect(manifest.theme_color.toLowerCase()).toBe(slate.toLowerCase());
    expect(manifest.background_color.toLowerCase()).toBe(slate.toLowerCase());
  });
});

test.describe('open graph images', () => {
  test('every post has its own 1200x630 og:image', async ({ page, request }) => {
    await page.goto('/blog/');
    const posts = await page
      .locator('[data-post-list] [data-post-row] a')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href')!));
    expect(posts.length).toBeGreaterThan(5);

    const seen = new Set<string>();
    for (const href of posts) {
      const slug = href.replace(/^\/blog\/|\/$/g, '');
      await page.goto(href);
      const og = (await page.locator('meta[property="og:image"]').getAttribute('content'))!;
      const twitter = (await page.locator('meta[name="twitter:image"]').getAttribute('content'))!;
      const url = new URL(og);
      expect(url.pathname, href).toBe(`/og/${slug}.png`);
      expect(twitter, href).toBe(og);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');

      const info = await png(request, url.pathname);
      expect([info.width, info.height], url.pathname).toEqual([1200, 630]);
      expect(info.bytes, url.pathname).toBeLessThan(600_000);
      seen.add(url.pathname);
    }
    expect(seen.size).toBe(posts.length);
  });

  test('other pages use the 1200x630 default image', async ({ page, request }) => {
    for (const route of ['/', '/about/', '/lab/', '/projects/dailybriefing/']) {
      await page.goto(route);
      const og = (await page.locator('meta[property="og:image"]').getAttribute('content'))!;
      expect(new URL(og).pathname, route).toBe('/og-default.png');
    }
    const info = await png(request, '/og-default.png');
    expect([info.width, info.height]).toEqual([1200, 630]);
  });

  test('each pillar has a card background on disk', () => {
    const topics = readFileSync('src/data/topics.ts', 'utf8');
    const ids = [...topics.matchAll(/\{ id: '(\w+)'/g)].map((m) => m[1]).filter((id) => id !== 'lab');
    expect(ids.length).toBe(5);
    for (const id of ids) {
      const buf = readFileSync(`src/assets/og/bg-${id}.png`);
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], id).toEqual([1200, 630]);
    }
  });
});
