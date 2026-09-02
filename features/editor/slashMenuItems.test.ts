import { describe, expect, it } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapSlashItems } from './tiptap/TiptapAuthoringControls';
import { filterContentTiptapSlashItems } from './slashMenuItems';

const editorMessages = enMessages.editorCommon.editor;

describe('Tiptap content slash-menu policy', () => {
  it('keeps native commands and preserves capability items for the owning profile to mark unavailable', () => {
    const items = filterContentTiptapSlashItems(
      createTiptapSlashItems(editorMessages, { map: true, file: true, ai: true, externalVideo: true }),
    );

    expect(items.find((item) => item.key === 'heading')).toMatchObject({ enabled: true });
    expect(items.find((item) => item.key === 'map')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
    expect(items.find((item) => item.key === 'file')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
    expect(items.find((item) => item.key === 'ai')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
    expect(items.find((item) => item.key === 'external-video')).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
  });
});
