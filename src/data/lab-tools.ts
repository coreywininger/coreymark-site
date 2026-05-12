export type Discipline = 'networking' | 'systems' | 'security' | 'devops' | 'cloud';

export type LabTool = {
  slug: string;
  title: string;
  description: string;
  discipline: Discipline;
  added: string;
  updated?: string;
  isNew?: boolean;
  icon: string;
};

export type DisciplineMeta = {
  id: Discipline;
  label: string;
  description: string;
};

export const disciplines: DisciplineMeta[] = [
  { id: 'networking', label: 'Networking', description: 'Addresses, ports, DNS, packets, routing.' },
  { id: 'systems',    label: 'Systems',    description: 'OS, shell, scheduling, processes, files.' },
  { id: 'security',   label: 'Security',   description: 'Crypto, certs, identity, secrets.' },
  { id: 'devops',     label: 'DevOps',     description: 'Code utilities, formats, CI/CD, containers.' },
  { id: 'cloud',      label: 'Cloud',      description: 'Cloud-specific calculators, cost, region tools.' },
];

export const tools: LabTool[] = [
  {
    slug: 'subnet',
    title: 'Subnet calculator',
    description:
      'IPv4 and IPv6 CIDR analysis with hosts-needed inverse, reverse DNS zones, and Cisco ACL syntax.',
    discipline: 'networking',
    added: '2026-05-09',
    isNew: true,
    icon: 'network',
  },
  {
    slug: 'cron',
    title: 'Cron decoder',
    description:
      'Decode any cron expression. Plain English, field breakdown, past and next fires around any pivot date, with translations to systemd, Kubernetes, GitHub Actions, and AWS EventBridge.',
    discipline: 'systems',
    added: '2026-05-09',
    isNew: true,
    icon: 'clock',
  },
  {
    slug: 'jwt',
    title: 'JWT decoder',
    description:
      'Decode JSON Web Tokens. Header, payload, claims with friendly tooltips, expiration countdown, algorithm warnings, and in-browser HMAC signature verification.',
    discipline: 'security',
    added: '2026-05-10',
    isNew: true,
    icon: 'key-round',
  },
  {
    slug: 'whatsmyip',
    title: "What's my IP?",
    description:
      "What the edge sees about your request — IP (v4/v6), decimal form, country + EU lookup, region, city, coordinates, ASN, Cloudflare colo, User-Agent. Powered by a tiny Worker at ip.coreymark.com.",
    discipline: 'networking',
    added: '2026-05-11',
    isNew: true,
    icon: 'network',
  },
  {
    slug: 'base64',
    title: 'Base64 encoder / decoder',
    description:
      'Encode or decode Base64 instantly — text, files, and data URIs. Standard and URL-safe variants, UTF-8 / emoji support, MIME detection from magic bytes, and line-wrap options. Nothing leaves your browser.',
    discipline: 'devops',
    added: '2026-05-12',
    isNew: true,
    icon: 'lock',
  },
];

export function toolsByDiscipline(d: Discipline): LabTool[] {
  return tools
    .filter((t) => t.discipline === d)
    .sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));
}

export function disciplineLabel(d: Discipline): string {
  return disciplines.find((x) => x.id === d)?.label ?? d;
}
