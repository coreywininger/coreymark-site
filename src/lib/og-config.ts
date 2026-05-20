/** Pillar accent colors for OG image generation (RGB tuples for canvaskit). */
export const PILLAR_OG_ACCENT: Record<string, [number, number, number]> = {
  ops:      [217, 119,  87], // #D97757 rust
  business: [ 99, 102, 241], // #6366f1 indigo
  ai:       [ 45, 212, 191], // #2dd4bf teal
  cloud:    [ 59, 130, 246], // #3b82f6 blue
  personal: [139,  92, 246], // #8b5cf6 purple
};

export const PILLAR_OG_LABEL: Record<string, string> = {
  ops:      'IT Operations',
  business: 'Tech ↔ Business',
  ai:       'AI for IT',
  cloud:    'Hybrid Cloud',
  personal: 'Personal',
};

export const OG_DEFAULT_ACCENT: [number, number, number] = [45, 212, 191];

/** Inter font URLs fetched at build time from fontsource CDN. */
export const OG_FONTS = [
  'https://api.fontsource.org/v1/fonts/inter/latin-400-normal.ttf',
  'https://api.fontsource.org/v1/fonts/inter/latin-600-normal.ttf',
];
