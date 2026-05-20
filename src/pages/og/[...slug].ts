import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import {
  PILLAR_OG_ACCENT,
  PILLAR_OG_LABEL,
  OG_DEFAULT_ACCENT,
  OG_FONTS,
} from '../../lib/og-config';

const posts = await getCollection('blog');

const pages = Object.fromEntries(
  posts.map((post) => [
    post.id,
    {
      title:       post.data.title,
      description: post.data.description ?? '',
      pillar:      post.data.pillar ?? '',
    },
  ])
);

export const { getStaticPaths, GET } = await OGImageRoute({
  param: 'slug',
  pages,
  getImageOptions: (_path, page) => {
    const accent = PILLAR_OG_ACCENT[page.pillar] ?? OG_DEFAULT_ACCENT;
    const pillarLabel = PILLAR_OG_LABEL[page.pillar] ?? '';

    return {
      title: page.title,
      description: pillarLabel,
      bgGradient: [
        [20,  20, 19],
        [26,  25, 23],
      ],
      border: {
        color: accent,
        width: 8,
        side:  'inline-start',
      },
      padding: 80,
      font: {
        title: {
          color:    [240, 236, 228],
          size:     52,
          weight:   'SemiBold',
          families: ['Inter'],
          lineHeight: 1.3,
        },
        description: {
          color:    accent,
          size:     22,
          weight:   'Normal',
          families: ['Inter'],
        },
      },
      fonts: OG_FONTS,
    };
  },
});
