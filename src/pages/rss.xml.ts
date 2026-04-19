import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { publishedOnly, sortByPubDateDesc } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', publishedOnly);
  const sorted = sortByPubDateDesc(posts);

  return rss({
    title: 'Corey Wininger',
    description:
      'Writing on IT operations, translating tech to the business, AI for IT, and hybrid cloud.',
    site: context.site ?? 'https://coreymark.com',
    items: sorted.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      categories: [post.data.pillar, ...post.data.tags],
    })),
    customData: '<language>en-us</language>',
  });
}
