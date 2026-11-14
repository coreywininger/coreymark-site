// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

const SANS = ['system-ui', '-apple-system', 'Segoe UI', 'sans-serif'];
const MONO = ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'];

/**
 * @param {string} name
 * @param {`--${string}`} cssVariable
 * @param {[string, ...string[]]} weights
 * @param {string[]} fallbacks
 */
const font = (name, cssVariable, weights, fallbacks) => ({
  name,
  cssVariable,
  provider: fontProviders.google(),
  weights,
  styles: /** @type {['normal']} */ (['normal']),
  subsets: /** @type {['latin']} */ (['latin']),
  fallbacks,
});

// https://astro.build/config
export default defineConfig({
  site: 'https://coreymark.com',

  build: {
    // Inline all stylesheets into the HTML. Total CSS is ~7.3KB — below any
    // reasonable threshold where a separate request would be worthwhile, and
    // the render-blocking <link> was costing ~590ms on desktop Lighthouse.
    inlineStylesheets: 'always',
  },

  markdown: {
    shikiConfig: {
      // Single dark theme. defaultColor: false emits --shiki-dark /
      // --shiki-dark-bg variables instead of inline colors; global.css applies
      // them and swaps the block background for the active theme's surface.
      themes: { dark: 'github-dark' },
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [mdx(), sitemap()],

  // Five reader-selectable font sets (see [data-font] in global.css). Every
  // family is self-hosted by the fonts API. Only the Red Hat set is preloaded
  // (Base.astro); the others are @font-face declarations only, so the browser
  // fetches them only once a reader picks that set.
  fonts: [
    font('Red Hat Display', '--af-redhat-display', ['500 800'], SANS),
    font('Red Hat Text', '--af-redhat-text', ['400 600'], SANS),
    font('Red Hat Mono', '--af-redhat-mono', ['400 500'], MONO),
    font('IBM Plex Sans', '--af-plex-sans', ['400 700'], SANS),
    font('IBM Plex Mono', '--af-plex-mono', ['400', '500'], MONO),
    font('Geist', '--af-geist', ['400 700'], SANS),
    font('Geist Mono', '--af-geist-mono', ['400 500'], MONO),
    font('Martian Mono', '--af-martian-mono', ['400 600'], MONO),
    font('JetBrains Mono', '--af-jetbrains-mono', ['400 700'], MONO),
  ],
});
