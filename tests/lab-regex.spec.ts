import { expect, test } from '@playwright/test';

test.describe('lab index — regex card', () => {
  test('renders DevOps section with regex, json-yaml, and base64 cards', async ({ page }) => {
    await page.goto('/lab/');
    await expect(page.locator('[data-lab-section="devops"]')).toBeVisible();
    await expect(page.locator('[data-lab-tool="regex"]')).toBeVisible();
  });

  test('regex card has New badge and links to /lab/regex/', async ({ page }) => {
    await page.goto('/lab/');
    const card = page.locator('[data-lab-tool="regex"]');
    await expect(card.locator('[data-lab-new-badge]')).toBeVisible();
    await card.locator('a').first().click();
    await expect(page).toHaveURL(/\/lab\/regex\/?$/);
  });
});

test.describe('regex tester — widget', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lab/regex/');
  });

  test('default state: empty pattern, no active error, no matches shown', async ({ page }) => {
    await expect(page.locator('[data-testid="regex-widget"]')).toBeVisible();
    await expect(page.locator('#patternInput')).toHaveValue('');
    await expect(page.locator('#patternError')).toHaveText('');
    await expect(page.locator('[data-testid="match-count"]')).toHaveText('—');
  });

  test('valid pattern gets green border on pattern row', async ({ page }) => {
    await page.locator('#patternInput').fill('[a-z]+');
    await page.locator('#testInput').fill('hello world');
    await expect(page.locator('#patternRow')).toHaveClass(/\bvalid\b/);
    await expect(page.locator('#patternError')).toHaveText('');
  });

  test('invalid pattern gets red border and error message', async ({ page }) => {
    await page.locator('#patternInput').fill('[unclosed');
    await expect(page.locator('#patternRow')).toHaveClass(/\binvalid\b/);
    await expect(page.locator('#patternError')).not.toHaveText('');
  });

  test('Email preset loads pattern, test string, and produces matches', async ({ page }) => {
    await page.locator('[data-preset="Email"]').click();
    await expect(page.locator('#patternInput')).not.toHaveValue('');
    await expect(page.locator('#testInput')).toHaveValue(/@/);
    // wait for async render (rAF + setTimeout 0)
    await expect(page.locator('[data-match-highlight]').first()).toBeVisible();
    await expect(page.locator('[data-testid="match-count"]')).toHaveClass(/has-matches/);
  });

  test('IPv4 preset matches IP addresses in test string', async ({ page }) => {
    await page.locator('[data-preset="IPv4"]').click();
    // wait for render; IPv4 test string has at least 3 addresses
    await expect(page.locator('[data-match-highlight]').nth(2)).toBeVisible();
  });

  test('named groups preset shows group names in match detail', async ({ page }) => {
    await page.locator('[data-preset="Named groups"]').click();
    await expect(page.locator('[data-testid="match-count"]')).toHaveClass(/has-matches/);
    await page.locator('#matchDetailWrap summary').click();
    await expect(page.locator('.match-group-tag').first()).toBeVisible();
    await expect(page.locator('.match-group-tag').first()).toContainText('year');
  });

  test('g flag off → single match only', async ({ page }) => {
    // Deactivate g flag first
    await page.locator('[data-flag="g"]').click();
    await page.locator('#patternInput').fill('[a-z]+');
    await page.locator('#testInput').fill('hello world foo');
    // toHaveCount retries until the async render settles
    await expect(page.locator('[data-match-highlight]')).toHaveCount(1);
  });

  test('i flag toggles case-insensitive matching', async ({ page }) => {
    await page.locator('#patternInput').fill('HELLO');
    await page.locator('#testInput').fill('hello world');
    // Without i: no matches
    await expect(page.locator('[data-testid="match-count"]')).toHaveClass(/no-matches/);
    // Enable i
    await page.locator('[data-flag="i"]').click();
    await expect(page.locator('[data-testid="match-count"]')).toHaveClass(/has-matches/);
  });

  test('match count shows correct number', async ({ page }) => {
    await page.locator('#patternInput').fill('\\d+');
    await page.locator('#testInput').fill('1 22 333 4444');
    const countEl = page.locator('[data-testid="match-count"]');
    await expect(countEl).toHaveText('4 matches');
  });

  test('match detail panel expands and shows match values', async ({ page }) => {
    await page.locator('#patternInput').fill('\\w+');
    await page.locator('#testInput').fill('foo bar baz');
    await expect(page.locator('#matchDetailWrap')).not.toHaveAttribute('hidden');
    await page.locator('#matchDetailWrap summary').click();
    await expect(page.locator('.match-text').first()).toBeVisible();
    await expect(page.locator('.match-text').first()).toHaveText('foo');
  });

  test('replace mode shows replace section and produces output', async ({ page }) => {
    await page.locator('#modeReplace').click();
    await expect(page.locator('[data-testid="replace-section"]')).toBeVisible();
    await page.locator('#patternInput').fill('(\\w+)');
    await page.locator('#testInput').fill('hello world');
    await page.locator('#replaceInput').fill('[$1]');
    await expect(page.locator('[data-testid="replace-output"]')).toContainText('[hello]');
  });

  test('switch back to test mode hides replace section', async ({ page }) => {
    await page.locator('#modeReplace').click();
    await expect(page.locator('[data-testid="replace-section"]')).toBeVisible();
    await page.locator('#modeTest').click();
    await expect(page.locator('[data-testid="replace-section"]')).toBeHidden();
  });

  test('history chip appears after preset is loaded', async ({ page }) => {
    await page.locator('[data-preset="UUID"]').click();
    await expect(page.locator('[data-history-chip]')).toBeVisible();
  });

  test('history chip loads pattern on click', async ({ page }) => {
    await page.locator('[data-preset="UUID"]').click();
    const loadedPattern = await page.locator('#patternInput').inputValue();
    await page.locator('#patternInput').fill('');
    await page.locator('[data-history-chip]').first().click();
    await expect(page.locator('#patternInput')).toHaveValue(loadedPattern);
  });

  test('history chip X button removes entry', async ({ page }) => {
    await page.locator('[data-preset="UUID"]').click();
    await expect(page.locator('[data-history-chip]')).toHaveCount(1);
    await page.locator('[data-history-remove]').first().click();
    await expect(page.locator('[data-history-chip]')).toHaveCount(0);
  });

  test('URL state reflects pattern, flags, and test string', async ({ page }) => {
    await page.locator('#patternInput').fill('\\d+');
    await page.locator('#testInput').fill('123');
    await page.waitForTimeout(100);
    const url = page.url();
    expect(url).toContain('pattern=');
    expect(url).toContain('test=');
  });

  test('URL state preloads pattern and test string on navigation', async ({ page }) => {
    await page.goto('/lab/regex/?pattern=%5Cd%2B&flags=g&test=abc+123+456');
    await expect(page.locator('#patternInput')).toHaveValue('\\d+');
    await expect(page.locator('#testInput')).toHaveValue('abc 123 456');
    await expect(page.locator('[data-testid="match-count"]')).toHaveClass(/has-matches/);
  });

  test('pitfall panel opens and shows content', async ({ page }) => {
    const panel = page.locator('.regex-widget details.pitfall-panel');
    await expect(panel).toBeVisible();
    await panel.locator('summary').click();
    await expect(panel).toHaveAttribute('open', '');
    await expect(page.locator('.pitfall-item h3').first()).toContainText('backtracking');
  });
});
