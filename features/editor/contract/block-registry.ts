import {
  pageColumnChildKinds,
  pageSectionCatalog,
  pageSectionFieldOwnership,
  pageSectionKinds,
  richTextBlockCatalog,
  richTextBlockFieldOwnership,
  richTextBlockKindByProtoCase,
  richTextBlockKinds,
  richTextProfiles,
  type PageSectionKind,
  type RichTextBlockKind,
} from '@echovisionlab/geul-proto/content/block_catalog.ts';
import { RichTextProfile } from '@echovisionlab/geul-proto/content/block_content_pb.ts';

export type ContentBlockProfile = keyof typeof richTextProfiles;
export type BlockFieldOwnership = 'shared' | 'locale' | 'source';

type RichTextNodeViewKey = 'code' | 'file' | 'map' | 'p5' | 'shader' | 'table' | 'three' | null;

type RichTextCommandKey = 'insert' | 'insert-table' | 'set-text-block';

interface RichTextAdapterRegistration {
  readonly tiptapNode: keyof typeof richTextBlockKindByProtoCase;
  readonly nodeView: RichTextNodeViewKey;
  readonly command: RichTextCommandKey;
  readonly publicRenderer: RichTextBlockKind;
}

/**
 * One compile-time exhaustive ownership table for every generated rich-text
 * Block kind. React components and extension instances are selected by these
 * stable keys; this module does not create React elements.
 */
export const richTextBlockRegistry = {
  paragraph: registration('paragraph', 'paragraph', null, 'set-text-block'),
  heading: registration('heading', 'heading', null, 'set-text-block'),
  'bullet-list-item': registration('bullet-list-item', 'bulletListItem', null, 'set-text-block'),
  'numbered-list-item': registration('numbered-list-item', 'numberedListItem', null, 'set-text-block'),
  'check-list-item': registration('check-list-item', 'checkListItem', null, 'set-text-block'),
  quote: registration('quote', 'quote', null, 'set-text-block'),
  'code-block': registration('code-block', 'codeBlock', 'code', 'set-text-block'),
  divider: registration('divider', 'divider', null, 'insert'),
  table: registration('table', 'table', 'table', 'insert-table'),
  'p5-sketch': registration('p5-sketch', 'p5Sketch', 'p5', 'insert'),
  'three-scene': registration('three-scene', 'threeScene', 'three', 'insert'),
  shader: registration('shader', 'shader', 'shader', 'insert'),
  math: registration('math', 'math', null, 'insert'),
  map: registration('map', 'map', 'map', 'insert'),
  file: registration('file', 'file', 'file', 'insert'),
  callout: registration('callout', 'callout', null, 'insert'),
} as const satisfies Record<RichTextBlockKind, RichTextAdapterRegistration>;

function registration<TKind extends RichTextBlockKind>(
  kind: TKind,
  tiptapNode: keyof typeof richTextBlockKindByProtoCase,
  nodeView: RichTextNodeViewKey,
  command: RichTextCommandKey,
) {
  return {
    tiptapNode,
    nodeView,
    command,
    publicRenderer: kind,
  } as const;
}

type PageContainerFamily = 'columns' | 'section';

interface PageSectionAdapterRegistration {
  readonly containerFamily: PageContainerFamily;
  readonly publicRenderer: PageSectionKind;
}

export const pageSectionRegistry = {
  'rich-text': pageRegistration('rich-text'),
  'external-video': pageRegistration('external-video'),
  'post-list': pageRegistration('post-list'),
  'post-table': pageRegistration('post-table'),
  'post-map': pageRegistration('post-map'),
  'work-map': pageRegistration('work-map'),
  'work-table': pageRegistration('work-table'),
  'work-list': pageRegistration('work-list'),
  'program-event-list': pageRegistration('program-event-list'),
  'release-list': pageRegistration('release-list'),
  'artist-list': pageRegistration('artist-list'),
  'label-list': pageRegistration('label-list'),
  'author-list': pageRegistration('author-list'),
  form: pageRegistration('form'),
  'text-marquee': pageRegistration('text-marquee'),
  'client-marquee': pageRegistration('client-marquee'),
  'label-marquee': pageRegistration('label-marquee'),
  map: pageRegistration('map'),
  'immersive-scene': pageRegistration('immersive-scene'),
  columns: pageRegistration('columns', 'columns'),
} as const satisfies Record<PageSectionKind, PageSectionAdapterRegistration>;

