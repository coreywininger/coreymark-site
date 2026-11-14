import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TOPICS = ['ops', 'business', 'ai', 'cloud', 'personal', 'lab'];
const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const DESKTOP = { width: 1280, height: 900 };

// Minimal reader for the `sections` frontmatter in the Now entry: enough to
// know which items the homepage panel should show, without pinning any copy.
function nowData() {
  const src = readFileSync('src/content/now/current.mdx', 'utf8');
  const front = src.split(/^---$/m)[1];
  const updated = front.match(/^updatedDate:\s*(\S+)/m)![1];
  const byStatus: Record<string, string[]> = {};
  let status = '';
  for (const line of front.split('\n')) {
    const s = line.match(/^\s+status:\s*(\w+)/);
    if (s) status = s[1];
    const t = line.match(/^\s+- title:\s*(.+)$/);
    if (t) (byStatus[status] ??= []).push(t[1].replace(/^["']|["']$/g, ''));
  }
  return { updated, byStatus };
}

test.describe('home: hero', () => {
  test('one h1 and two calls to action', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-home-hero] h1')).toHaveCount(1);
    await expect(page.locator('[data-hero-cta="writing"]')).toHaveAttribute('href', '#writing');
    await expect(page.locator('[data-hero-cta="about"]')).toHaveAttribute('href', '/about/');
    await expect(page.locator('#writing')).toBeAttached();
  });

  test('status panel shows the Now data (two in progress, two running)', async ({ page }) => {
    const { updated, byStatus } = nowData();
    const expected = [
      ...(byStatus.progress ?? []).slice(0, 2).map((title) => ({ status: 'progress', title })),
      ...(byStatus.running ?? []).slice(0, 2).map((title) => ({ status: 'running', title })),
    ];
    expect(expected.length).toBeGreaterThan(0);

    await page.goto('/');
    const panel = page.locator('[data-now-panel]');
    const rows = panel.locator('[data-now-row]');
    await expect(rows).toHaveCount(expected.length);
    for (const [i, row] of expected.entries()) {
      await expect(rows.nth(i)).toHaveAttribute('data-now-row', row.status);
      await expect(rows.nth(i).locator('[data-status]')).toHaveAttribute('data-status', row.status);
      await expect(rows.nth(i).locator('.row-title')).toHaveText(row.title);
    }
    await expect(panel.locator('time')).toHaveAttribute('datetime', updated);
    await expect(panel.locator('a[href="/now/"]')).toHaveCount(1);
  });

  test('reduced motion shows everything in its final state', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const state = await page.evaluate(() => ({
      typed: document.querySelector<HTMLElement>('[data-home-hero] .typed')!.getBoundingClientRect().width,
      rises: [...document.querySelectorAll('[data-home-hero] .rise')].map((e) => getComputedStyle(e).opacity),
      animations: document.getAnimations().length,
    }));
    expect(state.typed).toBeGreaterThan(0);
    expect(state.rises.length).toBeGreaterThan(0);
    expect(state.rises.every((o) => o === '1')).toBe(true);
    expect(state.animations).toBe(0);
  });
});

