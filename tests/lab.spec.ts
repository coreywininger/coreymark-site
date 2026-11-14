import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];
const DISCIPLINES = ['networking', 'systems', 'security', 'devops', 'cloud'];
const DESKTOP = { width: 1280, height: 900 };

// The IP tool calls ip.coreymark.com on load. Tests never hit the network:
// they get a fixed response with a documentation-range address (RFC 5737)
// and generic location data.
const IP_FIXTURE = {
  ip: '203.0.113.42',
  ip_decimal: 3405803818,
  country: 'US',
  country_name: 'United States',
  is_eu: false,
  region: 'Indiana',
  region_code: 'IN',
  city: 'Indianapolis',
  postal: '46204',
  metro_code: 527,
  latitude: 39.77,
  longitude: -86.16,
  time_zone: 'America/Indiana/Indianapolis',
  asn: 64496,
  asn_org: 'Example Net',
  colo: 'IND',
  user_agent: 'Mozilla/5.0 (test)',
};
const mockIp = (page: Page) =>
  page.route('https://ip.coreymark.com/**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(IP_FIXTURE),
    }),
  );

const cards = '[data-lab-list] [data-lab-tool]';
const visibleCards = `${cards}:not([hidden])`;

async function toolSlugs(page: Page) {
  await page.goto('/lab/');
  return page.locator(cards).evaluateAll((els) => els.map((e) => e.getAttribute('data-lab-tool')!));
}

test.describe('lab index', () => {
  test('cards link to their tools and carry a discipline, path strip and sample', async ({ page }) => {
    await page.goto('/lab/');
    const n = await page.locator(cards).count();
    expect(n).toBeGreaterThan(0);
    const facts = await page.locator(cards).evaluateAll((els) =>
      els.map((e) => ({
        slug: e.getAttribute('data-lab-tool')!,
        discipline: e.getAttribute('data-discipline')!,
        links: e.querySelectorAll('a').length,
        href: e.querySelector('a')!.getAttribute('href'),
        cmd: e.querySelector('.cmd')?.textContent,
        sample: !!e.querySelector('.sample'),
      })),
    );
    for (const f of facts) {
      expect(DISCIPLINES).toContain(f.discipline);
      expect(f.links).toBe(1);
      expect(f.href).toBe(`/lab/${f.slug}/`);
      expect(f.cmd).toContain(f.slug);
      expect(f.sample).toBe(true);
    }
    expect(new Set(facts.map((f) => f.slug)).size).toBe(n);
    await expect(page.locator('[data-page-hero] [data-privacy-badge]')).toHaveAttribute('data-privacy-badge', 'local');
    await expect(page.locator('main h1')).toHaveCount(1);
  });

  test('chips show counts that match the cards', async ({ page }) => {
    await page.goto('/lab/');
    const total = await page.locator(cards).count();
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-filter="all"] .n')).toHaveText(String(total));
    const areas = await page
      .locator('[data-discipline-filters] [data-filter]:not([data-filter="all"])')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-filter')!));
    expect(areas.length).toBeGreaterThan(1);
    let sum = 0;
    for (const a of areas) {
      const n = await page.locator(`${cards}[data-discipline="${a}"]`).count();
      expect(n).toBeGreaterThan(0);
      await expect(page.locator(`[data-filter="${a}"] .n`)).toHaveText(String(n));
      sum += n;
    }
    expect(sum).toBe(total);
  });

  test('picking an area filters the cards and sets ?area=', async ({ page }) => {
    await page.goto('/lab/');
    await page.waitForLoadState('networkidle');
    const total = await page.locator(cards).count();
    const areas = await page
      .locator('[data-discipline-filters] [data-filter]:not([data-filter="all"])')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-filter')!));

    for (const a of areas) {
      const expected = await page.locator(`${cards}[data-discipline="${a}"]`).count();
      await page.locator(`[data-filter="${a}"]`).click();
      await expect(page.locator(visibleCards)).toHaveCount(expected);
      await expect(page.locator(`${visibleCards}:not([data-discipline="${a}"])`)).toHaveCount(0);
      await expect(page.locator('[data-filter][aria-pressed="true"]')).toHaveCount(1);
      await expect(page.locator(`[data-filter="${a}"]`)).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(new RegExp(`[?&]area=${a}$`));
      await expect(page.locator('[data-result-count]')).toHaveText(new RegExp(`^${expected}\\b`));
    }

    await page.locator('[data-filter="all"]').click();
    await expect(page.locator(visibleCards)).toHaveCount(total);
    await expect(page).not.toHaveURL(/area=/);
  });

  test('?area= is applied on load; an unknown area shows everything', async ({ page }) => {
    await page.goto('/lab/?area=security');
    const expected = await page.locator(`${cards}[data-discipline="security"]`).count();
    expect(expected).toBeGreaterThan(0);
    await expect(page.locator('[data-filter="security"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(visibleCards)).toHaveCount(expected);

    await page.goto('/lab/?area=nope');
    await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(visibleCards)).toHaveCount(await page.locator(cards).count());
  });

  test('phone: no sideways scroll and the chip bar sticks under the header', async ({ page }) => {
    await page.goto('/lab/');
    await page.evaluate(() => window.scrollTo(0, 900));
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
});

test.describe('lab index: without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('all cards are listed and the chip bar is hidden', async ({ page }) => {
    await page.goto('/lab/?area=security');
    await expect(page.locator('[data-filter-bar]')).toBeHidden();
    const n = await page.locator(cards).count();
    expect(n).toBeGreaterThan(0);
    await expect(page.locator(visibleCards)).toHaveCount(n);
  });
});

