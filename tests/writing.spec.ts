import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PILLARS = ['ops', 'business', 'ai', 'cloud', 'personal'];
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const DESKTOP = { width: 1280, height: 900 };

const rows = '[data-post-list] [data-post-row]';
const visibleRows = `${rows}:not([hidden])`;

test.describe('writing index: structure', () => {
  test('every row has a date, a post link, a topic and minutes', async ({ page }) => {
    await page.goto('/blog/');
    const all = page.locator(rows);
    const n = await all.count();
    expect(n).toBeGreaterThan(0);
    const facts = await all.evaluateAll((els) =>
      els.map((e) => ({
        pillar: e.getAttribute('data-pillar'),
        datetime: e.querySelector('time')?.getAttribute('datetime'),
        href: e.querySelector('a')?.getAttribute('href'),
        topic: !!e.querySelector('[data-row-topic]'),
        mins: !!e.querySelector('[data-reading-time]'),
      })),
    );
    for (const f of facts) {
      expect(PILLARS).toContain(f.pillar);
      expect(f.datetime).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(f.href).toMatch(/^\/blog\/[^/]+\/$/);
      expect(f.topic).toBe(true);
      expect(f.mins).toBe(true);
    }
    // Newest first.
    const dates = facts.map((f) => f.datetime!);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('posts are grouped by month and group counts add up', async ({ page }) => {
    await page.goto('/blog/');
    const groups = page.locator('[data-month-group]');
    expect(await groups.count()).toBeGreaterThan(0);
    const perGroup = await groups.evaluateAll((gs) =>
      gs.map((g) => ({
        rows: g.querySelectorAll('[data-post-row]').length,
        label: Number(g.querySelector('[data-group-count]')!.textContent!.match(/\d+/)![0]),
        months: new Set([...g.querySelectorAll('time')].map((t) => t.getAttribute('datetime')!.slice(0, 7))).size,
      })),
    );
    for (const g of perGroup) {
      expect(g.label).toBe(g.rows);
      expect(g.months).toBe(1);
    }
    expect(perGroup.reduce((n, g) => n + g.rows, 0)).toBe(await page.locator(rows).count());
  });

  test('RSS link and breadcrumb', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.locator('[data-rss-link]')).toHaveAttribute('href', '/rss.xml');
    const crumbs = page.locator('nav[aria-label="Breadcrumb"] a');
    await expect(crumbs.first()).toHaveAttribute('href', '/');
    await expect(crumbs.last()).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('writing index: topic filter', () => {
  test('chips show counts that match the rows', async ({ page }) => {
    await page.goto('/blog/');
    const total = await page.locator(rows).count();
    const chips = page.locator('[data-pillar-filters] [data-filter]');
    await expect(chips).toHaveCount(PILLARS.length + 1);
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-filter="all"] .n')).toHaveText(String(total));
    for (const p of PILLARS) {
      const n = await page.locator(`${rows}[data-pillar="${p}"]`).count();
      await expect(page.locator(`[data-filter="${p}"] .n`)).toHaveText(String(n));
    }
    await expect(page.locator('[data-result-count]')).toHaveText(new RegExp(`^${total}\\b`));
    await expect(page.locator('[data-result-count]')).toHaveAttribute('aria-live', 'polite');
  });

  test('picking a topic filters rows, updates counts, pressed state and the URL', async ({ page }) => {
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');
    const total = await page.locator(rows).count();

    for (const p of PILLARS) {
      const expected = await page.locator(`${rows}[data-pillar="${p}"]`).count();
      await page.locator(`[data-filter="${p}"]`).click();

      await expect(page.locator(visibleRows)).toHaveCount(expected);
      await expect(page.locator(`${visibleRows}:not([data-pillar="${p}"])`)).toHaveCount(0);
      await expect(page.locator('[data-filter][aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator(`[data-filter="${p}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(new RegExp(`[?&]topic=${p}$`));

      const summary = (await page.locator('[data-result-count]').innerText()).match(/\d+/g)!.map(Number);
      expect(summary).toEqual(expected === total ? [total] : [expected, total]);

      // Months with nothing to show are hidden; the rest report their own count.
      const groups = await page.locator('[data-month-group]').evaluateAll((gs) =>
        gs.map((g) => ({
          hidden: (g as HTMLElement).hidden,
          shown: g.querySelectorAll('[data-post-row]:not([hidden])').length,
          label: Number(g.querySelector('[data-group-count]')!.textContent!.match(/\d+/)![0]),
        })),
      );
      for (const g of groups) {
        expect(g.hidden).toBe(g.shown === 0);
        if (!g.hidden) expect(g.label).toBe(g.shown);
      }
    }

    await page.locator('[data-filter="all"]').click();
    await expect(page.locator(visibleRows)).toHaveCount(total);
    await expect(page).not.toHaveURL(/topic=/);
  });

  test('?topic= in the URL is applied on load', async ({ page }) => {
    await page.goto('/blog/?topic=ai');
    const expected = await page.locator(`${rows}[data-pillar="ai"]`).count();
    expect(expected).toBeGreaterThan(0);
    await expect(page.locator('[data-filter="ai"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(visibleRows)).toHaveCount(expected);
    await expect(page.locator(`${visibleRows}:not([data-pillar="ai"])`)).toHaveCount(0);
    await expect(page).toHaveURL(/[?&]topic=ai$/);
  });

  test('an unknown ?topic= falls back to all posts', async ({ page }) => {
    await page.goto('/blog/?topic=not-a-topic');
    const total = await page.locator(rows).count();
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(visibleRows)).toHaveCount(total);
  });
});

test.describe('writing index: title filter', () => {
  // A word taken from a real title, so the test follows the content.
  async function wordFromFirstTitle(page: import('@playwright/test').Page) {
    const title = (await page.locator(rows).first().getAttribute('data-title'))!;
    return title.split(/[^a-z0-9]+/).filter((w) => w.length >= 5)[0];
  }

  test('typing filters rows by title', async ({ page }) => {
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');
    const total = await page.locator(rows).count();
    const word = await wordFromFirstTitle(page);

    await page.locator('#blog-search-input').fill(word.toUpperCase());
    const shown = page.locator(visibleRows);
    const n = await shown.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(total);
    for (const t of await shown.evaluateAll((els) => els.map((e) => e.getAttribute('data-title')!))) {
      expect(t).toContain(word);
    }

    await page.locator('#blog-search-input').fill('');
    await expect(page.locator(visibleRows)).toHaveCount(total);
  });

  test('title filter combines with the topic filter', async ({ page }) => {
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');
    const first = page.locator(rows).first();
    const pillar = (await first.getAttribute('data-pillar'))!;
    const other = PILLARS.find((p) => p !== pillar)!;
    const word = await wordFromFirstTitle(page);

    await page.locator('#blog-search-input').fill(word);
    await page.locator(`[data-filter="${pillar}"]`).click();
    await expect(first).toBeVisible();

    await page.locator(`[data-filter="${other}"]`).click();
    await expect(first).toBeHidden();
  });

  test('"/" focuses the filter input', async ({ page }) => {
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');
    await page.keyboard.press('/');
    await expect(page.locator('#blog-search-input')).toBeFocused();
    await expect(page.locator('#blog-search-input')).toHaveValue('');
  });

  test('input has an accessible name', async ({ page }) => {
    await page.goto('/blog/');
    await expect(page.getByRole('searchbox')).toHaveAccessibleName(/.+/);
  });
});

test.describe('writing index: empty state', () => {
  test('no matches shows the empty state; Clear filters restores everything', async ({ page }) => {
    await page.goto('/blog/?topic=cloud');
    await page.waitForLoadState('networkidle');
    const total = await page.locator(rows).count();
    const empty = page.locator('[data-empty-state]');
    await expect(empty).toBeHidden();

    await page.locator('#blog-search-input').fill('zzznomatch');
    await expect(page.locator(visibleRows)).toHaveCount(0);
    await expect(empty).toBeVisible();
    await expect(page.locator('[data-month-group]:not([hidden])')).toHaveCount(0);
    expect((await page.locator('[data-result-count]').innerText()).match(/\d+/g)!.map(Number)).toEqual([0, total]);

    await empty.locator('[data-clear-filters]').click();
    await expect(empty).toBeHidden();
    await expect(page.locator(visibleRows)).toHaveCount(total);
    await expect(page.locator('#blog-search-input')).toHaveValue('');
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page).not.toHaveURL(/topic=/);
  });
});

test.describe('writing index: layout', () => {
  test('filter bar sticks under the header and the page never scrolls sideways', async ({ page }) => {
    await page.goto('/blog/');
    await page.evaluate(() => window.scrollTo(0, 1200));
    await expect
      .poll(() =>
        page.evaluate(() => {
          const header = document.querySelector('[data-site-header]')!.getBoundingClientRect();
          const bar = document.querySelector('[data-filter-bar]')!.getBoundingClientRect();
          return Math.abs(bar.top - header.bottom);
        }),
      )
      .toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });

  test('keyboard focus on a post link is visible', async ({ page }) => {
    await page.goto('/blog/');
    await page.waitForLoadState('networkidle');
    await page.locator('#blog-search-input').focus();
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('href', /^\/blog\//);
    const outline = await focused.evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), visible: el.matches(':focus-visible') };
    });
    expect(outline.visible).toBe(true);
    expect(outline.style).not.toBe('none');
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});

test.describe('writing index: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('all posts are listed and the filter bar is hidden', async ({ page }) => {
    await page.goto('/blog/?topic=ai');
    await expect(page.locator('[data-filter-bar]')).toBeHidden();
    const all = page.locator(rows);
    const n = await all.count();
    expect(n).toBeGreaterThan(0);
    await expect(page.locator(visibleRows)).toHaveCount(n);
    await expect(all.first().locator('a')).toBeVisible();
    await expect(page.locator('[data-empty-state]')).toBeHidden();
  });
});

test.describe('writing index: contrast', () => {
  test.use({ viewport: DESKTOP });

  for (const theme of THEMES) {
    test(`passes 4.5:1 in ${theme}, default and filtered`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/blog/');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const run = async () => {
        const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
        return results.violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
        );
      };
      expect(await run()).toEqual([]);
      await page.locator('[data-filter="ai"]').click();
      expect(await run()).toEqual([]);
    });
  }
});
