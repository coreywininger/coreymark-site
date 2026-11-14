import { expect, test, type Page } from '@playwright/test';
import * as yaml from 'js-yaml';

// The converter shipped broken for months because nothing loaded it in a
// test: the pasted-in library had a syntax error, so `jsyaml` never existed.
// These tests convert real input in both directions.

const FIXTURE = {
  name: 'demo',
  replicas: 3,
  enabled: true,
  ratio: 0.5,
  tags: ['a', 'b'],
  nested: { region: 'us-east-1', ports: [80, 443] },
  note: null,
};

function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  return errors;
}

async function openTool(page: Page) {
  // Analytics beacon is third-party and irrelevant here; keep the run offline.
  await page.route('https://static.cloudflareinsights.com/**', (r) =>
    r.fulfill({ contentType: 'text/javascript', body: '' }),
  );
  await page.goto('/lab/json-yaml/');
  await expect(page.locator('html')).toHaveAttribute('data-jsyaml-ready', '');
}

const output = (page: Page) => page.locator('#outputArea');

test.describe('json ⇄ yaml converter', () => {
  test('loads with no console errors and the library available', async ({ page }) => {
    const errors = watchErrors(page);
    await openTool(page);
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => typeof (window as any).jsyaml?.load)).toBe('function');
    expect(await page.evaluate(() => typeof (window as any).jsyaml?.dump)).toBe('function');
  });

  test('the library is a bundled script, not code pasted into the page', async ({ page }) => {
    await openTool(page);
    const inline = await page.locator('script:not([src])').evaluateAll((els) => els.map((e) => e.textContent ?? ''));
    for (const code of inline) {
      // The library's banner and internals must not be inline. (The tool's own
      // script may still mention the library by name in a message.)
      expect(code).not.toContain('nodeca/js-yaml');
      expect(code).not.toContain('YAMLException');
      // Literal line/paragraph separators (code points 0x2028, 0x2029) inside
      // inline code are what broke the old copy. Built from char codes so this
      // file never contains the characters or their escapes.
      const separators = new RegExp('[' + String.fromCharCode(0x2028, 0x2029) + ']');
      expect(separators.test(code)).toBe(false);
    }
    const modules = await page.locator('script[type="module"][src]').evaluateAll((els) => els.map((e) => e.getAttribute('src')!));
    expect(modules.some((src) => src.startsWith('/_astro/'))).toBe(true);
    for (const src of modules) expect(src.startsWith('/')).toBe(true); // same origin only
  });

  test('JSON → YAML → JSON round-trips a fixture', async ({ page }) => {
    const errors = watchErrors(page);
    await openTool(page);
    const input = page.locator('#inputArea');

    await input.fill(JSON.stringify(FIXTURE, null, 2));
    await expect(output(page)).toBeVisible();
    await expect(page.locator('#outputPlaceholder')).toBeHidden();
    await expect(page.locator('#inputError')).toBeHidden();
    const asYaml = await output(page).inputValue();
    expect(asYaml.trim().startsWith('{')).toBe(false); // really YAML, not echoed JSON
    expect(yaml.load(asYaml)).toEqual(FIXTURE);
    await expect(page.locator('#copyBtn')).toBeEnabled();
    await expect(page.locator('#downloadBtn')).toBeEnabled();

    // Feed the YAML back in.
    await input.fill(asYaml);
    await expect.poll(async () => (await output(page).inputValue()).trim().startsWith('{')).toBe(true);
    expect(JSON.parse(await output(page).inputValue())).toEqual(FIXTURE);
    await expect(page.locator('#inputError')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('explicit direction buttons convert the same way', async ({ page }) => {
    await openTool(page);
    await page.locator('#btnYaml2Json').click();
    await page.locator('#inputArea').fill(yaml.dump(FIXTURE));
    await expect(output(page)).toBeVisible();
    expect(JSON.parse(await output(page).inputValue())).toEqual(FIXTURE);

    await page.locator('#btnJson2Yaml').click();
    await page.locator('#inputArea').fill(JSON.stringify(FIXTURE));
    await expect.poll(async () => {
      try { return yaml.load(await output(page).inputValue()); } catch { return undefined; }
    }).toEqual(FIXTURE);
  });

  test('invalid input shows the error state and clears the output; valid input recovers', async ({ page }) => {
    const errors = watchErrors(page);
    await openTool(page);
    const input = page.locator('#inputArea');
    const error = page.locator('#inputError');

    for (const bad of ['{"a": ', 'key: [unclosed', '{"a": 1,}']) {
      await input.fill(bad);
      await expect(error).toBeVisible();
      await expect(error).not.toHaveText('');
      await expect(error).toHaveAttribute('aria-live', 'assertive');
      await expect(page.locator('#inputPane')).toHaveClass(/error-state/);
      await expect(output(page)).toBeHidden();
      await expect(page.locator('#copyBtn')).toBeDisabled();
    }

    await input.fill('{"a": 1}');
    await expect(error).toBeHidden();
    await expect(page.locator('#inputPane')).not.toHaveClass(/error-state/);
    await expect(output(page)).toBeVisible();
    expect(yaml.load(await output(page).inputValue())).toEqual({ a: 1 });
    // A parse failure is an expected state, not a script error.
    expect(errors).toEqual([]);
  });

  test('every sample converts without an error', async ({ page }) => {
    await openTool(page);
    const chips = page.locator('.jy-widget .chip');
    const n = await chips.count();
    expect(n).toBeGreaterThan(2);
    for (let i = 0; i < n; i++) {
      await chips.nth(i).click();
      await expect(output(page)).toBeVisible();
      await expect(page.locator('#inputError')).toBeHidden();
      expect((await output(page).inputValue()).length).toBeGreaterThan(10);
    }
  });
});
