export type Discipline = 'networking' | 'systems' | 'security' | 'devops' | 'cloud';

export type LabTool = {
  slug: string;
  title: string;
  description: string;
  /** One line for cards on the Lab index. */
  blurb: string;
  discipline: Discipline;
  added: string;
  updated?: string;
  icon: string;
  /** Short example shown on tool tiles: what you type… */
  sampleInput?: string;
  /** …and what you get back. */
  sampleOutput?: string;
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
    blurb: 'Network, broadcast, usable range and host count for any IPv4 or IPv6 block.',
    description:
      'IPv4 and IPv6 CIDR analysis with hosts-needed inverse, reverse DNS zones, and Cisco ACL syntax.',
    discipline: 'networking',
    added: '2026-05-09',
    icon: 'network',
    sampleInput: '10.0.0.0/22',
    sampleOutput: '1,022 usable hosts',
  },
  {
    slug: 'cron',
    title: 'Cron decoder',
    blurb: 'Turns a cron expression into plain English and shows the next run times.',
    description:
      'Decode any cron expression. Plain English, field breakdown, past and next fires around any pivot date, with translations to systemd, Kubernetes, GitHub Actions, and AWS EventBridge.',
    discipline: 'systems',
    added: '2026-05-09',
    icon: 'clock',
    sampleInput: '0 7 * * 1-5',
    sampleOutput: '7:00 AM, Monday to Friday',
  },
  {
    slug: 'jwt',
    title: 'JWT decoder',
    blurb: 'Splits a token into header and claims, and flags expiry problems.',
    description:
      'Decode JSON Web Tokens. Header, payload, claims with friendly tooltips, expiration countdown, algorithm warnings, and in-browser HMAC signature verification.',
    discipline: 'security',
    added: '2026-05-10',
    icon: 'key-round',
    sampleInput: 'eyJhbGciOiJIUzI1NiJ9…',
    sampleOutput: 'Header, claims, expiry',
  },
  {
    slug: 'whatsmyip',
    title: "What's my IP?",
    blurb: 'Your public IP and what your request looks like from the outside.',
    description:
      "What the edge sees about your request — IP (v4/v6), decimal form, country + EU lookup, region, city, coordinates, ASN, Cloudflare colo, User-Agent. Powered by a tiny Worker at ip.coreymark.com.",
    discipline: 'networking',
    added: '2026-05-11',
    icon: 'network',
    sampleInput: 'curl ip.coreymark.com',
    sampleOutput: 'Public IP, headers, TLS',
  },
  {
    slug: 'base64',
    title: 'Base64 encoder / decoder',
    blurb: 'Encode or decode Base64 text and files, with URL-safe mode.',
    description:
      'Encode or decode Base64 instantly — text, files, and data URIs. Standard and URL-safe variants, UTF-8 / emoji support, MIME detection from magic bytes, and line-wrap options. Nothing leaves your browser.',
    discipline: 'devops',
    added: '2026-05-12',
    icon: 'lock',
    sampleInput: 'aGVsbG8gd29ybGQ=',
    sampleOutput: 'hello world',
  },
  {
    slug: 'regex',
    title: 'Regex tester',
    blurb: 'Test a pattern against sample text and see matches as you type.',
    description:
      'Test regular expressions live — match highlighting, capture groups, global/case/multiline flags, replace mode, backtracking warnings, presets, and history.',
    discipline: 'devops',
    added: '2026-05-12',
    icon: 'regex',
    sampleInput: '^\\d{3}-\\d{4}$',
    sampleOutput: 'Matches as you type',
  },
  {
    slug: 'json-yaml',
    title: 'JSON ↔ YAML converter',
    blurb: 'Convert between JSON and YAML, both directions, with error lines.',
    description:
      'Convert between JSON and YAML instantly — auto-detects input format, handles K8s manifests and Ansible configs, offers indent control and schema options. Offline, nothing leaves your browser.',
    discipline: 'devops',
    added: '2026-05-12',
    icon: 'arrow-left-right',
    sampleInput: '{"replicas": 3}',
    sampleOutput: 'replicas: 3',
  },
  {
    slug: 'cert-decoder',
    title: 'X.509 certificate decoder',
    blurb: 'Reads a PEM certificate: issuer, names, key and expiry date.',
    description:
      'Decode PEM certificates — subject, issuer, validity window with live expiry status, key type and size, Subject Alternative Names, CA flag, serial number, and signature algorithm. Nothing leaves your browser.',
    discipline: 'security',
    added: '2026-05-17',
    icon: 'shield-check',
    sampleInput: '-----BEGIN CERTIFICATE-----',
    sampleOutput: 'Issuer, names, expiry date',
  },
  {
    slug: 'http-status',
    title: 'HTTP Status Reference',
    blurb: 'Every status code, what it means, and when you will see it.',
    description:
      'Searchable 1xx–5xx reference. Plain-English descriptions, common causes, and curl test commands for every standard code.',
    discipline: 'devops',
    added: '2026-05-18',
    icon: 'file-question-mark',
    sampleInput: '429',
    sampleOutput: 'Too Many Requests',
  },
];

/** Palette token per discipline (tile, tag and card accents). */
export const disciplineColor: Record<Discipline, string> = {
  networking: 'cyan',
  systems: 'green',
  security: 'red',
  devops: 'magenta',
  cloud: 'blue',
};

export function toolsByDiscipline(d: Discipline): LabTool[] {
  return tools
    .filter((t) => t.discipline === d)
    .sort((a, b) => (a.added < b.added ? 1 : a.added > b.added ? -1 : 0));
}

export function disciplineLabel(d: Discipline): string {
  return disciplines.find((x) => x.id === d)?.label ?? d;
}

export function isToolNew(added: string): boolean {
  return Date.now() - new Date(added).getTime() < 30 * 24 * 60 * 60 * 1000;
}

export function isNewPost(pubDate: Date | string): boolean {
  return Date.now() - new Date(pubDate).getTime() < 14 * 24 * 60 * 60 * 1000;
}
