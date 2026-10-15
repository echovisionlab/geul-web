/**
 * The title each open editor shows, keyed by `{type}:{entityId}` (hyphenated type). Room journals
 * store it with their records so local backups name the document, as Notion's backups carry the
 * page title.
 */
const titles = new Map<string, string>();
const MAX_TITLE_LENGTH = 200;

export function roomJournalEntityKey(type: string, entityId: string): string {
  return `${type.replaceAll('_', '-')}:${entityId}`;
}

export function setRoomJournalTitle(type: string, entityId: string, title: string | null | undefined): void {
  const key = roomJournalEntityKey(type, entityId);
  const trimmed = title?.trim().slice(0, MAX_TITLE_LENGTH);
  if (trimmed) {
    titles.set(key, trimmed);
  }
}

export function getRoomJournalTitle(type: string, entityId: string): string | undefined {
  return titles.get(roomJournalEntityKey(type, entityId));
}
