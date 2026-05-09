import { expect, test } from '@playwright/test';

const PAGES = [
  {
    name: 'subnet',
    url: '/lab/subnet/',
    presetMatch: '192.168.0.0/16',
    inputSelector: '#cidr-input',
    spamPresets: ['10.0.0.0/8', '172.16.0.0/12', '127.0.0.0/8'],
  },
  {
    name: 'cron',
    url: '/lab/cron/',
    presetMatch: '0 9 * * 1-5',
    inputSelector: '#cron-input',
    spamPresets: ['*/5 * * * *', '0 0 * * *', '@hourly'],
  },
];

for (const page of PAGES) {
  test.describe(`${page.name} widget — UX polish`, () => {
    test('clicking a preset chip applies chip-flash class then removes it', async ({ page: pg }) => {
      await pg.goto(page.url);
      // Wait for initial render to finish so the wrapper is idle.
      await expect(pg.locator('#parse-btn')).toBeEnabled({ timeout: 1500 });
      // Capture the synchronous post-click state in the page context — Playwright's
      // network round-trip can exceed the 140ms flash window otherwise.
      const stateAfterClick = await pg.evaluate((preset) => {
        const c = Array.from(
          document.querySelectorAll('#preset-row button'),
        ).find((b) => b.textContent === preset) as HTMLButtonElement;
        c.click();
        return {
          chipHasFlash: c.classList.contains('chip-flash'),
          parseBtnDisabled: (document.getElementById('parse-btn') as HTMLButtonElement).disabled,
        };
      }, page.presetMatch);
      expect(stateAfterClick.chipHasFlash).toBe(true);
      expect(stateAfterClick.parseBtnDisabled).toBe(true);
      // Flash should clear within ~140ms; render finishes shortly after.
      const chip = pg.locator('#preset-row button', { hasText: page.presetMatch }).first();
      await expect(chip).not.toHaveClass(/chip-flash/, { timeout: 1000 });
      await expect(pg.locator('#parse-btn')).toBeEnabled({ timeout: 1500 });
      await expect(pg.locator('#parse-btn')).toHaveText('Parse');
    });

    test('spam-clicking presets settles to the last click — no widget render errors', async ({ page: pg }) => {
      const widgetErrors: string[] = [];
      pg.on('console', (msg) => {
        if (msg.type() !== 'error') return;
        // Only fail on errors emitted by the widget's render wrapper.
        // Third-party network errors (e.g. Cloudflare Insights beacon
        // blocked on localhost) are noise here.
        if (msg.text().includes('Lab tool render error')) {
          widgetErrors.push(msg.text());
        }
      });
      await pg.goto(page.url);
      await expect(pg.locator('#parse-btn')).toBeEnabled({ timeout: 1500 });
      const [a, b, c] = page.spamPresets;
      // Fire all three clicks synchronously in page context — that's the
      // pathological case the re-entrance guard is meant to handle.
      await pg.evaluate(([a, b, c]) => {
        const find = (txt: string) =>
          Array.from(document.querySelectorAll('#preset-row button')).find(
            (el) => el.textContent === txt,
          ) as HTMLButtonElement;
        find(a).click();
        find(b).click();
        find(c).click();
      }, [a, b, c]);
      await expect(pg.locator('#parse-btn')).toBeEnabled({ timeout: 2500 });
      await expect(pg.locator('#parse-btn')).toHaveText('Parse');
      await expect(pg.locator(page.inputSelector)).toHaveValue(c);
      expect(widgetErrors).toEqual([]);
    });

    test('parse button never stays stuck on Parsing… or disabled after render completes', async ({ page: pg }) => {
      await pg.goto(page.url);
      // Trigger a render via Enter key on the input
      await pg.locator(page.inputSelector).focus();
      await pg.keyboard.press('Enter');
      const parseBtn = pg.locator('#parse-btn');
      await expect(parseBtn).toBeEnabled({ timeout: 1500 });
      await expect(parseBtn).toHaveText('Parse');
    });
  });
}

test.describe('cron — frequency sample reduced from 200 to 50', () => {
  test('default expression still produces sensible frequency text', async ({ page }) => {
    await page.goto('/lab/cron/');
    // After the busy-state wrapper completes
    await expect(page.locator('#parse-btn')).toBeEnabled({ timeout: 1000 });
    const freq = await page.locator('#frequency-text').textContent();
    expect(freq).toBeTruthy();
    expect(freq).toMatch(/\/(day|week|year)/);
  });
});
