import { expect, test } from '@playwright/test';

test.describe('lab index — second tool', () => {
  test('renders both Networking and Systems sections, each with one card', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-lab-section="networking"]')).toBeVisible();
    await expect(page.locator('[data-lab-section="systems"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="subnet"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="cron"]')).toBeVisible();
  });

  test('cron card has New badge and links to /lab/cron/', async ({ page }) => {
    await page.goto('/lab/');
    const card = page.locator('[data-lab-tool="cron"]');
    await expect(card.locator('[data-lab-new-badge]')).toBeVisible();
    await card.locator('a').first().click();
    await expect(page).toHaveURL(/\/lab\/cron\/?$/);
  });
});

test.describe('cron decoder', () => {
  test('default expression parses with description, fields, fires, frequency', async ({ page }) => {
    await page.goto('/lab/cron/');
    const desc = page.locator('#description-text');
    await expect(desc).toContainText('Every 15 minutes');
    await expect(desc).toContainText('between 9 AM and 5 PM');
    await expect(desc).toContainText('Monday through Friday');
    await expect(page.locator('[data-field="Minute"] .field-raw')).toHaveText('*/15');
    await expect(page.locator('[data-field="Hour"] .field-raw')).toHaveText('9-17');
    await expect(page.locator('[data-field="Day of week"] .field-raw')).toHaveText('1-5');
    await expect(page.locator('#frequency-text')).toContainText('/day');
    const nextRows = page.locator('#next-list .fire-row');
    await expect(nextRows).toHaveCount(5);
    const pastRows = page.locator('#past-list .fire-row');
    await expect(pastRows).toHaveCount(5);
  });

  test('@daily expands and describes', async ({ page }) => {
    await page.goto('/lab/cron/');
    const input = page.locator('#cron-input');
    await input.fill('@daily');
    await input.press('Enter');
    await expect(page.locator('#description-text')).toContainText('daily');
    await expect(page.locator('#description-text')).toContainText('0 0 * * *');
  });

  test('preset chip updates input and parses', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.locator('#preset-row button', { hasText: '0 9 * * 1-5' }).click();
    await expect(page.locator('#cron-input')).toHaveValue('0 9 * * 1-5');
    await expect(page.locator('#description-text')).toContainText('Monday through Friday');
  });

  test('slash key focuses input when not focused', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.locator('main h1').click();
    await page.keyboard.press('/');
    await expect(page.locator('#cron-input')).toBeFocused();
  });

  test('share button copies URL with expr param', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/lab/cron/');
    await page.locator('#share-btn').click();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toMatch(/[?&]expr=/);
    const url = new URL(clip);
    expect(url.searchParams.get('expr')).toBe('*/15 9-17 * * 1-5');
  });

  test('?expr= URL param pre-populates input', async ({ page }) => {
    await page.goto('/lab/cron/?expr=0+0+*+*+*');
    await expect(page.locator('#cron-input')).toHaveValue('0 0 * * *');
    await expect(page.locator('#description-text')).toContainText('At 12:00 AM');
  });

  test('UTC toggle updates fire times and tz label', async ({ page }) => {
    await page.goto('/lab/cron/');
    const localLabel = await page.locator('#tz-label').textContent();
    await page.locator('#tz-utc-btn').click();
    await expect(page.locator('#tz-label')).toHaveText('UTC');
    await expect(page.locator('#next-list .fire-row .fire-time').first()).toContainText('UTC');
    await page.locator('#tz-local-btn').click();
    await expect(page.locator('#tz-label')).not.toHaveText('UTC');
    if (localLabel) await expect(page.locator('#tz-label')).toHaveText(localLabel);
  });

  test('Now button resets pivot to current minute', async ({ page }) => {
    await page.goto('/lab/cron/');
    const pivot = page.locator('#pivot-date');
    await pivot.fill('2020-01-01T00:00');
    await page.locator('#now-btn').click();
    const after = (await pivot.inputValue()) || '';
    expect(after.startsWith('2020')).toBe(false);
    expect(after.length).toBeGreaterThan(0);
  });

  test('day-31 + Feb produces skip warning', async ({ page }) => {
    await page.goto('/lab/cron/');
    const input = page.locator('#cron-input');
    await input.fill('0 0 31 2 *');
    await input.press('Enter');
    await expect(page.locator('[data-warning="calendarOff"]').first()).toBeVisible();
  });

  test('DOW restricted only — no DOM/DOW OR warning', async ({ page }) => {
    await page.goto('/lab/cron/');
    const input = page.locator('#cron-input');
    await input.fill('0 0 * * 1');
    await input.press('Enter');
    await expect(page.locator('[data-warning="alert"]')).toHaveCount(0);
  });

  test('DOM and DOW both restricted — DOM/DOW OR warning fires', async ({ page }) => {
    await page.goto('/lab/cron/');
    const input = page.locator('#cron-input');
    await input.fill('0 0 15 * 1');
    await input.press('Enter');
    await expect(page.locator('[data-warning="alert"]')).toBeVisible();
  });

  test('translate panel exposes systemd, k8s, GHA, AWS rows', async ({ page }) => {
    await page.goto('/lab/cron/');
    await page.locator('#translate-details summary').click();
    await expect(page.locator('[data-translate="systemd OnCalendar"]')).toBeVisible();
    await expect(page.locator('[data-translate="Kubernetes CronJob"]')).toBeVisible();
    await expect(page.locator('[data-translate="GitHub Actions"]')).toBeVisible();
    await expect(page.locator('[data-translate="AWS EventBridge / CloudWatch"]')).toBeVisible();
  });

  test('AWS translation contains ? placeholder for default expression', async ({ page }) => {
    await page.goto('/lab/cron/');
    const aws = await page
      .locator('[data-translate-value="AWS EventBridge / CloudWatch"]')
      .textContent();
    expect(aws).toContain('?');
    expect(aws).toMatch(/^cron\(/);
  });

  test('systemd translation reflects DOW range and time stepping', async ({ page }) => {
    await page.goto('/lab/cron/');
    const sd = await page
      .locator('[data-translate-value="systemd OnCalendar"]')
      .textContent();
    expect(sd).toContain('Mon..Fri');
    expect(sd).toContain('*/15');
  });

  test('document title updates on successful parse', async ({ page }) => {
    await page.goto('/lab/cron/');
    await expect(page).toHaveTitle(/\*\/15 9-17 \* \* 1-5 — Cron decoder/);
  });

  test('localStorage history persists last parsed expression', async ({ page }) => {
    await page.goto('/lab/cron/');
    const input = page.locator('#cron-input');
    await input.fill('15 14 1 * *');
    await input.press('Enter');
    await page.reload();
    const stored = await page.evaluate(() =>
      localStorage.getItem('coreymark.lab.cron.history'),
    );
    expect(stored).toContain('15 14 1 * *');
    await expect(page.locator('#recent-row')).toBeVisible();
  });

  test('breadcrumb is present', async ({ page }) => {
    await page.goto('/lab/cron/');
    const crumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(crumb).toContainText('Home');
    await expect(crumb).toContainText('Lab');
    await expect(crumb).toContainText('Cron decoder');
  });

  test('Lab nav item is active on /lab/cron/', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/lab/cron/');
    const labLink = page.locator('nav[aria-label="Primary"] a', { hasText: 'Lab' });
    await expect(labLink).toHaveAttribute('aria-current', 'page');
  });
});
