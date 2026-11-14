import { test, expect } from '@playwright/test';

// Search-result hygiene for every page in the built sitemap. Lengths are
// checked as numbers, never as copy: titles fit a result line, descriptions
// fit a snippet, and every URL in structured data is in the form the site
// serves (trailing slash), so nothing points at a non-canonical address.

const ORIGIN = 'https://coreymark.com';
const SUFFIX = ' · Corey Wininger';
const TITLE_MAX = 60; // before the suffix
const DESC_MIN = 50;
const DESC_MAX = 160;

async function sitemapPaths(request: import('@playwright/test').APIRequestContext) {
  const index = await (await request.get('/sitemap-index.xml')).text();
  const maps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  const paths: string[] = [];
  for (const map of maps) {
    const xml = await (await request.get(map)).text();
    for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) paths.push(new URL(m[1]).pathname);
  }
  return paths;
}

function urlsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith(ORIGIN)) out.push(value);
  } else if (Array.isArray(value)) {
    for (const v of value) urlsIn(v, out);
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) urlsIn(v, out);
  }
  return out;
}

test.describe('search-result hygiene', () => {
  test.setTimeout(120_000);

  test('titles, descriptions, canonicals and structured-data URLs on every page', async ({ page, request }) => {
    await page.route('**/ip.coreymark.com/**', (route) =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ip: '203.0.113.42' }) }),
    );
    const paths = await sitemapPaths(request);
    expect(paths.length).toBeGreaterThan(20);

    const problems: string[] = [];
    const titles = new Map<string, string>();
    const descriptions = new Map<string, string>();

    for (const path of paths) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      const info = await page.evaluate(() => ({
        title: document.title,
        descriptions: [...document.querySelectorAll('meta[name="description"]')].map((m) => m.getAttribute('content') ?? ''),
        canonicals: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.getAttribute('href')),
        robots: document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? null,
        ld: [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent ?? ''),
      }));

      const base = info.title.endsWith(SUFFIX) ? info.title.slice(0, -SUFFIX.length) : info.title;
      if (base.length > TITLE_MAX) problems.push(`${path}: title is ${base.length} characters before the suffix`);
      if (titles.has(info.title)) problems.push(`${path}: same title as ${titles.get(info.title)}`);
      titles.set(info.title, path);

      if (info.descriptions.length !== 1) problems.push(`${path}: ${info.descriptions.length} meta descriptions`);
      const desc = info.descriptions[0] ?? '';
      if (desc.length < DESC_MIN || desc.length > DESC_MAX) problems.push(`${path}: description is ${desc.length} characters`);
      if (descriptions.has(desc)) problems.push(`${path}: same description as ${descriptions.get(desc)}`);
      descriptions.set(desc, path);

      if (info.canonicals.length !== 1 || info.canonicals[0] !== ORIGIN + path) {
        problems.push(`${path}: canonical is ${JSON.stringify(info.canonicals)}`);
      }
      if (info.robots && /noindex|none/i.test(info.robots)) problems.push(`${path}: robots meta is ${info.robots}`);

      for (const raw of info.ld) {
        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch {
          problems.push(`${path}: structured data does not parse`);
          continue;
        }
        for (const url of urlsIn(data)) {
          const { pathname } = new URL(url);
          const isFile = /\.[a-z0-9]+$/i.test(pathname);
          if (!isFile && !pathname.endsWith('/')) problems.push(`${path}: structured-data URL without trailing slash: ${url}`);
        }
      }
    }

    expect(problems).toEqual([]);
  });
});
