// The six topics on the homepage map: the five blog pillars plus the Lab.
// Single place for topic label, color and blurb; later pages (post layout,
// writing index) read the same mapping.
import type { Pillar } from '../content.config';

export interface Topic {
  /** Blog pillar id, or 'lab'. */
  id: Pillar | 'lab';
  label: string;
  /** URL-style name used in breadcrumbs, e.g. it-and-the-business. */
  slug: string;
  /** Palette token: cyan, blue, magenta, green, yellow, red. */
  color: string;
  blurb: string;
  /** Node position on the map, in a 560 x 440 space (hub at 280, 220). */
  x: number;
  y: number;
}

export const TOPICS: Topic[] = [
  { id: 'ops', label: 'Operations', slug: 'operations', color: 'cyan', blurb: 'How IT teams actually run day to day.', x: 120, y: 90 },
  { id: 'business', label: 'IT and the business', slug: 'it-and-the-business', color: 'blue', blurb: 'Saying what IT means in terms leaders use.', x: 430, y: 90 },
  { id: 'ai', label: 'AI', slug: 'ai', color: 'magenta', blurb: 'What AI changes for people who run IT, minus the hype.', x: 470, y: 250 },
  { id: 'cloud', label: 'Cloud', slug: 'cloud', color: 'green', blurb: 'Where workloads belong and what they cost.', x: 390, y: 375 },
  { id: 'personal', label: 'Projects and notes', slug: 'projects-and-notes', color: 'yellow', blurb: 'Write-ups of things I built.', x: 160, y: 365 },
  { id: 'lab', label: 'Lab', slug: 'lab', color: 'red', blurb: 'Small browser tools. Nothing leaves your machine.', x: 90, y: 230 },
];

export const topicFor = (id: Topic['id']): Topic => TOPICS.find((t) => t.id === id)!;

/** Where "everything in this topic" lives. */
export const topicHref = (id: Topic['id']): string =>
  id === 'lab' ? '/lab/' : `/blog/?topic=${id}`;
