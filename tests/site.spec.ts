import { expect, test } from '@playwright/test';

// Site-wide regression net: every URL in the built sitemap gets the same
// structural checks, so a new page (or a shared component) cannot quietly
// break them. Runs against the production build.

const SITE = 'https://coreymark.com';

async function sitemapPaths(request: import('@playwright/test').APIRequestContext) {
  const index = await (await request.get('/sitemap-index.xml')).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const paths: string[] = [];
  for (const map of maps) {
    const xml = await (await request.get(map)).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const url = new URL(m[1]);
      expect(url.origin).toBe(SITE);
      paths.push(url.pathname);
    }
  }
  return [...new Set(paths)].sort();
}

test.describe('every page in the sitemap', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.setTimeout(120_000);

  test('one h1, no sideways scroll at 390px, unique ids, single title suffix, no "Stratum"', async ({ page, request }) => {
    // The IP tool calls ip.coreymark.com on load; keep the run offline with a
    // documentation-range address and generic location data.
    await page.route('https://ip.coreymark.com/**', (route) =>
      route.fulfill({
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify({ ip: '203.0.113.42', country: 'US', country_name: 'United States', region: 'Indiana', region_code: 'IN', city: 'Indianapolis', postal: '46204', latitude: 39.77, longitude: -86.16, user_agent: 'Mozilla/5.0 (test)' }),
      }),
    );

    const paths = await sitemapPaths(request);
    // Sanity: the sitemap covers the main sections, and the 404 is not in it.
    for (const p of ['/', '/about/', '/blog/', '/contact/', '/lab/', '/now/', '/projects/']) {
      expect(paths).toContain(p);
    }
    expect(paths.some((p) => p.includes('404'))).toBe(false);
    expect(paths.length).toBeGreaterThan(25);

    const problems: string[] = [];
    for (const path of paths) {
      const res = await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (!res || res.status() !== 200) {
        problems.push(`${path}: status ${res?.status()}`);
        continue;
      }
      await page.waitForLoadState('load');
      const facts = await page.evaluate(() => {
        const ids = new Map<string, number>();
        document.querySelectorAll('[id]').forEach((e) => ids.set(e.id, (ids.get(e.id) ?? 0) + 1));
        return {
          h1: document.querySelectorAll('h1').length,
          hScroll: document.documentElement.scrollWidth > window.innerWidth,
          dupes: [...ids].filter(([, n]) => n > 1).map(([id]) => id),
          suffixes: document.title.split('Corey Wininger').length - 1,
          title: document.title,
          stratum: /stratum/i.test(document.documentElement.outerHTML),
          lang: document.documentElement.lang,
          main: document.querySelectorAll('main#main').length,
        };
      });
      if (facts.h1 !== 1) problems.push(`${path}: ${facts.h1} h1 elements`);
      if (facts.hScroll) problems.push(`${path}: scrolls sideways at 390px`);
      if (facts.dupes.length) problems.push(`${path}: duplicate ids ${facts.dupes.join(', ')}`);
      if (facts.suffixes !== 1) problems.push(`${path}: title "${facts.title}" has the site name ${facts.suffixes} times`);
      if (facts.stratum) problems.push(`${path}: contains "Stratum"`);
      if (facts.lang !== 'en') problems.push(`${path}: html lang is "${facts.lang}"`);
      if (facts.main !== 1) problems.push(`${path}: ${facts.main} main#main landmarks`);
    }
    expect(problems).toEqual([]);
  });
});
