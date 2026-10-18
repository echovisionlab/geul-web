import { expect, it } from 'vitest';
import { resolveProgramEventEditorActions } from './program-event-actions';

it.each([
  [true, 'draft', ['edit', 'delete', 'publish']],
  [true, 'published', ['edit', 'delete', 'archive']],
  [true, 'archived', ['edit', 'delete', 'publish']],
  [false, 'draft', []],
  [false, 'published', []],
  [false, 'archived', []],
] as const)('offers Admin=%s the lifecycle actions for %s', (isAdmin, status, actions) => {
  expect(resolveProgramEventEditorActions(isAdmin, status)).toEqual(actions);
});