function pageRegistration<TKind extends PageSectionKind>(
  kind: TKind,
  containerFamily: PageContainerFamily = 'section',
) {
  return { containerFamily, publicRenderer: kind } as const;
}

function hasOwn<TObject extends object>(value: TObject, key: PropertyKey): key is keyof TObject {
  return Object.hasOwn(value, key);
}

export function requireRichTextBlockKind(value: string): RichTextBlockKind {
  if (!hasOwn(richTextBlockRegistry, value)) {
    throw new Error(`Unsupported rich-text Block kind: ${value}`);
  }
  return value;
}

export function requirePageSectionKind(value: string): PageSectionKind {
  if (!hasOwn(pageSectionRegistry, value)) {
    throw new Error(`Unsupported Page section kind: ${value}`);
  }
  return value;
}

export function assertRichTextProfileAllows(profile: ContentBlockProfile, kind: RichTextBlockKind): void {
  const allowed = richTextProfiles[profile].blocks as readonly RichTextBlockKind[];
  if (!allowed.includes(kind)) {
    throw new Error(`Rich-text profile ${profile} does not allow ${kind}`);
  }
}

/** Resolves a generated rich-text profile enum through the generated catalog. */
export function contentBlockProfileForRichTextProfile(profile: RichTextProfile): ContentBlockProfile | null {
  if (typeof profile !== 'number') {
    return null;
  }
  const generatedName = RichTextProfile[profile]?.toLowerCase();
  return generatedName && hasOwn(richTextProfiles, generatedName) ? generatedName : null;
}

export function profileSupportsParagraphExternalVideo(profile: ContentBlockProfile): boolean {
  return richTextProfiles[profile].paragraph_external_video === true;
}

export function requireHeadingLevel(value: number): 1 | 2 | 3 {
  if (value !== 1 && value !== 2 && value !== 3) {
    throw new Error(`Unsupported heading level: ${value}`);
  }
  return value;
}

export function richTextFieldOwnership(kind: RichTextBlockKind, field: string): BlockFieldOwnership {
  const ownership = richTextBlockFieldOwnership(kind, field);
  if (!ownership) {
    throw new Error(`Unknown ${kind} field: ${field}`);
  }
  return ownership;
}

export function pageFieldOwnership(kind: PageSectionKind, field: string): BlockFieldOwnership {
  const ownership = pageSectionFieldOwnership(kind, field);
  if (!ownership) {
    throw new Error(`Unknown ${kind} field: ${field}`);
  }
  return ownership;
}

type CatalogDefault = string | number | boolean | readonly string[];

function defaultsFromCatalog(fields: object): ReadonlyMap<string, CatalogDefault> {
  const defaults = new Map<string, CatalogDefault>();
  for (const [field, spec] of Object.entries(fields)) {
    if (!('default' in spec)) {
      continue;
    }
    const value = spec.default;
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      (Array.isArray(value) && value.every((item) => typeof item === 'string'))
    ) {
      defaults.set(field, value);
      continue;
    }
    throw new Error(`Unsupported generated default for field ${field}`);
  }
  return defaults;
}

export function richTextBlockDefaults(kind: RichTextBlockKind): ReadonlyMap<string, CatalogDefault> {
  return defaultsFromCatalog(richTextBlockCatalog[kind].fields);
}

export function pageSectionDefaults(kind: PageSectionKind): ReadonlyMap<string, CatalogDefault> {
  return defaultsFromCatalog(pageSectionCatalog[kind].fields);
}

const pageColumnChildKindSet: ReadonlySet<PageSectionKind> = new Set(pageColumnChildKinds);

export function assertPageContainerPlacement(parentKind: PageSectionKind | null, childKind: PageSectionKind): void {
  if (parentKind === null) {
    return;
  }
  if (parentKind !== 'columns' || !pageColumnChildKindSet.has(childKind)) {
    throw new Error(`Page section ${childKind} cannot be placed inside ${parentKind}`);
  }
}

export function assertNever(value: never, message: string): never {
  throw new Error(`${message}: ${String(value)}`);
}

// Static references keep generated catalogs and registries coupled even when
// consumers tree-shake helper functions.
void richTextBlockKinds;
void pageSectionKinds;
