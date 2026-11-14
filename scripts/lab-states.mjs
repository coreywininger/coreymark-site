// Shared by scripts/audit-lab.mjs and tests/lab-states.spec.ts: how to put
// each Lab tool into each of its output states, the mocked IP response, and
// the touch-target measurement. Add a state here when a tool gains one.

export const THEMES = ['slate', 'tokyo', 'catppuccin', 'dracula', 'gruvbox', 'ubuntu'];

// RFC 5737 documentation address and generic location data. Never a real IP.
export const IP = { ip: '203.0.113.42', ip_decimal: 3405803818, country: 'US', country_name: 'United States', is_eu: false, region: 'Indiana', region_code: 'IN', city: 'Indianapolis', postal: '46204', metro_code: 527, latitude: 39.77, longitude: -86.16, time_zone: 'America/Indiana/Indianapolis', asn: 64496, asn_org: 'Example Net', colo: 'IND', user_agent: 'Mozilla/5.0 (audit)' };

export const panel = '[data-tool-panel]';
const settle = (page, ms = 450) => page.waitForTimeout(ms);
const enter = async (page, sel, value) => { await page.locator(sel).fill(value); await page.locator(sel).press('Enter'); await settle(page); };

// Each tool: named states, each a function that drives a freshly loaded page.
export const TOOLS = {
  subnet: {
    default: async () => {},
    error: (p) => enter(p, '#cidr-input', 'not-a-cidr'),
    ipv6: (p) => enter(p, '#cidr-input', '2001:db8::/48'),
    'host-route': (p) => enter(p, '#cidr-input', '10.0.0.7/32'),
  },
  whatsmyip: {
    loaded: async () => {},
    'wget-tab': async (p) => { await p.locator('#tool-wget-btn').click(); await settle(p); },
    primer: async (p) => { await p.locator(`${panel} details.primer > summary`).click(); await settle(p); },
    'fetch-error': '__ip_error__',
  },
  cron: {
    default: async () => {},
    error: (p) => enter(p, '#cron-input', '0 25 * * 1-5'),
    warning: (p) => enter(p, '#cron-input', '0 0 31 2 1'),
    translate: async (p) => { await p.locator('#translate-details > summary').click(); await settle(p); },
    utc: async (p) => { await p.locator('#tz-utc-btn').click(); await settle(p); },
  },
  jwt: {
    empty: async () => {},
    decoded: async (p) => { await p.locator('[data-sample="hs256"]').click(); await settle(p); },
    expired: async (p) => { await p.locator('[data-sample="expired"]').click(); await settle(p); },
    'not-yet-valid': async (p) => { await p.locator('[data-sample="nbf"]').click(); await settle(p); },
    'alg-none': async (p) => { await p.locator('[data-sample="alg-none"]').click(); await settle(p); },
    invalid: async (p) => { await p.locator('#jwt-input').fill('not.a.token'); await p.locator('#decode-btn').click(); await settle(p); },
    'verify-fail': async (p) => { await p.locator('[data-sample="hs256"]').click(); await settle(p); await p.locator('#secret-input').fill('wrong-secret'); await p.locator('#verify-btn').click(); await settle(p, 700); },
    primer: async (p) => { await p.locator(`${panel} details.primer > summary`).click(); await settle(p); },
  },
  'cert-decoder': {
    empty: async () => {},
    decoded: async (p) => { await p.locator('[data-sample="x1"]').click(); await settle(p, 700); },
    'decoded-intermediate': async (p) => { await p.locator('[data-sample="r11"]').click(); await settle(p, 700); },
    invalid: async (p) => { await p.locator(`${panel} textarea`).first().fill('-----BEGIN CERTIFICATE-----\nnot base64\n-----END CERTIFICATE-----'); await p.locator('#cert-decode-btn').click(); await settle(p); },
  },
  base64: {
    empty: async () => {},
    encoded: async (p) => { await p.locator('[data-chip="hello"]').click(); await settle(p); },
    'data-uri': async (p) => { await p.locator('[data-chip="datauri"]').click(); await settle(p); },
    'decode-error': async (p) => { await p.locator('[data-mode="decode"]').click(); await p.locator(`${panel} textarea`).first().fill('%%% not base64 %%%'); await settle(p); },
    'file-tab': async (p) => { await p.locator('#tab-file').click(); await settle(p); },
  },
  regex: {
    empty: async () => {},
    matches: async (p) => { await p.locator(`${panel} button`, { hasText: /^Email$/ }).first().click(); await settle(p, 700); },
    groups: async (p) => { await p.locator(`${panel} button`, { hasText: /^Named groups$/ }).first().click(); await settle(p, 700); await p.locator('#matchDetailSummary').click().catch(() => {}); await settle(p); },
    'bad-pattern': async (p) => { await p.locator(`${panel} input[type="text"]`).first().fill('([a-z'); await settle(p, 700); },
    replace: async (p) => { await p.locator(`${panel} button`, { hasText: /^ISO Date$/ }).first().click(); await settle(p); await p.locator('#modeReplace').click(); await settle(p, 700); },
    gotchas: async (p) => { await p.locator(`${panel} details.pitfall-panel > summary`).click(); await settle(p); },
  },
  'json-yaml': {
    empty: async () => {},
    converted: async (p) => { await p.locator('.jy-widget .chip').first().click(); await settle(p, 700); },
    error: async (p) => { await p.locator('#inputArea').fill('{"a": '); await settle(p, 800); },
    gotchas: async (p) => { await p.locator(`${panel} details.pitfalls > summary`).click(); await settle(p); },
  },
  'http-status': {
    default: async () => {},
    search: async (p) => { await p.locator(`${panel} #search-input`).fill('502'); await settle(p, 600); },
    'no-results': async (p) => { await p.locator(`${panel} #search-input`).fill('zzzzqq'); await settle(p, 600); },
    'filter-5xx': async (p) => { await p.locator('.hs-chip[data-cat="5"]').click(); await settle(p); },
    'filter-4xx': async (p) => { await p.locator('.hs-chip[data-cat="4"]').click(); await settle(p); },
    'common-only': async (p) => { await p.locator('#common-only').check(); await settle(p); },
  },
};

