import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';
import { publishedOnly, sortByPubDateDesc } from '../lib/content';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', publishedOnly);
  const sorted = sortByPubDateDesc(posts);

  const site = context.site?.toString().replace(/\/$/, '') ?? 'https://coreymark.com';

  return rss({
    title: 'Corey Wininger',
    description:
      'Writing on IT operations, translating tech to the business, AI for IT, and hybrid cloud.',
    site,
    xmlns: { atom: 'http://www.w3.org/2005/Atom' },
    items: sorted.map((post) => ({
      title: post.data.title,
      pubDate: post.data.pubDate,
      description: post.data.description,
      link: `/blog/${post.id}/`,
      categories: [post.data.pillar, ...post.data.tags],
    })),
    customData: `<language>en-us</language><atom:link href="${site}/rss.xml" rel="self" type="application/rss+xml" />`,
  });
}