test.describe('home: topic map', () => {
  test.use({ viewport: DESKTOP });

  test('six real buttons, one pressed, list region is a polite live region', async ({ page }) => {
    await page.goto('/');
    const nodes = page.locator('[data-topic-map] button[data-topic]');
    await expect(nodes).toHaveCount(TOPICS.length);
    for (const id of TOPICS) {
      await expect(page.locator(`button[data-topic="${id}"]`)).toBeVisible();
    }
    await expect(page.locator('button[data-topic][aria-pressed="true"]')).toHaveCount(1);
    await expect(page.locator('[data-topic-list]')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('[data-topic-panel]:not([hidden])')).toHaveCount(1);
  });

  test('selecting a topic updates aria-pressed, the rack, the wire and the list', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    for (const id of [...TOPICS].reverse()) {
      await page.locator(`button[data-topic="${id}"]`).click();

      await expect(page.locator(`button[data-topic="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('button[data-topic][aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator('[data-unit][data-on]')).toHaveCount(1);
      await expect(page.locator(`[data-unit="${id}"]`)).toHaveAttribute('data-on', '');
      await expect(page.locator('[data-wire][data-on]')).toHaveCount(1);
      await expect(page.locator(`[data-wire="${id}"]`)).toHaveAttribute('data-on', '');

      const visible = page.locator('[data-topic-panel]:not([hidden])');
      await expect(visible).toHaveCount(1);
      await expect(visible).toHaveAttribute('data-topic-panel', id);

      const links = visible.locator('ol a');
      const n = await links.count();
      expect(n).toBeGreaterThan(0);
      expect(n).toBeLessThanOrEqual(5);
      const prefix = id === 'lab' ? '/lab/' : '/blog/';
      for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))) {
        expect(href!.startsWith(prefix)).toBe(true);
      }
    }
  });

  test('node count matches the list, with an "all" link when capped', async ({ page }) => {
    await page.goto('/');
    for (const id of TOPICS) {
      const count = Number(await page.locator(`button[data-topic="${id}"] .n`).innerText());
      const panel = page.locator(`[data-topic-panel="${id}"]`);
      const listed = await panel.locator('ol li').count();
      expect(listed).toBe(Math.min(count, 5));
      const all = panel.locator('[data-topic-all]');
      await expect(all).toHaveCount(count > 5 ? 1 : 0);
      if (count > 5) {
        await expect(all).toHaveAttribute('href', id === 'lab' ? '/lab/' : `/blog/?topic=${id}`);
      }
    }
  });

  test('list sits beside the map on desktop', async ({ page }) => {
    await page.goto('/');
    const map = (await page.locator('[data-topic-map] .map').boundingBox())!;
    const list = (await page.locator('[data-topic-list]').boundingBox())!;
    expect(list.x).toBeGreaterThan(map.x + map.width - 1);
  });
});

test.describe('home: topic map on a phone', () => {
  test('nodes stay inside the map, do not overlap, and the list stacks below', async ({ page }) => {
    await page.goto('/');
    const facts = await page.evaluate(() => {
      const map = document.querySelector('[data-topic-map] .map')!.getBoundingClientRect();
      const rack = document.querySelector('[data-topic-map] .rack')!.getBoundingClientRect();
      const nodes = [...document.querySelectorAll('button[data-topic]')].map((n) => n.getBoundingClientRect());
      const hit = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      let clashes = 0;
      nodes.forEach((a, i) => {
        if (hit(a, rack)) clashes++;
        nodes.slice(i + 1).forEach((b) => { if (hit(a, b)) clashes++; });
      });
      return {
        outside: nodes.filter((r) => r.left < map.left || r.right > map.right || r.top < map.top || r.bottom > map.bottom).length,
        clashes,
        minHeight: Math.min(...nodes.map((r) => r.height)),
        hubOffset: Math.abs(rack.left + rack.width / 2 - (map.left + map.width / 2)),
        listBelow: document.querySelector('[data-topic-list]')!.getBoundingClientRect().top >= map.bottom,
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    expect(facts.outside).toBe(0);
    expect(facts.clashes).toBe(0);
    expect(facts.minHeight).toBeGreaterThanOrEqual(44);
    expect(facts.hubOffset).toBeLessThan(1);
    expect(facts.listBelow).toBe(true);
    expect(facts.hScroll).toBe(false);
  });
});

test.describe('home: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('map is replaced by a plain list of topic links', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-topic-map]')).toBeHidden();
    const fallback = page.locator('[data-topic-fallback]');
    await expect(fallback).toBeVisible();
    await expect(fallback.locator('a')).toHaveCount(TOPICS.length);
    for (const id of TOPICS) {
      const href = id === 'lab' ? '/lab/' : `/blog/?topic=${id}`;
      await expect(fallback.locator(`a[href="${href}"]`)).toBeVisible();
    }
  });

  test('hero content and status panel are still present', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-home-hero] h1')).toBeVisible();
    await expect(page.locator('[data-now-panel] [data-now-row]').first()).toBeVisible();
  });
});

test.describe('home: lab section', () => {
  test('subnet widget calculates as you type', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const widget = page.locator('[data-home-subnet]');
    const input = widget.locator('[data-cidr-input]');
    const out = (key: string) => widget.locator(`[data-out="${key}"]`);

    await expect(widget.locator('[data-cidr-result]')).toBeVisible();
    await expect(widget.locator('[data-cidr-error]')).toBeHidden();

    await input.fill('192.168.1.77/24');
    await expect(out('network')).toHaveText('192.168.1.0/24');
    await expect(out('broadcast')).toHaveText('192.168.1.255');
    await expect(out('mask')).toHaveText('255.255.255.0');
    await expect(out('hosts')).toHaveText('254');
    await expect(input).toHaveAttribute('aria-invalid', 'false');
  });

  test('subnet widget shows an error for an invalid block and recovers', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const widget = page.locator('[data-home-subnet]');
    const input = widget.locator('[data-cidr-input]');
    const error = widget.locator('[data-cidr-error]');

    for (const bad of ['10.0.0.0/40', '300.1.1.1/24', 'nope', '10.0.0.0']) {
      await input.fill(bad);
      await expect(error).toBeVisible();
      await expect(error).toHaveAttribute('role', 'alert');
      await expect(widget.locator('[data-cidr-result]')).toBeHidden();
      await expect(input).toHaveAttribute('aria-invalid', 'true');
    }
    await expect(input).toHaveAttribute('aria-describedby', (await error.getAttribute('id'))!);

    await input.fill('10.0.0.0/30');
    await expect(error).toBeHidden();
    await expect(widget.locator('[data-out="hosts"]')).toHaveText('2');
  });

  test('subnet widget accepts IPv6', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const widget = page.locator('[data-home-subnet]');
    await widget.locator('[data-cidr-input]').fill('2001:db8::1/48');
    await expect(widget.locator('[data-cidr-error]')).toBeHidden();
    await expect(widget.locator('[data-out="network"]')).toHaveText('2001:db8::/48');
    await expect(widget.locator('[data-out="mask"]')).toHaveText('/48');
  });

  test('eight tool tiles link to their tools and carry a discipline', async ({ page }) => {
    await page.goto('/');
    const tiles = page.locator('[data-lab-tile]');
    await expect(tiles).toHaveCount(8);
    const facts = await tiles.evaluateAll((els) =>
      els.map((e) => ({
        slug: e.getAttribute('data-lab-tile'),
        href: e.getAttribute('href'),
        discipline: e.getAttribute('data-discipline'),
      })),
    );
    for (const t of facts) {
      expect(t.href).toBe(`/lab/${t.slug}/`);
      expect(['networking', 'systems', 'security', 'devops', 'cloud']).toContain(t.discipline);
    }
    expect(facts.map((t) => t.slug)).not.toContain('subnet');
    await expect(page.locator('[data-all-tools]')).toHaveAttribute('href', '/lab/');
  });
});

test.describe('home: things I run', () => {
  const projectIds = readdirSync('src/content/projects')
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => f.replace(/\.mdx?$/, ''));

  test('phone: one card per project, no table, no sideways scroll', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-project-cards]')).toBeVisible();
    await expect(page.locator('[data-project-table]')).toBeHidden();
    await expect(page.locator('[data-project-card]')).toHaveCount(projectIds.length);
    for (const id of projectIds) {
      const card = page.locator(`[data-project-card="${id}"]`);
      await expect(card.locator(`a[href="/projects/${id}/"]`)).toBeVisible();
      await expect(card.locator('[data-status]')).toBeVisible();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP });

    test('table with one row per project, no cards', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('[data-project-table]')).toBeVisible();
      await expect(page.locator('[data-project-cards]')).toBeHidden();
      await expect(page.locator('[data-project-row]')).toHaveCount(projectIds.length);
      await expect(page.locator('[data-project-table] thead th[scope="col"]')).toHaveCount(4);
      for (const id of projectIds) {
        const row = page.locator(`[data-project-row="${id}"]`);
        await expect(row.locator(`th[scope="row"] a[href="/projects/${id}/"]`)).toBeVisible();
        await expect(row.locator('[data-status]')).toBeVisible();
      }
    });
  });
});

test.describe('home: contrast', () => {
  test.use({ viewport: DESKTOP });

  for (const theme of THEMES) {
    test(`homepage passes 4.5:1 in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

      const results = await new AxeBuilder({ page }).withRules(['color-contrast']).analyze();
      const failures = results.violations.flatMap((v) =>
        v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
      );
      expect(failures).toEqual([]);
    });
  }
});

test.describe('home: metadata', () => {
  test('WebSite JSON-LD is present', async ({ page }) => {
    await page.goto('/');
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw!);
    expect(data['@type']).toBe('WebSite');
    expect(data.url).toBe('https://coreymark.com');
  });
});
