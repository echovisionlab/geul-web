import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import { WorkCreditSaveCoordinator } from './work-credit-save-coordinator';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

const coordinators: WorkCreditSaveCoordinator[] = [];

function createCoordinator(document: string) {
  const coordinator = new WorkCreditSaveCoordinator(document);
  coordinators.push(coordinator);
  return coordinator;
}

afterEach(() => {
  coordinators.splice(0).forEach((coordinator) => coordinator.dispose());
});

describe('Work credit save coordinator', () => {
  it('waits for a delayed move and blocks navigation when that move fails without retrying it', async () => {
    const document = 'work:credit-move';
    const coordinator = createCoordinator(document);
    const move = deferred<boolean>();
    const startMove = vi.fn(() => move.promise);

    void coordinator.track(startMove, (succeeded) => succeeded);
    let flushed = false;
    const flush = flushEditorSaves(document).then((result) => {
      flushed = true;
      return result;
    });

    expect(flushed).toBe(false);
    expect(startMove).toHaveBeenCalledOnce();
    move.resolve(false);

    await expect(flush).resolves.toBe(false);
    expect(startMove).toHaveBeenCalledOnce();
  });

  it('waits for a delayed CRUD write and reports the returned action failure', async () => {
    const document = 'work:credit-crud';
    const coordinator = createCoordinator(document);
    const mutation = deferred<{ error?: string }>();
    const startMutation = vi.fn(() => mutation.promise);

    void coordinator.track(startMutation, (result) => !result.error);
    const flush = flushEditorSaves(document);
    mutation.resolve({ error: 'Permission denied' });

    await expect(flush).resolves.toBe(false);
    expect(startMutation).toHaveBeenCalledOnce();
  });

  it('drains credit writes that begin while the move flush is already waiting', async () => {
    const document = 'work:credit-drain';
    const coordinator = createCoordinator(document);
    const move = deferred<boolean>();
    const mutation = deferred<{ error?: string }>();
    let mutationStarted = false;

    void move.promise.then(() => {
      mutationStarted = true;
      void coordinator.track(
        () => mutation.promise,
        (result) => !result.error,
      );
    });
    void coordinator.track(
      () => move.promise,
      (succeeded) => succeeded,
    );
    const flush = flushEditorSaves(document);

    move.resolve(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(mutationStarted).toBe(true);

    mutation.resolve({ error: 'Write failed' });
    await expect(flush).resolves.toBe(false);
  });
});
