import { expect, test } from '@playwright/test';

test.describe('RSS feed', () => {
  test('includes atom:link rel="self" with xmlns declaration (regression for #2)', async ({
    request,
  }) => {
    const response = await request.get('/rss.xml');
    expect(response.status()).toBe(200);

    const body = await response.text();
    expect(body).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(body).toContain(
      '<atom:link href="https://coreymark.com/rss.xml" rel="self" type="application/rss+xml"/>'
    );
  });
});
