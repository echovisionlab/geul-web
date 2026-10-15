import { describe, expect, it } from 'vitest';
import { resolveEditorSaveState } from './editor-save-state';
describe('truthful editor save state', () => {
  it.each([
    ['synced', false, false, 'saved'],
    ['synced', true, false, 'saving'],
    ['synced', true, true, 'error'],
    ['offline', true, true, 'offline'],
    ['reload', true, true, 'reload'],
    ['loading', false, false, 'reload'],
    ['resyncing', false, false, 'saving'],
  ] as const)('%s pending=%s failure=%s is %s', (phase, hasUnsavedEdits, hasFailure, expected) => {
    expect(resolveEditorSaveState({ phase, hasUnsavedEdits, hasFailure })).toBe(expected);
  });
});
