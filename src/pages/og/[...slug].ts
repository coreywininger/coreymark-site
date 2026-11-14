import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import { OG_BG, OG_FONTS, OG_TITLE_COLOR, ogTopic } from '../../lib/og-config';

const posts = await getCollection('blog');

// Keep hyphenated words on one line ("30-minute", "AI-assisted"): titles
// wrap at spaces only. The font's subset has no glyph for the non-breaking
// hyphen (U+2011), which would print as an empty box, so the ordinary hyphen
// is kept and a zero-width word joiner (U+2060) after it forbids the break.
const WORD_JOINER = '\u2060';
const keepHyphenatedWords = (text: string) =>
  text.replace(/([\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, `$1-${WORD_JOINER}`);

const pages = Object.fromEntries(
  posts.map((post) => [post.id, { title: post.data.title, pillar: post.data.pillar }]),
);

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page) => {
    const topic = ogTopic(page.pillar);
    // Text is laid out from the top; the brand row sits at the bottom of the
    // background. Long titles step down a size so the two never meet.
    const size = page.title.length > 58 ? 54 : page.title.length > 36 ? 62 : 72;

    return {
      title: keepHyphenatedWords(page.title),
      description: topic.path,
      bgGradient: [OG_BG],
      bgImage: { path: topic.background, fit: 'cover' },
      padding: 88,
      font: {
        title: {
          color: OG_TITLE_COLOR,
          size,
          weight: 'Bold',
          families: ['Red Hat Display'],
          lineHeight: 1.12,
        },
        description: {
          color: topic.color,
          size: 26,
          weight: 'Medium',
          families: ['Red Hat Mono'],
          lineHeight: 1.4,
        },
      },
      fonts: OG_FONTS,
    };
  },
});
