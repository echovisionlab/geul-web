// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';

const journals = vi.hoisted(() => ({ written: true }));
vi.mock('@/lib/collab/room-journal-store', () => ({ flushRoomJournals: async () => journals.written }));
const guard = vi.hoisted(() => ({ suspend: vi.fn() }));
vi.mock('./usePendingEditorUnload', () => ({ suspendEditorUnloadGuard: guard.suspend }));

import { registerEditorSave } from './editor-save-registry';
import { leaveOrResume, prepareToLeaveWithDurableEdits } from './leave-with-durable-edits';

const unregister: Array<() => void> = [];
afterEach(() => {
  unregister.splice(0).forEach((release) => release());
  guard.suspend.mockReset();
  journals.written = true;
  vi.useRealTimers();
});

it('keeps the unsaved-edits prompt while any pending save is memory-only or the journals did not settle', async () => {
  let durable = false;
  unregister.push(registerEditorSave('map-theme:one', { flush: async () => false, hasPending: () => true }));
  unregister.push(
    registerEditorSave('post:one', { flush: async () => false, hasPending: () => true, isDurable: () => durable }),
  );
  await prepareToLeaveWithDurableEdits();
  expect(guard.suspend).not.toHaveBeenCalled();

  unregister.shift()!();
  journals.written = false;
  durable = true;
  await prepareToLeaveWithDurableEdits();
  expect(guard.suspend).not.toHaveBeenCalled();

  journals.written = true;
  await prepareToLeaveWithDurableEdits();
  expect(guard.suspend).toHaveBeenCalledOnce();
});

it('lets the leaving action run again when the page stayed (the editor cancelled the leave prompt)', () => {
  vi.useFakeTimers();
  const navigate = vi.fn();
  const stayed = vi.fn();
  leaveOrResume(navigate, stayed);
  expect(navigate).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(2_000);
  expect(stayed).toHaveBeenCalledOnce();

  const left = vi.fn();
  leaveOrResume(() => window.dispatchEvent(new Event('pagehide')), left);
  vi.advanceTimersByTime(2_000);
  expect(left).not.toHaveBeenCalled();
});
