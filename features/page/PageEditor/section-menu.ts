import type { SectionType } from './types';

// Menu order is independent of schema registration and translated labels.
export const SECTION_MENU = [
  'rich-text',
  'columns',
  'external-video',
  'post-list',
  'post-table',
  'post-map',
  'work-list',
  'work-table',
  'work-map',
  'program-event-list',
  'release-list',
  'artist-list',
  'author-list',
  'label-list',
  'text-marquee',
  'client-marquee',
  'label-marquee',
  'form',
  'map',
  'mermaid',
  'immersive-scene',
] as const satisfies readonly SectionType[];

const columnTypes: ReadonlySet<SectionType> = new Set([
  'rich-text',
  'external-video',
  'post-list',
  'post-table',
  'work-list',
  'work-table',
  'work-map',
  'program-event-list',
  'release-list',
  'artist-list',
  'author-list',
  'label-list',
  'text-marquee',
  'client-marquee',
  'label-marquee',
]);

export const COLUMN_SECTION_MENU = SECTION_MENU.filter((type) => columnTypes.has(type));
