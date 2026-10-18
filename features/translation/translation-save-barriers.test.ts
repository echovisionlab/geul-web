import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { createTranslationSaveBarriers } from './translation-save-barriers';

const unregisterSaves: Array<() => void> = [];
afterEach(() => {
  for (const unregister of unregisterSaves.splice(0)) {
    unregister();
  }
});

function registerSave(document: string, flush: () => Promise<boolean>) {
  unregisterSaves.push(registerEditorSave(document, { flush, hasPending: () => false }));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

describe('translation save barriers', () => {
  it.each([
    { entityType: 'post', entityId: 'form-1' },
    { entityType: 'form', entityId: 'form-2' },
  ] as const)('flushes the Form registry key without persisting unrelated $entityType:$entityId', async (runtime) => {
    const formSave = vi.fn(async () => true);
    const postSave = vi.fn(async () => true);
    const persistNow = vi.fn(async () => undefined);
    registerSave('form:form-1', formSave);
    registerSave('post:post-1', postSave);
    const barriers = createTranslationSaveBarriers({
      entityType: 'form',
      entityId: 'form-1',
      runtimeContext: { ...runtime, persistNow },
    });

    await barriers.beforeRegenerate();

    expect(formSave).toHaveBeenCalledOnce();
    expect(postSave).not.toHaveBeenCalled();
    expect(persistNow).not.toHaveBeenCalled();
  });

  it('waits for registered edits before persisting the Series runtime for regeneration', async () => {
    const saved = deferred();
    const persisted = deferred();
    const persistenceStarted = deferred();
    const persistNow = vi.fn(() => {
      persistenceStarted.resolve();
      return persisted.promise;
    });
    registerSave('post_series:series-1', async () => {
      await saved.promise;
      return true;
    });
    const barriers = createTranslationSaveBarriers({
      entityType: 'post_series',
      entityId: 'series-1',
      runtimeContext: { entityType: 'series', entityId: 'series-1', persistNow },
    });
    const complete = vi.fn();

    const regeneration = barriers.beforeRegenerate().then(complete);
    expect(persistNow).not.toHaveBeenCalled();
    saved.resolve();
    await persistenceStarted.promise;
    expect(persistNow).toHaveBeenCalledOnce();
    expect(complete).not.toHaveBeenCalled();
    persisted.resolve();
    await regeneration;
    expect(complete).toHaveBeenCalledOnce();
  });

  it('waits for runtime persistence before flushing edits for a source change', async () => {
    const persisted = deferred();
    const save = vi.fn(async () => true);
    registerSave('post:post-1', save);
    const barriers = createTranslationSaveBarriers({
      entityType: 'post',
      entityId: 'post-1',
      runtimeContext: { entityType: 'post', entityId: 'post-1', persistNow: () => persisted.promise },
    });

    const sourceChange = barriers.beforeSourceChange();
    expect(save).not.toHaveBeenCalled();
    persisted.resolve();
    await sourceChange;
    expect(save).toHaveBeenCalledOnce();
  });

  it('rejects regeneration without persisting the runtime when registered edits fail', async () => {
    const persistNow = vi.fn(async () => undefined);
    registerSave('post:post-1', async () => false);
    const barriers = createTranslationSaveBarriers({
      entityType: 'post',
      entityId: 'post-1',
      runtimeContext: { entityType: 'post', entityId: 'post-1', persistNow },
    });

    await expect(barriers.beforeRegenerate()).rejects.toThrow('Pending editor saves did not complete.');
    expect(persistNow).not.toHaveBeenCalled();
  });
});
