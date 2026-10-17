/**
 * Whether the page's durable block-room journal has settled, without importing the journal itself. The
 * journal (and the block-room codec it compares documents with) loads with a block-room connection; the
 * editor runtime only asks this question, so routes that never open a block room do not carry the codec.
 */
let settled: (() => boolean) | null = null;

export function registerBlockRoomJournalDurability(isSettled: () => boolean): void {
  settled = isSettled;
}

/** False until a block-room journal exists, as for a journal that cannot persist (no IndexedDB). */
export function isBlockRoomJournalSettled(): boolean {
  return settled?.() ?? false;
}
