import { readFileSync, readdirSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const DESKTOP = { width: 1280, height: 900 };

// Minimal reader for the Now entry's frontmatter (no copy pinned in tests).
function nowData() {
  const front = readFileSync('src/content/now/current.mdx', 'utf8').split(/^---$/m)[1];
  const updated = front.match(/^updatedDate:\s*(\S+)/m)![1];
  const sections: { status: string; titles: string[] }[] = [];
  for (const line of front.split('\n')) {
    const s = line.match(/^\s+status:\s*(\w+)/);
    if (s) sections.push({ status: s[1], titles: [] });
    const t = line.match(/^\s+- title:\s*(.+)$/);
    if (t) sections[sections.length - 1].titles.push(t[1].replace(/^["']|["']$/g, ''));
  }
  return { updated, sections };
}

const projectFiles = readdirSync('src/content/projects').filter((f) => /\.mdx?$/.test(f));
const projects = projectFiles.map((f) => {
  const src = readFileSync(`src/content/projects/${f}`, 'utf8');
  const front = src.split(/^---$/m)[1];
  return {
    id: f.replace(/\.mdx?$/, ''),
    hasSteps: /^steps:/m.test(front),
    hasWhy: /^why:/m.test(front),
    hasRepo: /^\s+repo:/m.test(front),
    hasLive: /^\s+live:/m.test(front),
    hasWriteup: /^\s+writeup:/m.test(front),
    hasReadout: /^readout:/m.test(front),
    live: /^status:\s*live/m.test(front),
  };
});

const crumbHrefs = (page: import('@playwright/test').Page) =>
  page.locator('main nav[aria-label="Breadcrumb"] a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));

test.describe('about', () => {
  test('hero: headshot, one h1, breadcrumb and contact button', async ({ page }) => {
    await page.goto('/about/');
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await crumbHrefs(page)).toEqual(['/', '/about/']);
    const img = page.locator('[data-about-hero] img[data-headshot]');
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute('alt', /.+/);
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.locator('[data-about-cta="contact"]')).toHaveAttribute('href', '/contact/');
    await expect(page.locator('[data-about-hero] a[href*="linkedin.com/in/"]')).toHaveCount(1);
    await expect(page.locator('[data-about-hero] a[href^="https://github.com/"]')).toHaveCount(1);
  });

  test('sections: career with one current role, stats, stack groups, off the clock', async ({ page }) => {
    await page.goto('/about/');
    const roles = page.locator('[data-about-career] [data-role]');
    expect(await roles.count()).toBeGreaterThanOrEqual(3);
    await expect(page.locator('[data-about-career] [data-role][data-current]')).toHaveCount(1);
    await expect(roles.first()).toHaveAttribute('data-current', '');
    await expect(page.locator('[data-about-how] [data-stat]')).toHaveCount(4);
    expect(await page.locator('[data-about-stack] [data-stack-group]').count()).toBeGreaterThanOrEqual(3);
    for (const g of await page.locator('[data-stack-group]').all()) {
      expect(await g.locator('li').count()).toBeGreaterThan(0);
    }
    await expect(page.locator('[data-about-off] p')).toHaveCount(1);
    for (const id of ['career-h', 'how-h', 'stack-h', 'off-h']) {
      await expect(page.locator(`section[aria-labelledby="${id}"] #${id}`)).toHaveCount(1);
    }
  });

  test('Person JSON-LD has the current job title', async ({ page }) => {
    await page.goto('/about/');
    const data = JSON.parse((await page.locator('script[type="application/ld+json"]').first().textContent())!);
    expect(data['@type']).toBe('Person');
    expect(data.jobTitle).toBe('Director of Operations');
    expect(JSON.stringify(data)).not.toMatch(/between roles/i);
  });

  test('the headshot appears only on the about page', async ({ page }) => {
    for (const route of ['/', '/now/', '/contact/', '/blog/it-depends-is-where-it-loses-the-business/']) {
      await page.goto(route);
      await expect(page.locator('img[data-headshot], img[src*="headshot"]')).toHaveCount(0);
    }
  });
});

test.describe('now', () => {
  test('renders every section and item from the structured data', async ({ page }) => {
    const { sections } = nowData();
    expect(sections.length).toBeGreaterThan(0);
    await page.goto('/now/');
    const blocks = page.locator('[data-now-sections] [data-now-section]');
    await expect(blocks).toHaveCount(sections.length);
    for (const [i, s] of sections.entries()) {
      const block = blocks.nth(i);
      await expect(block).toHaveAttribute('data-now-section', s.status);
      const items = block.locator('[data-now-item]');
      await expect(items).toHaveCount(s.titles.length);
      for (const [j, title] of s.titles.entries()) {
        await expect(items.nth(j).locator('.t')).toHaveText(title);
      }
      // Each card is a labelled region.
      const labelId = (await block.getAttribute('aria-labelledby'))!;
      await expect(block.locator(`#${labelId}`)).toHaveCount(1);
    }
  });

  test('"last updated" comes from updatedDate', async ({ page }) => {
    const { updated } = nowData();
    await page.goto('/now/');
    await expect(page.locator('[data-now-updated]')).toHaveAttribute('datetime', updated);
    expect(await crumbHrefs(page)).toEqual(['/', '/now/']);
    await expect(page.locator('main h1')).toHaveCount(1);
  });

  test('homepage status panel and /now/ agree', async ({ page }) => {
    await page.goto('/now/');
    const onNow = await page.locator('[data-now-item] .t').allTextContents();
    await page.goto('/');
    for (const t of await page.locator('[data-now-panel] .row-title').allTextContents()) {
      expect(onNow).toContain(t);
    }
  });
});

test.describe('projects index', () => {
  test('one card per project with details link, status and optional write-up', async ({ page }) => {
    await page.goto('/projects/');
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await crumbHrefs(page)).toEqual(['/', '/projects/']);
    await expect(page.locator('[data-project-list] [data-project]')).toHaveCount(projects.length);
    for (const p of projects) {
      const card = page.locator(`[data-project="${p.id}"]`);
      await expect(card.locator('h2 a')).toHaveAttribute('href', `/projects/${p.id}/`);
      await expect(card.locator('[data-project-details]')).toHaveAttribute('href', `/projects/${p.id}/`);
      await expect(card.locator('[data-status]')).toHaveAttribute('data-status', p.live ? 'running' : 'progress');
      await expect(card.locator('[data-project-writeup]')).toHaveCount(p.hasWriteup ? 1 : 0);
      const readout = card.locator('.readout');
      await expect(readout).toHaveCount(p.hasReadout ? 1 : 0);
      if (p.hasReadout) await expect(readout).toHaveAttribute('aria-hidden', 'true');
    }
    // The old "coming soon" placeholder is gone.
    await expect(page.locator('[data-empty-state]')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});

test.describe('project detail', () => {
  for (const p of projects) {
    test(`${p.id}: hero, facts and optional sections follow the frontmatter`, async ({ page }) => {
      await page.goto(`/projects/${p.id}/`);
      await expect(page.locator(`[data-project-page="${p.id}"]`)).toHaveCount(1);
      await expect(page.locator('main h1')).toHaveCount(1);
      expect(await crumbHrefs(page)).toEqual(['/', '/projects/', `/projects/${p.id}/`]);
      await expect(page.locator('[data-page-hero] [data-status]')).toHaveAttribute('data-status', p.live ? 'running' : 'progress');

      const repo = page.locator('[data-project-repo]');
      await expect(repo).toHaveCount(p.hasRepo ? 1 : 0);
      if (p.hasRepo) await expect(repo).toHaveAttribute('href', /^https:\/\/github\.com\//);
      await expect(page.locator('[data-project-live]')).toHaveCount(p.hasLive ? 1 : 0);

      // At a glance: a definition list with at least two facts.
      const facts = page.locator('[data-project-facts] dl > div');
      expect(await facts.count()).toBeGreaterThanOrEqual(2);
      for (const f of await facts.all()) {
        await expect(f.locator('dt')).not.toHaveText('');
        await expect(f.locator('dd')).not.toHaveText('');
      }

      await expect(page.locator('[data-project-steps]')).toHaveCount(p.hasSteps ? 1 : 0);
      if (p.hasSteps) expect(await page.locator('[data-project-steps] ol > li').count()).toBeGreaterThan(1);
      await expect(page.locator('[data-project-why]')).toHaveCount(p.hasWhy ? 1 : 0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });
  }

  test('write-ups are newest first, link to posts, and never repeat', async ({ page }) => {
    await page.goto('/projects/dailybriefing/');
    const links = page.locator('[data-project-writeups] [data-writeup-link]');
    expect(await links.count()).toBeGreaterThanOrEqual(2);
    const facts = await links.evaluateAll((els) =>
      els.map((e) => ({ href: e.getAttribute('href')!, date: e.querySelector('time')!.getAttribute('datetime')! })),
    );
    for (const f of facts) expect(f.href).toMatch(/^\/blog\/[^/]+\/$/);
    expect(new Set(facts.map((f) => f.href)).size).toBe(facts.length);
    const dates = facts.map((f) => f.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  test('build notes no longer carry a separate "Why" heading next to "Why I built it"', async ({ page }) => {
    await page.goto('/projects/dailybriefing/');
    await expect(page.locator('[data-project-why]')).toHaveCount(1);
    await expect(page.locator('[data-project-notes] #why')).toHaveCount(0);
  });
});

test.describe('contact', () => {
  test('three cards: email, LinkedIn, GitHub; RSS line; no form', async ({ page }) => {
    await page.goto('/contact/');
    await expect(page.locator('main h1')).toHaveCount(1);
    expect(await crumbHrefs(page)).toEqual(['/', '/contact/']);
    const ways = page.locator('[data-contact-ways] [data-contact]');
    expect(await ways.evaluateAll((els) => els.map((e) => e.getAttribute('data-contact')))).toEqual(['email', 'linkedin', 'github']);
    await expect(page.locator('[data-contact="email"] [data-contact-cta]')).toHaveAttribute('href', /^mailto:.+@.+/);
    await expect(page.locator('[data-contact="linkedin"] [data-contact-cta]')).toHaveAttribute('href', /linkedin\.com\/in\//);
    await expect(page.locator('[data-contact="github"] [data-contact-cta]')).toHaveAttribute('href', /^https:\/\/github\.com\//);
    await expect(page.locator('main [data-rss-link]')).toHaveAttribute('href', '/rss.xml');
    await expect(page.locator('main form, main input')).toHaveCount(0);
    // Only the email card can be copied.
    await expect(page.locator('[data-copy-value]')).toHaveCount(1);
  });

  test('Copy address copies the email and shows a temporary copied state', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/contact/');
    await page.waitForLoadState('networkidle');
    const btn = page.locator('[data-contact="email"] [data-copy-value]');
    const label = btn.locator('[data-copy-label]');
    const value = (await btn.getAttribute('data-copy-value'))!;
    const idle = (await label.getAttribute('data-idle'))!;
    const done = (await label.getAttribute('data-done'))!;
    const mailto = (await page.locator('[data-contact="email"] [data-contact-cta]').getAttribute('href'))!;
    expect(mailto).toBe(`mailto:${value}`);
    await expect(label).toHaveText(idle);

    await btn.click();
    await expect(btn).toHaveAttribute('data-state', 'copied');
    await expect(label).toHaveText(done);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(value);

    await expect(btn).not.toHaveAttribute('data-state', 'copied', { timeout: 4000 });
    await expect(label).toHaveText(idle);
  });
});

test.describe('404', () => {
  const MISSING = '/definitely-not-a-page-123/';

  test('unknown URL gets the 404 page with a 404 status and noindex', async ({ page }) => {
    const res = await page.goto(MISSING);
    expect(res!.status()).toBe(404);
    await expect(page.locator('[data-not-found]')).toBeVisible();
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('main')).not.toHaveAttribute('data-pagefind-body');
  });

  test('terminal shows the path that was requested', async ({ page }) => {
    await page.goto(MISSING);
    const spots = page.locator('[data-missing-path]');
    await expect(spots).toHaveCount(2);
    for (const el of await spots.all()) await expect(el).toHaveText(MISSING);
  });

  test('section links, home link and a search button that opens the overlay', async ({ page }) => {
    await page.goto(MISSING);
    await page.waitForLoadState('networkidle');
    const links = page.locator('[data-not-found-links] a');
    expect(await links.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual([
      '/blog/', '/lab/', '/projects/', '/now/', '/about/', '/contact/',
    ]);
    for (const h of await links.evaluateAll((as) => as.map((a) => a.getBoundingClientRect().height))) {
      expect(h).toBeGreaterThanOrEqual(44);
    }
    await expect(page.locator('[data-not-found-home]')).toHaveAttribute('href', '/');
    await page.locator('[data-open-search]').click();
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await expect(page.locator('[data-search-input]')).toBeFocused();
  });

  test('the static config still rewrites 404s to /404.html', () => {
    const config = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8'));
    expect(config.responseOverrides['404']).toEqual({ rewrite: '/404.html', statusCode: 404 });
    expect(config.mimeTypes['.pagefind']).toBeTruthy();
    expect(config.globalHeaders['Content-Security-Policy']).toContain("'wasm-unsafe-eval'");
  });
});

test.describe('privacy', () => {
  test('no page outside /about/ names the employer; none names Stratum', async ({ page }) => {
    const routes = ['/', '/now/', '/projects/', '/projects/dailybriefing/', '/contact/', '/blog/', '/lab/', '/lab/jwt/'];
    for (const route of routes) {
      await page.goto(route);
      const html = await page.content();
      expect(html, route).not.toMatch(/gridsecurity/i);
      expect(html, route).not.toMatch(/stratum/i);
    }
    await page.goto('/about/');
    expect(await page.content()).not.toMatch(/stratum/i);
  });
});

test.describe('pages: contrast', () => {
  test.use({ viewport: DESKTOP });

  for (const theme of THEMES) {
    test(`about, now, projects, contact, 404 and search pass 4.5:1 in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const failures = async (include?: string) => {
        const builder = new AxeBuilder({ page }).withRules(['color-contrast']);
        if (include) builder.include(include);
        return (await builder.analyze()).violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
        );
      };

      for (const route of ['/about/', '/now/', '/projects/', '/projects/dailybriefing/', '/contact/', '/not-here/']) {
        await page.goto(route);
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
        expect(await failures(), route).toEqual([]);
      }

      await page.goto('/now/');
      await page.waitForLoadState('networkidle');
      await page.keyboard.press('Control+k');
      expect(await failures('#search-overlay'), 'search quick links').toEqual([]);
      await page.locator('[data-search-input]').fill('cron');
      await expect(page.locator('[data-search-results] [data-search-item][data-kind]').first()).toBeVisible({ timeout: 8000 });
      await page.keyboard.press('ArrowDown');
      expect(await failures('#search-overlay'), 'search results').toEqual([]);
    });
  }
});
