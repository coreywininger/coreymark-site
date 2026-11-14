import { expect, test, type Page } from '@playwright/test';

// The overlay is a custom UI on the Pagefind index, so these run against the
// production build (the index does not exist in `astro dev`).
const overlay = '#search-overlay';
const items = '[data-search-results] [data-search-item]';
const hits = `${items}[data-kind]`; // real results (quick links have no kind)

async function openSearch(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.locator('#search-trigger').click();
  await expect(page.locator(overlay)).toHaveClass(/open/);
}
async function query(page: Page, q: string) {
  await page.locator('[data-search-input]').fill(q);
  await expect(page.locator(hits).first()).toBeVisible({ timeout: 8000 });
}
const selected = (page: Page) => page.locator(`${items}[aria-selected="true"]`);

test.describe('search: open and close', () => {
  test('ids in the overlay are unique on every page (regression: clashed with a lab tool)', async ({ page }) => {
    for (const route of ['/', '/lab/http-status/', '/blog/', '/lab/regex/']) {
      await page.goto(route);
      const dupes = await page.evaluate(() => {
        const seen = new Map<string, number>();
        document.querySelectorAll('[id]').forEach((e) => seen.set(e.id, (seen.get(e.id) ?? 0) + 1));
        return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
      });
      expect(dupes, route).toEqual([]);
    }
  });

  test('trigger is in the header and opens a labelled modal dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#search-trigger')).toBeVisible();
    await page.locator('#search-trigger').click();
    await expect(page.locator(overlay)).toHaveClass(/open/);
    await expect(page.locator(overlay)).toHaveAttribute('aria-hidden', 'false');
    const dialog = page.locator(`${overlay} [role="dialog"]`);
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAttribute('aria-labelledby', 'search-h');
    await expect(page.locator('[data-search-input]')).toBeFocused();
  });

  for (const combo of ['Control+k', 'Meta+k']) {
    test(`${combo} opens the overlay`, async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await page.keyboard.press(combo);
      await expect(page.locator(overlay)).toHaveClass(/open/);
      await expect(page.locator('[data-search-input]')).toBeFocused();
    });
  }

  test('Escape closes and returns focus to the trigger', async ({ page }) => {
    await openSearch(page);
    await page.keyboard.press('Escape');
    await expect(page.locator(overlay)).not.toHaveClass(/open/);
    await expect(page.locator(overlay)).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('#search-trigger')).toBeFocused();
  });

  test('backdrop click and the esc button close it', async ({ page }) => {
    await openSearch(page);
    await page.locator('.search-overlay-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(page.locator(overlay)).not.toHaveClass(/open/);

    await page.locator('#search-trigger').click();
    await expect(page.locator(overlay)).toHaveClass(/open/);
    await page.locator('#search-close').click();
    await expect(page.locator(overlay)).not.toHaveClass(/open/);
  });

  test('page behind does not scroll while open', async ({ page }) => {
    await openSearch(page);
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
  });
});

