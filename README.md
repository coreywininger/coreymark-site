# coreymark-site

Source for [coreymark.com](https://coreymark.com) — my personal site, blog, and project portfolio.

Built with [Astro](https://astro.build/) (TypeScript), styled with Tailwind v4, deployed to [Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/) with Cloudflare DNS in front. Infrastructure is managed in Terraform under [`terraform/`](./terraform/).

A field report on what it actually took to ship this site with AI assistance is at [coreymark.com/blog/shipping-a-site-with-ai-field-report](https://coreymark.com/blog/shipping-a-site-with-ai-field-report).

## Quick start

```bash
npm install
npx playwright install          # download browser binaries (required once; re-run after Playwright upgrades)
npm run dev      # local dev server at http://localhost:4321
npm run build    # production build → dist/
npm test         # Playwright end-to-end tests
```

Requires Node 22 or newer.

## Repo layout

- `src/` — Astro pages, layouts, components, and content collections (blog + projects).
- `public/` — static assets served as-is (favicon, manifest, images).
- `scripts/` — build-time helpers (e.g., OG image generation).
- `tests/` — Playwright end-to-end tests.
- `terraform/` — IaC for Azure Static Web Apps and custom-domain bindings.
- `.github/workflows/` — Azure Static Web Apps deploy workflow plus issue templates.

## Deploy

Pushes to `main` trigger the Azure Static Web Apps GitHub Actions workflow, which builds and deploys the site. Cloudflare proxies the apex domain (`coreymark.com`) and the `www` subdomain; `www` 301-redirects to apex.

## License

Code in this repository is licensed under [MIT](./LICENSE). Written content under `src/content/` is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — quote, share, or adapt with attribution. Photographs and personal images are © Corey Wininger, all rights reserved. See [`LICENSE`](./LICENSE) for details.

Sharing as a reference pattern. Not accepting contributions.
