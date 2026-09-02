import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapSlashItems } from './tiptap/TiptapAuthoringControls';
import { filterContentBlockTypeMenuItems } from './contentBlockTypeMenuPolicy';

const editorMessages = enMessages.editorCommon.editor;

describe('Tiptap content block type policy', () => {
  it('allows only the durable rich-text block commands, including H1-H3', () => {
    const items = filterContentBlockTypeMenuItems(createTiptapSlashItems(editorMessages));

    expect(items.map((item) => item.key)).toEqual([
      'heading',
      'heading_2',
      'heading_3',
      'quote',
      'callout',
      'numbered_list',
      'bullet_list',
      'check_list',
      'paragraph',
      'code_block',
      'divider',
    ]);
  });

  it('does not infer optional media, map, math, AI, or external-video capability from the content policy', () => {
    const items = filterContentBlockTypeMenuItems(
      createTiptapSlashItems(editorMessages, {
        math: true,
        map: true,
        file: true,
        ai: true,
        externalVideo: true,
      }),
    );

    expect(items.map((item) => item.key)).not.toEqual(
      expect.arrayContaining(['math', 'inline-math', 'map', 'file', 'ai', 'external-video']),
    );
  });
});
