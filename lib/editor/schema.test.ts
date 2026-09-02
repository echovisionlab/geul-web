import { describe, expect, it } from 'vitest';
import { externalVideoEditorSchema, editorSchema } from '@/features/editor/schema';
import { bioSchema, immersiveSceneDescriptionSchema } from '@/lib/types/editor/schema';

describe('durable editor schemas', () => {
  it('declares Tiptap as the only editor engine', () => {
    expect(editorSchema.engine).toBe('tiptap');
    expect(externalVideoEditorSchema.engine).toBe('tiptap');
    expect(bioSchema.engine).toBe('tiptap');
    expect(immersiveSceneDescriptionSchema.engine).toBe('tiptap');
  });

  it('preserves the Post/Page persisted block and inline node names', () => {
    expect(Object.keys(editorSchema.blockSchema).sort()).toEqual([
      'bulletListItem',
      'callout',
      'checkListItem',
      'codeBlock',
      'divider',
      'file',
      'heading',
      'map',
      'math',
      'numberedListItem',
      'p5Sketch',
      'paragraph',
      'quote',
      'shader',
      'table',
      'threeScene',
    ]);
    expect(Object.keys(editorSchema.inlineContentSchema)).toEqual(['text', 'link', 'mathInline']);
  });

  it('keeps executable source blocks in the main editor with text source and presentation attrs', () => {
    expect(editorSchema.blockSchema.codeBlock).toEqual({
      content: 'text*',
      props: {
        title: { default: '' },
        language: { default: 'javascript' },
        previewWidth: { default: '100' },
        textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
      },
    });
    expect(editorSchema.blockSchema.p5Sketch).toEqual({
      content: 'text*',
      props: {
        capabilities: { default: '' },
        mode: { default: 'edit', values: ['edit', 'source', 'preview'] },
        previewHeight: { default: 360, type: 'number' },
        previewWidth: { default: '100' },
        textAlignment: { default: 'left', values: ['left', 'center', 'right'] },
        title: { default: '' },
      },
    });
    expect(editorSchema.blockSchema.threeScene.props.language).toEqual({
      default: 'typescript',
      values: ['javascript', 'typescript'],
    });
    expect(editorSchema.blockSchema.shader.content).toBe(
      'shaderCommon shaderVertex shaderBufferA shaderBufferB shaderBufferC shaderBufferD shaderCubemap shaderSound shaderImage',
    );
    expect(bioSchema.blockSchema).not.toHaveProperty('shader');
  });

  it('keeps external-video layout attributes limited to Post/Page paragraphs', () => {
    expect(editorSchema.blockSchema.paragraph.props).not.toHaveProperty('previewWidth');
    expect(editorSchema.blockSchema.paragraph.props).not.toHaveProperty('aspectRatio');
    expect(externalVideoEditorSchema.blockSchema.paragraph.props).toMatchObject({
      previewWidth: { default: '100' },
      aspectRatio: { default: 'auto', values: ['auto', '16:9', '4:3', '1:1', '9:16'] },
    });
  });

  it('keeps restricted schemas restricted', () => {
    expect(Object.keys(bioSchema.blockSchema)).toEqual(['paragraph', 'divider']);
    expect(Object.keys(immersiveSceneDescriptionSchema.blockSchema)).toEqual([
      'paragraph',
      'heading',
      'bulletListItem',
      'numberedListItem',
    ]);
  });
});
