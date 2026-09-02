/**
 * Durable editor document contract.
 *
 * These descriptors describe the ProseMirror wire document independently from
 * any React editor implementation. They are the source for Tiptap extensions,
 * conversion, and editor capability checks; they are not runtime extensions.
 */
import type { Editor as TiptapEditor } from '@tiptap/core';

export type DurablePropValue = string | number | boolean | null | undefined;

export type DurablePropSpec = Readonly<{
  default?: DurablePropValue;
  type?: 'boolean' | 'number' | 'string';
  values?: readonly DurablePropValue[];
}>;

export type DurablePropSchema = Readonly<Record<string, DurablePropSpec>>;

export type DurableBlockSpec = Readonly<{
  content: string;
  props: DurablePropSchema;
}>;

export type DurableInlineContentSpec = Readonly<{
  props?: DurablePropSchema;
}>;

export type DurableStyleSpec = Readonly<Record<string, never>>;

export type DurableEditorSchema<
  TBlocks extends Record<string, DurableBlockSpec>,
  TInline extends Record<string, DurableInlineContentSpec>,
  TStyles extends Record<string, DurableStyleSpec>,
> = Readonly<{
  engine: 'tiptap';
  blockSchema: TBlocks;
  inlineContentSchema: TInline;
  styleSchema: TStyles;
}>;

export function defineEditorSchema<
  const TBlocks extends Record<string, DurableBlockSpec>,
  const TInline extends Record<string, DurableInlineContentSpec>,
  const TStyles extends Record<string, DurableStyleSpec>,
>({
  blockSchema,
  inlineContentSchema,
  styleSchema,
}: Omit<DurableEditorSchema<TBlocks, TInline, TStyles>, 'engine'>): DurableEditorSchema<TBlocks, TInline, TStyles> {
  return {
    engine: 'tiptap',
    blockSchema,
    inlineContentSchema,
    styleSchema,
  };
}

const textBlockProps = {
  backgroundColor: { default: 'default' },
  textColor: { default: 'default' },
  textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
} as const satisfies DurablePropSchema;

/**
 * Standard durable block nodes. Toggle list and image are deliberately absent:
 * they are not supported by Geul's durable document contract.
 */
export const baseBlockSpecs = {
  paragraph: { content: 'inline*', props: textBlockProps },
  heading: {
    content: 'inline*',
    props: {
      ...textBlockProps,
      level: { default: 1, type: 'number', values: [1, 2, 3] },
    },
  },
  bulletListItem: { content: 'inline*', props: textBlockProps },
  numberedListItem: {
    content: 'inline*',
    props: { ...textBlockProps, start: { default: undefined, type: 'number' } },
  },
  checkListItem: {
    content: 'inline*',
    props: { ...textBlockProps, checked: { default: false, type: 'boolean' } },
  },
  codeBlock: {
    content: 'text*',
    props: {
      title: { default: '' },
      language: { default: 'javascript' },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
  quote: {
    content: 'inline*',
    props: {
      backgroundColor: { default: 'default' },
      textColor: { default: 'default' },
    },
  },
  divider: { content: '', props: {} },
  file: {
    content: '',
    props: {
      backgroundColor: { default: 'default' },
      name: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
      width: { default: '0' },
      height: { default: '0' },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
  callout: {
    content: 'inline*',
    props: {
      icon: { default: '💡' },
      backgroundColor: { default: 'gray' },
      textColor: { default: 'default' },
    },
  },
  table: {
    content: 'tableRow+',
    props: {
      textColor: { default: 'default' },
      previewWidth: { default: 100, type: 'number' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
} as const satisfies Record<string, DurableBlockSpec>;

export const defaultInlineContentSpecs = {
  text: {},
  link: { props: { href: { default: null } } },
} as const satisfies Record<string, DurableInlineContentSpec>;

export const defaultStyleSpecs = {
  bold: {},
  italic: {},
  underline: {},
  strike: {},
  code: {},
  textColor: {},
  backgroundColor: {},
} as const satisfies Record<string, DurableStyleSpec>;

/** Artist bios only allow paragraph and divider nodes. */
export const artistBioBlockSpecs = {
  paragraph: baseBlockSpecs.paragraph,
  divider: baseBlockSpecs.divider,
} as const;

/** Immersive-scene copy has no media or embeds. */
export const immersiveSceneDescriptionBlockSpecs = {
  paragraph: baseBlockSpecs.paragraph,
  heading: {
    content: 'inline*',
    props: {
      ...baseBlockSpecs.heading.props,
      level: { default: 1, type: 'number', values: [1, 2, 3] },
    },
  },
  bulletListItem: baseBlockSpecs.bulletListItem,
  numberedListItem: baseBlockSpecs.numberedListItem,
} as const;

const immersiveSceneDescriptionStyleSpecs = {
  bold: defaultStyleSpecs.bold,
  italic: defaultStyleSpecs.italic,
  strike: defaultStyleSpecs.strike,
} as const;

export interface LooseBlock {
  id: string;
  type: string;
  props: Record<string, unknown>;
  content?: unknown;
  children: LooseBlock[];
}

const restrictedRichTextBlockSpecs = {
  paragraph: baseBlockSpecs.paragraph,
  heading: baseBlockSpecs.heading,
  bulletListItem: baseBlockSpecs.bulletListItem,
  numberedListItem: baseBlockSpecs.numberedListItem,
  checkListItem: baseBlockSpecs.checkListItem,
  quote: baseBlockSpecs.quote,
  codeBlock: baseBlockSpecs.codeBlock,
  divider: baseBlockSpecs.divider,
  table: baseBlockSpecs.table,
  callout: baseBlockSpecs.callout,
} as const satisfies Record<string, DurableBlockSpec>;

const richTextInlineContentSpecs = defaultInlineContentSpecs;

/** Policy editor document capabilities. */
export const policySchema = defineEditorSchema({
  blockSchema: restrictedRichTextBlockSpecs,
  inlineContentSchema: richTextInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

export type PolicyEditorInstance = TiptapEditor;

/** Email template editor document capabilities. */
export const emailTemplateSchema = defineEditorSchema({
  blockSchema: restrictedRichTextBlockSpecs,
  inlineContentSchema: richTextInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

export type EmailTemplateEditorInstance = TiptapEditor;

/** Campaign editor document capabilities. */
export const campaignSchema = defineEditorSchema({
  blockSchema: restrictedRichTextBlockSpecs,
  inlineContentSchema: richTextInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

export type CampaignEditorInstance = TiptapEditor;

/** Artist, release, and label description editor capabilities. */
export const bioSchema = defineEditorSchema({
  blockSchema: artistBioBlockSpecs,
  inlineContentSchema: defaultInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

export type BioEditorInstance = TiptapEditor;

/** Markdown-preserving capabilities for immersive scene unit copy. */
export const immersiveSceneDescriptionSchema = defineEditorSchema({
  blockSchema: immersiveSceneDescriptionBlockSpecs,
  inlineContentSchema: defaultInlineContentSpecs,
  styleSchema: immersiveSceneDescriptionStyleSpecs,
});

export type ImmersiveSceneDescriptionEditorInstance = TiptapEditor;
