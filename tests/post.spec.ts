import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const DESKTOP = { width: 1280, height: 900 };
const SHORT = '/blog/it-depends-is-where-it-loses-the-business/';
const CODE = '/blog/claude-plus-github-actions-integration-playbook/';
const MANY_BLOCKS = '/blog/shipping-a-site-with-ai-field-report/';

test.describe('post: hero', () => {
  test('breadcrumb parts are links with tooltips; last is the pillar', async ({ page }) => {
    await page.goto(SHORT);
    const pillar = (await page.locator('[data-post]').getAttribute('data-pillar'))!;
    const crumbs = page.locator('[data-post] nav[aria-label="Breadcrumb"] a');
    await expect(crumbs).toHaveCount(3);
    const facts = await crumbs.evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute('href'), title: a.getAttribute('title'), current: a.getAttribute('aria-current') })),
    );
    expect(facts.map((f) => f.href)).toEqual(['/', '/blog/', `/blog/?topic=${pillar}`]);
    for (const f of facts) expect(f.title).toBeTruthy();
    expect(facts.map((f) => f.current)).toEqual([null, null, 'page']);
  });

  test('topic chip, byline, date and one h1', async ({ page }) => {
    await page.goto(SHORT);
    const post = page.locator('[data-post]');
    const pillar = (await post.getAttribute('data-pillar'))!;
    await expect(post.locator('h1')).toHaveCount(1);
    await expect(post.locator('header [data-topic-chip]')).toHaveAttribute('href', `/blog/?topic=${pillar}`);
    await expect(post.locator('[data-byline]')).toHaveAttribute('href', '/about/');
    await expect(post.locator('[data-pub-date]')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}$/);
    await expect(page.locator('[data-reading-progress]')).toHaveCount(1);
  });

  test('BlogPosting JSON-LD', async ({ page }) => {
    await page.goto(SHORT);
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(data['@type']).toBe('BlogPosting');
    expect(data.url).toBe(`https://coreymark.com${SHORT}`);
    expect(data.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

test.describe('post: body', () => {
  test('h2s carry a "##" marker and the column is at most 700px', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(SHORT);
    const h2 = page.locator('.post-prose h2').first();
    await expect(h2).toBeVisible();
    expect(await h2.evaluate((el) => getComputedStyle(el, '::before').content)).toContain('##');
    const width = await page.locator('[data-post] .article').evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeLessThanOrEqual(700);
  });

  test('phone: no sideways scroll on a code-heavy post, code blocks stay in the column', async ({ page }) => {
    await page.goto(CODE);
    const facts = await page.evaluate(() => {
      const article = document.querySelector('[data-post] .article')!.getBoundingClientRect();
      return {
        hScroll: document.documentElement.scrollWidth > window.innerWidth,
        preOut: [...document.querySelectorAll('.post-prose pre')].filter((p) => p.getBoundingClientRect().right > article.right + 1).length,
      };
    });
    expect(facts.hScroll).toBe(false);
    expect(facts.preOut).toBe(0);
  });

  test('previous/next links, comments and newsletter are gone', async ({ page }) => {
    await page.goto(SHORT);
    await expect(page.locator('nav[aria-label="Adjacent posts"]')).toHaveCount(0);
    await expect(page.locator('#giscus-container, form[action*="buttondown"]')).toHaveCount(0);
  });
});

test.describe('post: on this page', () => {
  test.use({ viewport: DESKTOP });

  test('lists the headings and marks the one in view with aria-current', async ({ page }) => {
    await page.goto(CODE);
    await page.waitForLoadState('networkidle');
    const links = page.locator('[data-toc] [data-toc-link]');
    const n = await links.count();
    expect(n).toBeGreaterThan(2);
    expect(n).toBe(await page.locator('.post-prose h2, .post-prose h3').count());

    const targets = await links.evaluateAll((as) => as.map((a) => a.getAttribute('data-target')!));
    for (const [i, id] of targets.entries()) {
      await expect(links.nth(i)).toHaveAttribute('href', `#${id}`);
    }

    // At the top of the page the first item is current.
    await expect(page.locator('[data-toc-link][aria-current]')).toHaveCount(1);
    await expect(links.first()).toHaveAttribute('aria-current', 'location');

    for (const i of [2, n - 1, 1]) {
      await page.evaluate((id) => {
        const el = document.getElementById(id)!;
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: 'instant' as ScrollBehavior });
      }, targets[i]);
      await expect(links.nth(i)).toHaveAttribute('aria-current', 'location');
      await expect(page.locator('[data-toc-link][aria-current]')).toHaveCount(1);
    }
  });

  test('clicking an item scrolls its heading below the sticky header', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(CODE);
    await page.waitForLoadState('networkidle');
    const link = page.locator('[data-toc-link]').nth(2);
    const id = (await link.getAttribute('data-target'))!;
    await link.click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect
      .poll(() =>
        page.evaluate((hid) => {
          const header = document.querySelector('[data-site-header]')!.getBoundingClientRect();
          return document.getElementById(hid)!.getBoundingClientRect().top - header.bottom;
        }, id),
      )
      .toBeGreaterThanOrEqual(0);
  });

  test('tags are plain labels under the list', async ({ page }) => {
    await page.goto(CODE);
    const tags = page.locator('[data-post-tags] li');
    expect(await tags.count()).toBeGreaterThan(0);
    await expect(page.locator('[data-post-tags] a')).toHaveCount(0);
  });
});

