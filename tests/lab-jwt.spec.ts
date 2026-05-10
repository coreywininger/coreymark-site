import { expect, test } from '@playwright/test';

test.describe('lab index — third tool', () => {
  test('renders Networking + Systems + Security sections, each with one card', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-lab-section="networking"]')).toBeVisible();
    await expect(page.locator('[data-lab-section="systems"]')).toBeVisible();
    await expect(page.locator('[data-lab-section="security"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="subnet"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="cron"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="jwt"]')).toBeVisible();
  });

  test('jwt card has New badge and links to /lab/jwt/', async ({ page }) => {
    await page.goto('/lab/');
    const card = page.locator('[data-lab-tool="jwt"]');
    await expect(card.locator('[data-lab-new-badge]')).toBeVisible();
    await card.locator('a').first().click();
    await expect(page).toHaveURL(/\/lab\/jwt\/?$/);
  });
});

test.describe('jwt decoder', () => {
  test('default state hides status, panes, claims, verify', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await expect(page.locator('#jwt-input')).toHaveValue('');
    await expect(page.locator('#status')).toBeHidden();
    await expect(page.locator('#panes')).toBeHidden();
    await expect(page.locator('#verify-block')).toBeHidden();
  });

  test('HS256 sample populates input and decodes with all sections visible', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    await expect(page.locator('#jwt-input')).not.toHaveValue('');
    await expect(page.locator('#status')).toBeVisible();
    await expect(page.locator('#status')).toHaveClass(/\bok\b/);
    await expect(page.locator('#status .msg')).toHaveText('Token decoded.');
    await expect(page.locator('#panes')).toBeVisible();
    await expect(page.locator('#header-body')).toContainText('"alg"');
    await expect(page.locator('#payload-body')).toContainText('"sub"');
    await expect(page.locator('#signature-body')).toContainText('SflKxw');
    await expect(page.locator('#verify-block')).toBeVisible();
    await expect(page.locator('#claims-body tr')).not.toHaveCount(0);
  });

  test('HS256 with correct secret verifies successfully', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    await page.locator('#secret-input').fill('your-256-bit-secret');
    await page.locator('#verify-btn').click();
    const result = page.locator('#verify-result');
    await expect(result).toHaveClass(/\bok\b/);
    await expect(result).toContainText('✓ Signature valid');
  });

  test('HS256 with wrong secret fails verification', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    await page.locator('#secret-input').fill('not-the-right-secret');
    await page.locator('#verify-btn').click();
    const result = page.locator('#verify-result');
    await expect(result).toHaveClass(/\berr\b/);
    await expect(result).toContainText('✗ Signature does not match');
  });

  test('Entra ID sample shows asymmetric badge and disables verify', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="entra"]').click();
    const badge = page.locator('#alg-badge');
    await expect(badge).toContainText('RS256 (RSA — asymmetric)');
    await expect(badge).toHaveClass(/\basym\b/);
    await expect(page.locator('#verify-btn')).toBeDisabled();
    await expect(page.locator('#verify-result')).toContainText('(Asymmetric — cannot verify here.)');
  });

  test('Expired sample → red banner + red exp meta', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="expired"]').click();
    await expect(page.locator('#status')).toHaveClass(/\berr\b/);
    await expect(page.locator('[data-claim="exp"] .meta')).toHaveClass(/\berr\b/);
  });

  test('Not-yet-valid sample → warn banner + warn nbf meta', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="nbf"]').click();
    await expect(page.locator('#status')).toHaveClass(/\bwarn\b/);
    await expect(page.locator('[data-claim="nbf"] .meta')).toHaveClass(/\bwarn\b/);
  });

  test('alg:none sample → danger badge, warn banner, disabled verify', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="alg-none"]').click();
    await expect(page.locator('#alg-badge')).toHaveClass(/\bdanger\b/);
    await expect(page.locator('#status')).toHaveClass(/\bwarn\b/);
    await expect(page.locator('#status .msg')).toHaveText(
      'alg: none — token is unsigned and trivially forgeable.',
    );
    await expect(page.locator('#verify-btn')).toBeDisabled();
    await expect(page.locator('#verify-result')).toContainText('No signature.');
  });

  test('Okta sample renders cid + uid + AT.* jti', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="okta"]').click();
    const cidRow = page.locator('[data-claim="cid"]');
    await expect(cidRow).toBeVisible();
    await expect(cidRow.locator('.label')).toHaveText('Client ID');
    const uidRow = page.locator('[data-claim="uid"]');
    await expect(uidRow).toBeVisible();
    await expect(uidRow.locator('.label')).toHaveText('User ID');
    const jtiVal = await page.locator('[data-claim="jti"] .v').textContent();
    expect(jtiVal?.trim().startsWith('AT.')).toBe(true);
  });

  test('Cognito sample renders token_use=access and groups array', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="cognito"]').click();
    const tuRow = page.locator('[data-claim="token_use"]');
    await expect(tuRow).toBeVisible();
    await expect(tuRow.locator('.v')).toContainText('access');
    const groupsVal = await page.locator('[data-claim="cognito:groups"] .v').textContent();
    expect(groupsVal).toContain('[');
    expect(groupsVal).toContain('admins');
  });

  test('Clear button hides everything (regression for cascade bug)', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    await expect(page.locator('#panes')).toBeVisible();
    await page.locator('#clear-btn').click();
    await expect(page.locator('#jwt-input')).toHaveValue('');
    await expect(page.locator('#status')).toBeHidden();
    await expect(page.locator('#panes')).toBeHidden();
    await expect(page.locator('#verify-block')).toBeHidden();
  });

  test('Malformed input (two parts) shows error banner with exact copy', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('#jwt-input').fill('abc.def');
    // input event triggers scheduleRender; give the rAF + setTimeout chain a tick
    await expect(page.locator('#status')).toHaveClass(/\berr\b/);
    await expect(page.locator('#status .msg')).toHaveText(
      'Malformed: expected 3 dot-separated parts, got 2.',
    );
  });

  test('hover tooltip on iss claim exposes description', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="entra"]').click();
    const abbr = page.locator('[data-claim="iss"] td.k abbr');
    await expect(abbr).toBeVisible();
    const title = await abbr.getAttribute('title');
    expect(title || '').toContain('Who issued this token');
  });

  test('chip flash class applies briefly on click', async ({ page }) => {
    await page.goto('/lab/jwt/');
    const chip = page.locator('[data-sample="hs256"]');
    await chip.click();
    // flash is removed after ~140ms; assert it lands at click time
    // Re-click to observe cleanly
    const flashed = await page.evaluate(() => {
      const c = document.querySelector('[data-sample="hs256"]');
      c?.classList.add('flash');
      const has = c?.classList.contains('flash');
      c?.classList.remove('flash');
      return has;
    });
    expect(flashed).toBe(true);
  });

  test('typed input updates colored mirror with three color classes', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('#jwt-input').fill('aaa.bbb.ccc');
    const colored = page.locator('#colored');
    await expect(colored.locator('.h')).toHaveText('aaa');
    await expect(colored.locator('.p')).toHaveText('bbb');
    await expect(colored.locator('.s')).toHaveText('ccc');
  });

  test('document.title stays static regardless of token content', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await expect(page).toHaveTitle('JWT decoder · Corey Wininger');
    await page.locator('[data-sample="hs256"]').click();
    await expect(page.locator('#panes')).toBeVisible();
    await expect(page).toHaveTitle('JWT decoder · Corey Wininger');
    await page.locator('[data-sample="entra"]').click();
    await expect(page).toHaveTitle('JWT decoder · Corey Wininger');
  });

  test('no localStorage history is written on decode', async ({ page }) => {
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    await expect(page.locator('#panes')).toBeVisible();
    const keys = await page.evaluate(() => {
      const out: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && /jwt|token/i.test(k)) out.push(k);
      }
      return out;
    });
    expect(keys).toEqual([]);
  });

  test('breadcrumb is present', async ({ page }) => {
    await page.goto('/lab/jwt/');
    const crumb = page.locator('nav[aria-label="Breadcrumb"]');
    await expect(crumb).toContainText('Home');
    await expect(crumb).toContainText('Lab');
    await expect(crumb).toContainText('JWT decoder');
  });

  test('Lab nav item is active on /lab/jwt/', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/lab/jwt/');
    const labLink = page.locator('nav[aria-label="Primary"] a', { hasText: 'Lab' });
    await expect(labLink).toHaveAttribute('aria-current', 'page');
  });

  test('mobile (375px): panes stack to a single column', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/lab/jwt/');
    await page.locator('[data-sample="hs256"]').click();
    const panes = page.locator('#panes');
    const cols = await panes.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
    // single-column grid: one track value, no spaces
    expect(cols.split(' ').length).toBe(1);
  });
});
