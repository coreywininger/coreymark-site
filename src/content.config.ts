import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(160),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    pillar: z.enum(['ops', 'business', 'ai', 'cloud', 'personal']),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    heroImage: z.string().optional(),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    pubDate: z.coerce.date(),
    stack: z.array(z.string()).default([]),
    links: z
      .object({
        live: z.string().optional(),
        repo: z.string().optional(),
        writeup: z.string().optional(),
      })
      .default({}),
    status: z.enum(['live', 'wip', 'archived']),
    featured: z.boolean().default(false),
    heroImage: z.string().optional(),
  }),
});

const now = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/now' }),
  schema: z.object({
    updatedDate: z.coerce.date(),
    title: z.string().default('Now'),
  }),
});

export const collections = { blog, projects, now };

export const PILLAR_META: Record<
  'ops' | 'business' | 'ai' | 'cloud' | 'personal',
  { label: string; description: string }
> = {
  ops: {
    label: 'IT Operations',
    description: 'Running infrastructure with discipline — incident, change, and the boring stuff that keeps the business running.',
  },
  business: {
    label: 'Tech ↔ Business',
    description: 'Translating engineering reality to leadership — and leadership expectations back to engineering.',
  },
  ai: {
    label: 'AI for IT',
    description: 'Putting AI to work in enterprise IT — and being honest about what it won\u2019t do.',
  },
  cloud: {
    label: 'Hybrid Cloud',
    description: 'Workload placement, cost, and keeping hybrid architectures honest.',
  },
  personal: {
    label: 'Personal',
    description: 'Weekend projects, home lab, and the occasional detour.',
  },
};

export type Pillar = keyof typeof PILLAR_META;
