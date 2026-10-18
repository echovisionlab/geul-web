import { expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import { createTiptapSlashItems } from './TiptapAuthoringControls';

const enEditorMessages = enMessages.editorCommon.editor;

it('keeps promised but unbound capabilities visible as explicit unavailable items', () => {
  const unavailableItems = createTiptapSlashItems(enEditorMessages, {
    ai: true,
    externalVideo: true,
    map: true,
    table: true,
  });
  for (const key of ['ai', 'external-video', 'map']) {
    expect(unavailableItems.find((item) => item.key === key)).toMatchObject({
      enabled: false,
      unavailableReason: expect.any(String),
    });
  }
  expect(unavailableItems.find((item) => item.key === 'table')).toMatchObject({ enabled: true });

  const boundItems = createTiptapSlashItems(
    enEditorMessages,
    { ai: true, externalVideo: true, map: true, table: true },
    {
      onAIAssistantActivate: vi.fn(),
      onExternalVideoActivate: vi.fn(),
      onMapActivate: vi.fn(),
      onTableActivate: vi.fn(),
    },
  );
  for (const key of ['ai', 'external-video', 'map', 'table']) {
    expect(boundItems.find((item) => item.key === key)).toMatchObject({
      enabled: true,
      unavailableReason: undefined,
    });
  }
});
