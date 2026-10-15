import { ROOM_JOURNAL_DATABASES } from '@/lib/collab/room-journal-store';
import type { LocalBackup } from '@/lib/collab/local-backups';

export const localBackupEntries: LocalBackup[] = [
  {
    database: ROOM_JOURNAL_DATABASES.blockRoom,
    id: 'post',
    tabId: 'closed-post',
    documentKind: 'post',
    entityId: '11111111-1111-4111-8111-111111111111',
    locale: 'ko',
    title: '밤의 기록',
    updatedAt: Date.parse('2026-10-14T02:25:00Z'),
  },
  {
    database: ROOM_JOURNAL_DATABASES.blockRoom,
    id: 'page',
    tabId: 'closed-page',
    documentKind: 'page',
    entityId: '22222222-2222-4222-8222-222222222222',
    locale: 'en',
    title: 'Listening room — autumn program',
    updatedAt: Date.parse('2026-10-13T08:10:00Z'),
  },
  {
    database: ROOM_JOURNAL_DATABASES.documentRoom,
    id: 'layout',
    tabId: 'closed-layout',
    documentKind: 'email-layout',
    entityId: '33333333-3333-4333-8333-333333333333',
    locale: 'ja',
    updatedAt: Date.parse('2026-10-12T11:05:00Z'),
  },
];
