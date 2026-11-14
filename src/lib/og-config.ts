// Per-post Open Graph cards (src/pages/og/[...slug].ts).
//
// Each card is a pre-rendered Slate background for the post's pillar
// (src/assets/og/bg-<pillar>.png, made by scripts/build-brand-assets.mjs:
// grid, glow, and a bottom row with the brand mark and topic chip) with the
// title and a `~/writing/<pillar-slug>` line drawn at the top at build time.
// Topic labels, slugs and colors come from src/data/topics.ts.
import { TOPICS, type Topic } from '../data/topics';

type RGB = [number, number, number];

/** Slate palette as RGB (OG cards are always Slate). */
const SLATE: Record<string, RGB> = {
  bg: [16, 24, 34],
  text: [220, 228, 235],
  text2: [176, 189, 202],
  red: [227, 141, 149],
  green: [127, 204, 165],
  yellow: [221, 188, 126],
  blue: [141, 174, 227],
  magenta: [185, 157, 214],
  cyan: [118, 204, 191],
};

export const OG_BG: RGB = SLATE.bg;
export const OG_TITLE_COLOR: RGB = SLATE.text;

export interface OgTopic {
  /** e.g. "~/writing/it-and-the-business" */
  path: string;
  color: RGB;
  background: string;
}

const FALLBACK: Topic = TOPICS[0];

export function ogTopic(pillar: string): OgTopic {
  const topic = TOPICS.find((t) => t.id === pillar && t.id !== 'lab') ?? FALLBACK;
  return {
    path: `~/writing/${topic.slug}`,
    color: SLATE[topic.color] ?? SLATE.cyan,
    background: `./src/assets/og/bg-${topic.id}.png`,
  };
}

/** Red Hat fonts as TTF, fetched at build time (CanvasKit needs TTF/OTF). */
export const OG_FONTS = [
  'https://api.fontsource.org/v1/fonts/red-hat-display/latin-700-normal.ttf',
  'https://api.fontsource.org/v1/fonts/red-hat-mono/latin-500-normal.ttf',
];
