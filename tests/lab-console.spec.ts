import { expect, test } from '@playwright/test';

// Guard: every Lab page must load without a script error. A tool whose
// script fails to parse renders fine and passes every structural test,
// which is how the JSON/YAML converter stayed broken unnoticed.

const IP_FIXTURE = {
  ip: '203.0.113.42', // RFC 5737 documentation range
  ip_decimal: 3405803818,
  country: 'US',
  country_name: 'United States',
  is_eu: false,
  region: 'Indiana',
  region_code: 'IN',
  city: 'Indianapolis',
  postal: '46204',
  latitude: 39.77,
  longitude: -86.16,
  time_zone: 'America/Indiana/Indianapolis',
  asn: 64496,
  asn_org: 'Example Net',
  colo: 'IND',
  user_agent: 'Mozilla/5.0 (test)',
};

test.describe('lab pages: no console errors', () => {
  test.setTimeout(90_000);

  test('the Lab index and every tool load and take input without a script error', async ({ page }) => {
    // Third-party and network-dependent calls are stubbed so that the only
    // errors left are the site's own.
    await page.route('https://static.cloudflareinsights.com/**', (r) =>
      r.fulfill({ contentType: 'text/javascript', body: '' }),
    );
    await page.route('https://ip.coreymark.com/**', (r) =>
      r.fulfill({
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*' },
        body: JSON.stringify(IP_FIXTURE),
      }),
    );

    let errors: string[] = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });
    page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()}: ${r.url()}`);
    });

    await page.goto('/lab/');
    const slugs = await page
      .locator('[data-lab-list] [data-lab-tool]')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-lab-tool')!));
    expect(slugs.length).toBeGreaterThanOrEqual(9);

    const problems: string[] = [];
    for (const path of ['/lab/', ...slugs.map((s) => `/lab/${s}/`)]) {
      errors = [];
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Each tool is present and its scripts have run far enough to be used.
      if (path !== '/lab/') {
        await expect(page.locator('[data-tool-panel] .lab-tool')).toHaveCount(1);
        // Type into the first text field, if the tool has one: scripts that
        // only fail on input are caught too.
        const field = page.locator('[data-tool-panel] :is(textarea, input[type="text"], input[type="search"], input:not([type]))').first();
        if (await field.count()) {
          await field.fill('test 123');
          await page.waitForTimeout(350);
        }
      }
      for (const e of errors) problems.push(`${path} → ${e}`);
    }
    expect(problems).toEqual([]);
  });
});