test.describe('post: on this page (phone)', () => {
  test('the list is hidden and tags are still shown', async ({ page }) => {
    await page.goto(CODE);
    await expect(page.locator('[data-toc]')).toBeHidden();
    await expect(page.locator('[data-post-tags]')).toBeVisible();
  });
});

test.describe('post: share box', () => {
  test('copy link copies the canonical URL and shows a temporary copied state', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto(SHORT);
    await page.waitForLoadState('networkidle');

    const btn = page.locator('[data-share-box] [data-copy-url]');
    const label = btn.locator('[data-copy-label]');
    const idle = (await label.getAttribute('data-idle'))!;
    const done = (await label.getAttribute('data-done'))!;
    expect(done).not.toBe(idle);
    await expect(label).toHaveText(idle);
    await expect(btn).toHaveAttribute('data-copy-url', `https://coreymark.com${SHORT}`);

    await btn.click();
    await expect(btn).toHaveAttribute('data-state', 'copied');
    await expect(label).toHaveText(done);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`https://coreymark.com${SHORT}`);

    await expect(btn).not.toHaveAttribute('data-state', 'copied', { timeout: 4000 });
    await expect(label).toHaveText(idle);
  });

  test('LinkedIn share link carries the post URL; no X link', async ({ page }) => {
    await page.goto(SHORT);
    const li = page.locator('[data-share-box] [data-share="linkedin"]');
    await expect(li).toHaveAttribute('href', new RegExp(encodeURIComponent(`https://coreymark.com${SHORT}`).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(li).toHaveAttribute('rel', /noopener/);
    await expect(page.locator('[data-post] a[href*="twitter.com"], [data-post] a[href*="x.com/intent"]')).toHaveCount(0);
  });
});

test.describe('post: keep reading', () => {
  test('two cards: same pillar first (newest first), then newest from elsewhere', async ({ page }) => {
    // The Writing index lists every post newest first; use it as the source.
    await page.goto('/blog/');
    const all = await page.locator('[data-post-list] [data-post-row]').evaluateAll((els) =>
      els.map((e) => ({
        pillar: e.getAttribute('data-pillar')!,
        slug: e.querySelector('a')!.getAttribute('href')!.replace(/^\/blog\/|\/$/g, ''),
      })),
    );
    expect(all.length).toBeGreaterThan(2);

    // One post per pillar covers "plenty in the pillar" and "alone in it".
    const samples = [...new Map(all.map((p) => [p.pillar, p])).values()];
    for (const post of samples) {
      const others = all.filter((p) => p.slug !== post.slug);
      const expected = [
        ...others.filter((p) => p.pillar === post.pillar),
        ...others.filter((p) => p.pillar !== post.pillar),
      ].slice(0, 2);

      await page.goto(`/blog/${post.slug}/`);
      const cards = page.locator('[data-keep-reading] [data-related]');
      await expect(cards).toHaveCount(2);
      const got = await cards.evaluateAll((els) =>
        els.map((e) => ({ slug: e.getAttribute('data-related'), pillar: e.getAttribute('data-pillar'), href: e.getAttribute('href') })),
      );
      expect(got.map((g) => g.slug)).toEqual(expected.map((e) => e.slug));
      expect(got.map((g) => g.pillar)).toEqual(expected.map((e) => e.pillar));
      for (const g of got) expect(g.href).toBe(`/blog/${g.slug}/`);
    }
  });
});

test.describe('post: contrast', () => {
  test.use({ viewport: DESKTOP });

  for (const theme of THEMES) {
    test(`code blocks and the whole post pass 4.5:1 in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(MANY_BLOCKS);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await page.locator('pre.astro-code').count()).toBeGreaterThan(3);
      // Scroll so a middle TOC item is the active one.
      await page.evaluate(() => window.scrollTo(0, 2000));
      await expect(page.locator('[data-toc-link][aria-current]')).toHaveCount(1);

      const failures = async (builder: AxeBuilder) =>
        (await builder.analyze()).violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
        );
      expect(await failures(new AxeBuilder({ page }).withRules(['color-contrast']).include('pre.astro-code'))).toEqual([]);
      expect(await failures(new AxeBuilder({ page }).withRules(['color-contrast']))).toEqual([]);
    });
  }
});