test.describe('lab tool shell', () => {
  test('every tool page uses the shared shell', async ({ page }) => {
    await mockIp(page);
    const slugs = await toolSlugs(page);
    expect(slugs.length).toBeGreaterThanOrEqual(9);

    for (const slug of slugs) {
      await page.goto(`/lab/${slug}/`);
      const shell = page.locator(`[data-lab-tool-page="${slug}"]`);
      await expect(shell).toHaveCount(1);
      expect(DISCIPLINES).toContain(await shell.getAttribute('data-discipline'));

      await expect(page.locator('main h1')).toHaveCount(1);
      const crumbs = page.locator('nav[aria-label="Breadcrumb"] a');
      expect(await crumbs.evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(['/', '/lab/', `/lab/${slug}/`]);
      await expect(crumbs.last()).toHaveAttribute('aria-current', 'page');

      // Terminal panel named by its path strip.
      const panel = page.locator('[data-tool-panel]');
      await expect(panel).toHaveAttribute('aria-labelledby', 'tool-h');
      await expect(panel.locator('#tool-h')).toContainText(`/lab/${slug}`);
      await expect(panel.locator('.lab-tool')).toHaveCount(1);

      await expect(page.locator('[data-privacy-badge]')).toHaveCount(1);
      await expect(page.locator('[data-tool-reference] [data-tool-about]')).toHaveCount(1);

      // Other tools: three, none of them this one.
      const others = page.locator('[data-other-tools] [data-other-tool]');
      await expect(others).toHaveCount(3);
      const got = await others.evaluateAll((els) =>
        els.map((e) => ({ slug: e.getAttribute('data-other-tool')!, href: e.getAttribute('href') })),
      );
      for (const o of got) {
        expect(o.slug).not.toBe(slug);
        expect(slugs).toContain(o.slug);
        expect(o.href).toBe(`/lab/${o.slug}/`);
      }
      expect(new Set(got.map((o) => o.slug)).size).toBe(3);
      await expect(page.locator('[data-other-tools] [data-all-tools]')).toHaveAttribute('href', '/lab/');

      // Title carries the site suffix exactly once.
      expect((await page.title()).split('Corey Wininger').length - 1).toBe(1);

      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    }
  });

  test('main nav marks Lab as current on a tool page', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto('/lab/regex/');
    await expect(page.locator('nav[aria-label="Main"] a.top[href="/lab/"]')).toHaveAttribute('aria-current', 'page');
  });

  test('privacy badge: local for in-browser tools, network for the IP tool', async ({ page }) => {
    await mockIp(page);
    const slugs = await toolSlugs(page);
    for (const slug of slugs) {
      await page.goto(`/lab/${slug}/`);
      await expect(page.locator('[data-privacy-badge]')).toHaveAttribute(
        'data-privacy-badge',
        slug === 'whatsmyip' ? 'network' : 'local',
      );
    }
  });

  test('IP tool renders the response it is given', async ({ page }) => {
    await mockIp(page);
    await page.goto('/lab/whatsmyip/');
    await expect(page.locator('[data-tool-panel]')).toContainText(IP_FIXTURE.ip);
    await expect(page.locator('#f-region-code')).toHaveText(IP_FIXTURE.region_code);
  });
});

