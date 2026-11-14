import { expect, test } from '@playwright/test';

test.describe('lab index', () => {
  test('renders one heading and the subnet card under Networking', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('[data-lab-list] [data-discipline="networking"]').first()).toBeVisible();
    await expect(page.locator('[data-lab-tool="subnet"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="subnet"]')).toHaveAttribute('data-discipline', 'networking');
  });

  test('subnet card links to /lab/subnet/', async ({ page }) => {
    await page.goto('/lab/');
    const card = page.locator('[data-lab-tool="subnet"]');
    await card.locator('a').first().click();
    await expect(page).toHaveURL(/\/lab\/subnet\/?$/);
  });

  test('only disciplines with tools get a filter chip', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-discipline-filters] [data-filter="networking"]')).toHaveCount(1);
    await expect(page.locator('[data-discipline-filters] [data-filter="devops"]')).toHaveCount(1);
    // No cloud tools yet, so no cloud chip.
    await expect(page.locator('[data-discipline-filters] [data-filter="cloud"]')).toHaveCount(0);
    await expect(page.locator('[data-lab-list] [data-discipline="cloud"]')).toHaveCount(0);
  });
});

test.describe('subnet calculator', () => {
  test('default 10.0.0.0/24 parses and stat grid populates', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await expect(page.locator('[data-stat="Network address"]')).toContainText('10.0.0.0/24');
    await expect(page.locator('[data-stat="Broadcast"]')).toContainText('10.0.0.255');
    await expect(page.locator('[data-stat="Subnet mask"]')).toContainText('255.255.255.0');
    await expect(page.locator('[data-stat="Wildcard mask"]')).toContainText('0.0.0.255');
  });

  test('IPv6 input shows Last address (not Broadcast) and hides IPv4-only cards', async ({ page }) => {
    await page.goto('/lab/subnet/');
    const input = page.locator('#cidr-input');
    await input.fill('2001:db8::/32');
    await input.press('Enter');
    await expect(page.locator('[data-stat="Last address"]')).toBeVisible();
    await expect(page.locator('[data-stat="Broadcast"]')).toHaveCount(0);
    await expect(page.locator('[data-stat="Subnet mask"]')).toHaveCount(0);
    await expect(page.locator('[data-stat="Wildcard mask"]')).toHaveCount(0);
    await expect(page.locator('[data-stat="Class"]')).toHaveCount(0);
  });

  test('preset chip updates input and triggers parse', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await page.locator('#preset-row button', { hasText: '100.64.0.0/10' }).click();
    await expect(page.locator('#cidr-input')).toHaveValue('100.64.0.0/10');
    await expect(page.locator('[data-stat="Network address"]')).toContainText('100.64.0.0/10');
  });

  test('slash key focuses input when not already focused', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await page.locator('main h1').click();
    await page.keyboard.press('/');
    await expect(page.locator('#cidr-input')).toBeFocused();
  });

  test('?cidr= URL param pre-populates input', async ({ page }) => {
    await page.goto('/lab/subnet/?cidr=192.168.0.0%2F16');
    await expect(page.locator('#cidr-input')).toHaveValue('192.168.0.0/16');
    await expect(page.locator('[data-stat="Network address"]')).toContainText('192.168.0.0/16');
  });

  test('hosts-needed: 60 hosts → /26', async ({ page }) => {
    await page.goto('/lab/subnet/');
    const hostsInput = page.locator('#hosts-needed-row input[type="number"]');
    await hostsInput.fill('60');
    await expect(page.locator('[data-hosts-result]')).toContainText('/26');
    await expect(page.locator('[data-hosts-result]')).toContainText('64');
    await expect(page.locator('[data-hosts-result]')).toContainText('62');
  });

  test('reverse DNS zone for 10.0.0.0/24', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await expect(page.locator('[data-stat="Reverse DNS zone"]')).toContainText('0.0.10.in-addr.arpa');
  });

  test('reverse DNS zone for non-aligned /20 shows parent label', async ({ page }) => {
    await page.goto('/lab/subnet/?cidr=10.0.0.0%2F20');
    await expect(page.locator('[data-stat="Reverse DNS zone (parent)"]')).toBeVisible();
  });

  test('wildcard card includes ACL hint', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await expect(page.locator('[data-stat="Wildcard mask"]')).toContainText('permit ip 10.0.0.0 0.0.0.255 any');
  });

  test('share button copies URL with cidr param', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/lab/subnet/');
    await page.locator('#share-btn').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/[?&]cidr=10\.0\.0\.0%2F24/);
  });

  test('localStorage history persists last parsed CIDR', async ({ page }) => {
    await page.goto('/lab/subnet/');
    const input = page.locator('#cidr-input');
    await input.fill('192.168.5.0/24');
    await input.press('Enter');
    await expect(page.locator('[data-stat="Network address"]')).toContainText('192.168.5.0/24');
    await page.reload();
    const stored = await page.evaluate(() =>
      localStorage.getItem('coreymark.lab.subnet.history')
    );
    expect(stored).toContain('192.168.5.0/24');
    await expect(page.locator('#recent-row')).toBeVisible();
  });

  test('document title updates on successful parse', async ({ page }) => {
    await page.goto('/lab/subnet/');
    await expect(page).toHaveTitle(/10\.0\.0\.0\/24 — Subnet calculator/);
  });

  test('breadcrumb links home, to the Lab, and marks this tool as current', async ({ page }) => {
    await page.goto('/lab/subnet/');
    const crumbs = page.locator('nav[aria-label="Breadcrumb"] a');
    await expect(crumbs).toHaveCount(3);
    await expect(crumbs.nth(0)).toHaveAttribute('href', '/');
    await expect(crumbs.nth(1)).toHaveAttribute('href', '/lab/');
    await expect(crumbs.nth(2)).toHaveAttribute('href', '/lab/subnet/');
    await expect(crumbs.nth(2)).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('lab navigation', () => {
  test('Lab link is in the main nav', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/');
    await expect(page.locator('nav[aria-label="Main"] a.top[href="/lab/"]')).toBeVisible();
  });

  test('Lab nav item is active on /lab/subnet/', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/lab/subnet/');
    const labLink = page.locator('nav[aria-label="Main"] a.top[href="/lab/"]');
    await expect(labLink).toHaveAttribute('aria-current', 'page');
  });

  test('mobile menu shows Lab item', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-mobile-nav] > summary').click();
    await expect(page.locator('#mobile-menu a[href="/lab/"]')).toBeVisible();
  });
});
