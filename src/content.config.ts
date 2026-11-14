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
    project: z.string().optional(),
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
    /** Overrides the default status wording, e.g. "Rebuilding" for wip. */
    statusLabel: z.string().optional(),
    /** One line for the homepage inventory table; falls back to summary. */
    tagline: z.string().optional(),
    /** Where it runs, lowercase, e.g. "github actions · claude". */
    runsOn: z.string().default(''),
    featured: z.boolean().default(false),
    heroImage: z.string().optional(),
    /** Projects index card: description and up to ~4 stack chips. */
    card: z.string().optional(),
    highlights: z.array(z.string()).optional(),
    /** Projects index card: decorative terminal readout. */
    readout: z
      .object({
        label: z.string(),
        lines: z.array(
          z.object({ text: z.string(), tone: z.enum(['muted', 'ok', 'info', 'plain']).default('plain') }),
        ),
      })
      .optional(),
    /** Detail page hero paragraph; falls back to card, then summary. */
    lede: z.string().optional(),
    /** Detail page "at a glance" tiles. */
    facts: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
    /** Detail page "How it works" steps. */
    steps: z.array(z.object({ title: z.string(), text: z.string() })).default([]),
    /** Detail page "Why I built it" paragraphs. */
    why: z.array(z.string()).default([]),
  }),
});

const now = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/now' }),
  schema: z.object({
    updatedDate: z.coerce.date(),
    title: z.string().default('Now'),
    // Structured sections: the single source for the /now/ page and the
    // homepage ~/now status panel.
    sections: z
      .array(
        z.object({
          label: z.string(),
          status: z.enum(['progress', 'running', 'job', 'next']),
          items: z.array(z.object({ title: z.string(), note: z.string() })),
        }),
      )
      .default([]),
  }),
});

export const collections = { blog, projects, now };

/** Blog pillar ids. Labels, colors and blurbs live in src/data/topics.ts. */
export type Pillar = 'ops' | 'business' | 'ai' | 'cloud' | 'personal';