test.describe('lab tool shell: touch devices', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('controls inside a tool are at least 44px tall', async ({ page }) => {
    for (const slug of ['cron', 'base64', 'jwt']) {
      await page.goto(`/lab/${slug}/`);
      await page.waitForLoadState('networkidle');
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('[data-tool-panel] :is(button, select, summary, input:not([type=checkbox], [type=radio], [type=range], [type=file]), textarea)')]
          .filter((e) => e.checkVisibility())
          .filter((e) => e.getBoundingClientRect().height < 44)
          .map((e) => e.id || e.className),
      );
      expect(small, slug).toEqual([]);
    }
  });
});

test.describe('cron: field chips and reference', () => {
  const FIELDS = ['minute', 'hour', 'day', 'month', 'weekday'];
  const chipValues = (page: Page) =>
    page.locator('[data-cron-fields] [data-cron-field] .cron-field-val').allTextContents();

  test('five chips mirror the default expression', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.waitForLoadState('networkidle');
    const chips = page.locator('[data-cron-fields] [data-cron-field]');
    await expect(chips).toHaveCount(5);
    expect(await chips.evaluateAll((els) => els.map((e) => e.getAttribute('data-cron-field')))).toEqual(FIELDS);
    const parts = (await page.locator('#cron-input').inputValue()).trim().split(/\s+/);
    expect(parts).toHaveLength(5);
    await expect.poll(() => chipValues(page)).toEqual(parts);
    await expect(page.locator('[data-cron-field][data-bad]')).toHaveCount(0);
    // Decorative: the field breakdown carries the same information.
    await expect(page.locator('[data-cron-fields]')).toHaveAttribute('aria-hidden', 'true');
  });

  test('chips follow typing without parsing', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.waitForLoadState('networkidle');
    const before = await page.locator('#description-text').innerText();
    await page.locator('#cron-input').fill('5 4 3 2 1');
    await expect.poll(() => chipValues(page)).toEqual(['5', '4', '3', '2', '1']);
    // Result still waits for Enter / Parse.
    await expect(page.locator('#description-text')).toHaveText(before);
    await page.locator('#cron-input').fill('0 12');
    await expect.poll(() => chipValues(page)).toEqual(['0', '12', '·', '·', '·']);
  });

  test('an invalid field shows an alert and flags only that chip; a fix clears it', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.waitForLoadState('networkidle');
    const input = page.locator('#cron-input');
    const error = page.locator('#error-row');
    await expect(error).toBeHidden();

    for (const [expr, bad] of [['0 25 * * 1-5', 'hour'], ['61 * * * *', 'minute'], ['0 0 * * 9', 'weekday']] as const) {
      await input.fill(expr);
      await input.press('Enter');
      await expect(error).toBeVisible();
      await expect(error).toHaveAttribute('role', 'alert');
      await expect(page.locator('[data-cron-field][data-bad]')).toHaveCount(1);
      await expect(page.locator(`[data-cron-field="${bad}"]`)).toHaveAttribute('data-bad', '');
      await expect(page.locator('#description-card')).toBeHidden();
    }

    await input.fill('0 7 * * 1-5');
    await input.press('Enter');
    await expect(error).toBeHidden();
    await expect(page.locator('[data-cron-field][data-bad]')).toHaveCount(0);
    await expect(page.locator('#description-card')).toBeVisible();
    await expect(page.locator('#next-list > *')).toHaveCount(5);
  });

  test('reference table lists the five fields', async ({ page }) => {
    await page.goto('/lab/cron/');
    const table = page.locator('[data-cron-reference] table');
    await expect(table.locator('thead th[scope="col"]')).toHaveCount(3);
    await expect(table.locator('tbody th[scope="row"]')).toHaveCount(5);
  });
});

test.describe('lab: contrast', () => {
  test.use({ viewport: DESKTOP });

  for (const theme of THEMES) {
    test(`lab index and cron (default + error) pass 4.5:1 in ${theme}`, async ({ page }) => {
      await page.addInitScript((t) => {
        try { localStorage.setItem('theme', t); } catch {}
      }, theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const failures = async () =>
        (await new AxeBuilder({ page }).withRules(['color-contrast']).analyze()).violations.flatMap((v) =>
          v.nodes.map((n) => `${n.target.join(' ')} ${n.any[0]?.data?.contrastRatio}`),
        );

      await page.goto('/lab/');
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
      expect(await failures()).toEqual([]);

      await page.goto('/lab/cron/');
      await page.waitForLoadState('networkidle');
      expect(await failures()).toEqual([]);
      await page.locator('#cron-input').fill('0 25 * * 1-5');
      await page.locator('#cron-input').press('Enter');
      await expect(page.locator('#error-row')).toBeVisible();
      expect(await failures()).toEqual([]);
    });
  }
});
