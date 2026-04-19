import type { CollectionEntry } from 'astro:content';

/**
 * Filter passed to `getCollection` / `getStaticPaths`.
 *
 * Drafts are visible in dev (so layout and content can be reviewed) but
 * excluded from production builds — they don't generate HTML, don't land
 * in the sitemap, don't show up in listings, and don't appear in RSS.
 */
export const publishedOnly = (entry: { data: { draft?: boolean } }) =>
  import.meta.env.PROD ? !entry.data.draft : true;

export const sortByPubDateDesc = <T extends CollectionEntry<'blog' | 'projects'>>(
  entries: T[],
): T[] =>
  [...entries].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