test.describe('search: results', () => {
  test('before typing, the six sections are offered with the first selected', async ({ page }) => {
    await openSearch(page);
    const quick = page.locator(items);
    await expect(quick).toHaveCount(6);
    expect(await quick.evaluateAll((els) => els.map((e) => e.getAttribute('href')))).toEqual([
      '/blog/', '/lab/', '/projects/', '/now/', '/about/', '/contact/',
    ]);
    await expect(selected(page)).toHaveCount(1);
    await expect(quick.first()).toHaveAttribute('aria-selected', 'true');
  });

  test('a query returns grouped results with the best match first and selected', async ({ page }) => {
    await openSearch(page);
    await query(page, 'cron');

    const first = page.locator(hits).first();
    await expect(first).toHaveAttribute('href', '/lab/cron/');
    await expect(first).toHaveAttribute('data-kind', 'tool');
    await expect(first).toHaveAttribute('aria-selected', 'true');
    await expect(first).toHaveAttribute('role', 'option');
    await expect(selected(page)).toHaveCount(1);
    await expect(page.locator('[data-search-input]')).toHaveAttribute('aria-activedescendant', (await first.getAttribute('id'))!);

    // Every result sits in a labelled group, and each group holds one kind.
    const groups = await page.locator('[data-search-results] [role="group"]').evaluateAll((gs) =>
      gs.map((g) => ({
        label: g.getAttribute('aria-label'),
        kinds: [...new Set([...g.querySelectorAll('[data-search-item]')].map((e) => e.getAttribute('data-kind')))],
      })),
    );
    expect(groups.length).toBeGreaterThan(1);
    for (const g of groups) {
      expect(g.label).toBeTruthy();
      expect(g.kinds).toHaveLength(1);
    }
    expect(await page.locator(hits).count()).toBeLessThanOrEqual(8);
    // Each result has a title, a subtitle and a colored dot.
    for (const f of await page.locator(hits).evaluateAll((els) =>
      els.map((e) => ({
        t: e.querySelector('.t')!.textContent!.trim(),
        d: e.querySelector('.d')!.textContent!.trim(),
        dot: !!e.querySelector('.dot'),
        c: (e as HTMLElement).style.getPropertyValue('--c'),
      })),
    )) {
      expect(f.t.length).toBeGreaterThan(0);
      expect(f.d.length).toBeGreaterThan(0);
      expect(f.dot).toBe(true);
      expect(f.c).toMatch(/^var\(--\w+\)$/);
    }
  });

  test('a page result shows the page name and its meta description', async ({ page }) => {
    await page.goto('/contact/');
    const description = (await page.locator('meta[name="description"]').getAttribute('content'))!;
    await openSearch(page);
    await query(page, 'contact');
    const hit = page.locator(`${hits}[href="/contact/"]`);
    await expect(hit).toHaveAttribute('data-kind', 'page');
    await expect(hit.locator('.d')).toHaveText(description);
    await expect(hit.locator('.t')).not.toHaveText('');
  });

  test('searching for a tool does not return every page that links to it', async ({ page }) => {
    await openSearch(page);
    await query(page, 'base64');
    const tools = await page.locator(`${hits}[data-kind="tool"]`).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    // The tool itself comes first. Other tools appear only if their own
    // content mentions it, not because of their "Other tools" links.
    expect(tools[0]).toBe('/lab/base64/');
    expect(tools.length).toBeLessThan(5);
  });

  test('the 404 page is not in the index', async ({ page }) => {
    await openSearch(page);
    await query(page, 'page');
    const hrefs = await page.locator(hits).evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs.some((h) => /404/.test(h ?? ''))).toBe(false);
  });

  test('no matches shows a message and no results', async ({ page }) => {
    await openSearch(page);
    await query(page, 'cron');
    await page.locator('[data-search-input]').fill('zzzqqqxxx');
    await expect(page.locator(items)).toHaveCount(0);
    const status = page.locator('[data-search-status]');
    await expect(status).toHaveAttribute('role', 'status');
    await expect(status).not.toHaveText('');
    await expect(page.locator('[data-search-input]')).not.toHaveAttribute('aria-activedescendant');

    // Clearing the field brings the section links back.
    await page.locator('[data-search-input]').fill('');
    await expect(page.locator(items)).toHaveCount(6);
    await expect(status).toHaveText('');
  });
});

test.describe('search: keyboard', () => {
  test('arrow keys move a single selection and wrap around', async ({ page }) => {
    await openSearch(page);
    await query(page, 'cron');
    const all = page.locator(items);
    const n = await all.count();
    expect(n).toBeGreaterThan(2);
    const input = page.locator('[data-search-input]');

    await page.keyboard.press('ArrowDown');
    await expect(all.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(selected(page)).toHaveCount(1);
    await expect(input).toHaveAttribute('aria-activedescendant', (await all.nth(1).getAttribute('id'))!);
    await expect(input).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await expect(all.nth(0)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('ArrowUp');
    await expect(all.nth(n - 1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(all.nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(selected(page)).toHaveCount(1);
  });

  test('Enter opens the selected result', async ({ page }) => {
    await openSearch(page);
    await query(page, 'cron');
    await page.keyboard.press('ArrowDown');
    const href = (await selected(page).getAttribute('href'))!;
    expect(href).not.toBe('/lab/cron/');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  });

  test('Enter on a fresh query opens the top result', async ({ page }) => {
    await openSearch(page);
    await query(page, 'subnet');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/lab\/subnet\/$/);
  });

  test('Tab stays inside the dialog', async ({ page }) => {
    await openSearch(page);
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => !!document.activeElement?.closest('#search-overlay [role="dialog"]'))).toBe(true);
    }
  });
});

test.describe('search: phone', () => {
  test('panel fits the viewport and results are 44px tall', async ({ page }) => {
    await openSearch(page);
    await query(page, 'vendor');
    const vp = page.viewportSize()!;
    const box = (await page.locator(`${overlay} [role="dialog"]`).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
    const heights = await page.locator(items).evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
  });
});
