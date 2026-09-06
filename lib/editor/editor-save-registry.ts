type PendingSave = { flush: () => Promise<boolean>; hasPending: () => boolean };
const pendingSaves = new Map<string, Set<PendingSave>>();

export function registerEditorSave(document: string, save: PendingSave) {
  const saves = pendingSaves.get(document) ?? new Set<PendingSave>();
  saves.add(save);
  pendingSaves.set(document, saves);
  return () => {
    saves.delete(save);
    if (saves.size === 0) {
      pendingSaves.delete(document);
    }
  };
}

/** Called before leaving a locale so its room stays alive until every save is acknowledged. */
export async function flushEditorSaves(document: string): Promise<boolean> {
  do {
    for (const save of pendingSaves.get(document) ?? []) {
      if (!(await save.flush())) {
        return false;
      }
    }
  } while ([...(pendingSaves.get(document) ?? [])].some((save) => save.hasPending()));
  return true;
}
