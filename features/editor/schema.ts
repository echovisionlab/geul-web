/** Durable Tiptap document contract for Post, Work, and Page authoring. */
import type { Editor as TiptapEditor } from '@tiptap/core';
import { externalVideoLinkLayoutPropSchema } from '@echovisionlab/geul-common/media/block-schemas';
import {
  baseBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
  defineEditorSchema,
  type DurableBlockSpec,
  type DurablePropSchema,
} from '@/lib/types/editor/schema';
import { fileBlockPropSchema } from '@/lib/media/block-schemas';
import { mapBlockPropSchema } from '@/lib/types/map-block/schema';

const textBlockProps = {
  backgroundColor: { default: 'default' },
  textColor: { default: 'default' },
  textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
} as const satisfies DurablePropSchema;

const editorBlockSpecs = {
  ...baseBlockSpecs,
  p5Sketch: {
    content: 'text*',
    props: {
      title: { default: '' },
      capabilities: { default: '' },
      mode: { default: 'edit', values: ['edit', 'source', 'preview'] },
      previewHeight: { default: 360, type: 'number' },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
  threeScene: {
    content: 'text*',
    props: {
      title: { default: '' },
      language: { default: 'typescript', values: ['javascript', 'typescript'] },
      mode: { default: 'edit', values: ['edit', 'source', 'preview'] },
      previewHeight: { default: 360, type: 'number' },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
  shader: {
    content:
      'shaderCommon shaderVertex shaderBufferA shaderBufferB shaderBufferC shaderBufferD shaderCubemap shaderSound shaderImage',
    props: {
      title: { default: '' },
      mode: { default: 'edit', values: ['edit', 'source', 'preview'] },
      previewHeight: { default: 360, type: 'number' },
      previewWidth: { default: '100' },
      textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
    },
  },
  math: { content: '', props: { latex: { default: '' } } },
  map: { content: '', props: mapBlockPropSchema },
  file: { content: '', props: fileBlockPropSchema },
} as const satisfies Record<string, DurableBlockSpec>;

const editorInlineContentSpecs = {
  ...defaultInlineContentSpecs,
  mathInline: { props: { latex: { default: '' } } },
} as const;

export const editorSchema = defineEditorSchema({
  blockSchema: editorBlockSpecs,
  inlineContentSchema: editorInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

/** Post/Page contract adds durable external-video layout to paragraph nodes. */
export const externalVideoEditorSchema = defineEditorSchema({
  blockSchema: {
    ...editorBlockSpecs,
    paragraph: {
      content: 'inline*',
      props: {
        ...textBlockProps,
        ...externalVideoLinkLayoutPropSchema,
      },
    },
  },
  inlineContentSchema: editorInlineContentSpecs,
  styleSchema: defaultStyleSpecs,
});

export type EditorBlockSchema = typeof editorSchema.blockSchema;
export type EditorInlineSchema = typeof editorSchema.inlineContentSchema;
export type EditorStyleSchema = typeof editorSchema.styleSchema;

export type Editor = TiptapEditor;
export type ExternalVideoEditor = TiptapEditor;
