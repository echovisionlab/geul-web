// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createBlockRoomPageSectionsController } from '@/features/page/PageEditor/block-room-page-sections';
import { createDefaultSection } from '@/features/page/PageEditor/types';
import { createCollaborativeDocumentSaveTracker } from '@/lib/editor/collaborative-document-save';
import { localDocumentRoom } from './document-editor-room';

describe('canonical editor page fixtures', () => {
  it.each(['post', 'work', 'artist', 'label', 'release', 'program-event', 'terms-history', 'privacy-history'] as const)(
    'creates a real %s editor document without connecting a websocket',
    (entity) => {
      const room = localDocumentRoom(entity, 'ko');
      try {
        expect(room.provider.configuration.websocketProvider.shouldConnect).toBe(false);
        expect(JSON.stringify(room.controller?.initialContent)).toContain('본문을 직접 편집해 보세요');
        expect(room.controller?.getLocalizedDocumentSnapshot().locale).toBe('ko');
      } finally {
        room.destroy();
      }
    },
  );
  it('supports page structure changes and flushes them through the local durability acknowledgement', async () => {
    const room = localDocumentRoom('page', 'ko');
    const controller = createBlockRoomPageSectionsController(room.document, 'ko');
    const tracker = createCollaborativeDocumentSaveTracker(room.provider, {
      kind: 'block-room',
      protocol: room.protocol,
    });
    const unregister = tracker.register('page:fixture');
    try {
      const initial = controller.read();
      expect(initial).toHaveLength(1);
      controller.insert(createDefaultSection('rich-text'), { index: 1 });
      expect(controller.read()).toHaveLength(2);
      expect(await tracker.flush()).toBe(true);
      controller.delete(initial[0].id);
      expect(await tracker.flush()).toBe(true);
      expect(controller.read()).toHaveLength(1);
    } finally {
      unregister();
      room.destroy();
    }
  });
});
