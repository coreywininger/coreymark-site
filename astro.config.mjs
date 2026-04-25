// @ts-check
import { defineConfig, fontProviders } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';

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
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      // defaultColor: false emits per-theme CSS variables (--shiki-light,
      // --shiki-dark, etc.) on <pre> and <span>, with no default applied.
      // The selector pair in global.css picks the right one based on
      // [data-theme] on <html>.
      defaultColor: false,
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [mdx(), sitemap(), react()],

  fonts: [
    {
      name: 'Inter',
      cssVariable: '--font-sans',
      provider: fontProviders.google(),
      weights: ['400', '500', '600', '700'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
    },
    {
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      provider: fontProviders.google(),
      weights: ['400', '500'],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
    },
  ],
});
