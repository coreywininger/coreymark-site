// Reader-selectable themes and font sets. Single source for the picker UI
// and the pre-paint script in Base.astro. The CSS for each name lives in
// src/styles/global.css ([data-theme="…"], [data-font="…"]).

export interface ThemeOption {
  id: string;
  label: string;
  /** Page background, used for the swatch and <meta name="theme-color">. */
  bg: string;
  /** Four palette dots shown on the swatch. */
  dots: [string, string, string, string];
}

export const THEMES: ThemeOption[] = [
  { id: 'slate', label: 'Slate', bg: '#101822', dots: ['#76CCBF', '#8DAEE3', '#B99DD6', '#DDBC7E'] },
  { id: 'tokyo', label: 'Tokyo Night', bg: '#1B1C27', dots: ['#88A7E2', '#AFA1DB', '#8EC4E2', '#A2C080'] },
  { id: 'catppuccin', label: 'Catppuccin', bg: '#1F1F2E', dots: ['#BFA9E3', '#DE9BB0', '#95B3E8', '#A5D0A2'] },
  { id: 'dracula', label: 'Dracula', bg: '#282A36', dots: ['#DE93C3', '#B2A0E2', '#9BD2E0', '#7FCF96'] },
  { id: 'gruvbox', label: 'Gruvbox', bg: '#282726', dots: ['#DDB458', '#DA7867', '#94B68D', '#8EA69E'] },
  { id: 'ubuntu', label: 'Ubuntu terminal', bg: '#2B0D22', dots: ['#9ACB6A', '#E2D57E', '#88A8CE', '#78C6C6'] },
];

export const FONTS = [
  { id: 'redhat', label: 'Red Hat' },
  { id: 'plex', label: 'IBM Plex' },
  { id: 'geist', label: 'Geist' },
  { id: 'martian', label: 'Martian Mono + Geist' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
] as const;

export const DEFAULT_THEME = 'slate';
export const DEFAULT_FONT = 'redhat';

/** theme id → background hex, serialised into the pre-paint script. */
export const THEME_BG: Record<string, string> = Object.fromEntries(
  THEMES.map((t) => [t.id, t.bg]),
);