/** Stub third-party and network calls so only the site's own behaviour is measured. */
export async function stubNetwork(page, slug, state) {
  await page.route('https://static.cloudflareinsights.com/**', (r) => r.fulfill({ contentType: 'text/javascript', body: '' }));
  const fail = TOOLS[slug]?.[state] === '__ip_error__';
  await page.route('https://ip.coreymark.com/**', (r) =>
    fail
      ? r.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: 'unavailable' })
      : r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(IP) }),
  );
}

/** Load a tool page and drive it into `state`. Returns an error string if the driver failed. */
export async function gotoState(page, baseUrl, slug, state) {
  await stubNetwork(page, slug, state);
  await page.goto(`${baseUrl}/lab/${slug}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  const driver = TOOLS[slug][state];
  if (typeof driver !== 'function') { await settle(page, 600); return null; }
  try { await driver(page); return null; } catch (e) { return String(e).split('\n')[0].slice(0, 160); }
}

/**
 * Controls whose hit area is under 44 x 44 CSS px. A checkbox or radio is
 * measured together with its label; links inside running prose are exempt.
 */
export const findSmallTargets = (page) =>
  page.evaluate(() => {
      const box = (e) => {
        const r = e.getBoundingClientRect();
        let w = r.width, h = r.height;
        for (const pseudo of ['::before', '::after']) {
          const s = getComputedStyle(e, pseudo);
          if (s.content && s.content !== 'none' && s.position === 'absolute') { w = Math.max(w, parseFloat(s.width) || 0); h = Math.max(h, parseFloat(s.height) || 0); }
        }
        // A label wrapping a checkbox/radio is that control's hit area.
        if (/^(checkbox|radio)$/.test(e.type)) {
          const label = e.closest('label') ?? (e.id ? document.querySelector(`label[for="${e.id}"]`) : null);
          if (label) {
            const l = label.getBoundingClientRect();
            const left = Math.min(r.left, l.left), right = Math.max(r.right, l.right);
            const top = Math.min(r.top, l.top), bottom = Math.max(r.bottom, l.bottom);
            w = Math.max(w, right - left); h = Math.max(h, bottom - top);
          }
        }
        return { w, h };
      };
      const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="tab"], [role="button"]';
      return [...document.querySelectorAll(`main ${sel}`)]
        .filter((e) => e.checkVisibility({ visibilityProperty: true }) && !e.disabled)
        // Links inside running prose are exempt (inline text links).
        .filter((e) => !(e.tagName === 'A' && e.closest('.prose, p')))
        .map((e) => ({ e, ...box(e) }))
        .filter(({ w, h }) => w < 43.5 || h < 43.5)
        .map(({ e, w, h }) => ({
          where: e.closest('[data-tool-panel]') ? 'tool' : 'shell',
          id: e.id || null, cls: (e.getAttribute('class') || '').slice(0, 40), tag: e.tagName.toLowerCase(), type: e.getAttribute('type'),
          text: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30), w: Math.round(w), h: Math.round(h),
        }));
    });
