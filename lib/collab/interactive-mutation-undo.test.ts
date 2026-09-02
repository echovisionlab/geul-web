import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import {
  attachBlockRoomEditor,
  attachBlockRoomLocalUndoOrigin,
  blockRoomUndoDepth,
  redoBlockRoom,
  redoBlockRoomEditor,
  registerInteractiveMutationUndoProvider,
  undoBlockRoom,
  undoBlockRoomEditor,
} from './interactive-mutation-undo';

const FIRST_MUTATION = '019cd2ae-5c67-7fe7-9671-62fc1e9cba83';
const SECOND_MUTATION = '019cd2ae-5c67-7fe7-9671-62fc1e9cba84';

function markerBegin(mutationId = FIRST_MUTATION): string {
  return JSON.stringify({ kind: 'interactive_mutation.begin', mutationId });
}

function markerEnd(outcome: 'accepted' | 'aborted', mutationId = FIRST_MUTATION): string {
  return JSON.stringify({ kind: 'interactive_mutation.end', mutationId, outcome });
}

describe('interactive mutation room undo', () => {
  const documents: Y.Doc[] = [];

  afterEach(() => {
    for (const document of documents.splice(0)) {
      document.destroy();
    }
  });

  function createDocument(): Y.Doc {
    const document = new Y.Doc();
    documents.push(document);
    return document;
  }

  it('tracks editable local Block-room origins and preserves redo', () => {
    const document = createDocument();
    const localOrigin = { kind: 'local-editor' };
    const detach = attachBlockRoomLocalUndoOrigin(document, localOrigin, () => true);
    const text = document.getText('body');

    document.transact(() => text.insert(0, 'local'), localOrigin);

    expect(blockRoomUndoDepth(document)).toBe(1);
    expect(undoBlockRoom(document)).toBe(true);
    expect(text.toString()).toBe('');
    expect(redoBlockRoom(document)).toBe(true);
    expect(text.toString()).toBe('local');
    detach();
  });

  it('routes embedded editor history controls to the same room manager', () => {
    const document = createDocument();
    const editor = {};
    const localOrigin = { kind: 'local-editor' };
    const detachOrigin = attachBlockRoomLocalUndoOrigin(document, localOrigin, () => true);
    const detachEditor = attachBlockRoomEditor(document, editor);
    const text = document.getText('body');
    document.transact(() => text.insert(0, 'source'), localOrigin);

    expect(undoBlockRoomEditor(editor)).toBe(true);
    expect(text.toString()).toBe('');
    expect(redoBlockRoomEditor(editor)).toBe(true);
    expect(text.toString()).toBe('source');

    detachEditor();
    expect(undoBlockRoomEditor(editor)).toBe(false);
    detachOrigin();
  });

  it('captures exactly the next marked provider transaction as one undo item', () => {
    const document = createDocument();
    const provider = { kind: 'hocuspocus-provider' };
    const registration = registerInteractiveMutationUndoProvider(document, provider);
    const detach = attachBlockRoomLocalUndoOrigin(document, { kind: 'editor' }, () => true);
    const text = document.getText('body');

    registration.handleStateless(markerBegin());
    document.transact(() => {
      text.insert(0, 'AI');
      text.insert(2, ' mutation');
    }, provider);
    document.transact(() => text.insert(text.length, ' ignored remote'), provider);
    registration.handleStateless(markerEnd('accepted'));

    expect(text.toString()).toBe('AI mutation ignored remote');
    expect(blockRoomUndoDepth(document)).toBe(1);
    expect(undoBlockRoom(document)).toBe(true);
    expect(text.toString()).toBe(' ignored remote');
    expect(undoBlockRoom(document)).toBe(false);
    detach();
    registration.destroy();
  });

  it('never tracks marked provider updates without an open editable editor', () => {
    const document = createDocument();
    const provider = { kind: 'hocuspocus-provider' };
    const registration = registerInteractiveMutationUndoProvider(document, provider);
    const detach = attachBlockRoomLocalUndoOrigin(document, { kind: 'readonly-editor' }, () => false);
    const text = document.getText('body');

    registration.handleStateless(markerBegin());
    document.transact(() => text.insert(0, 'remote'), provider);
    registration.handleStateless(markerEnd('accepted'));

    expect(text.toString()).toBe('remote');
    expect(blockRoomUndoDepth(document)).toBe(0);
    expect(undoBlockRoom(document)).toBe(false);
    detach();
    registration.destroy();
  });

  it('drops an aborted marked update without touching later concurrent local history', () => {
    const document = createDocument();
    const provider = { kind: 'hocuspocus-provider' };
    const localOrigin = { kind: 'editor' };
    const registration = registerInteractiveMutationUndoProvider(document, provider);
    const detach = attachBlockRoomLocalUndoOrigin(document, localOrigin, () => true);
    const text = document.getText('body');

    registration.handleStateless(markerBegin());
    document.transact(() => text.insert(0, 'AI'), provider);
    document.transact(() => text.insert(text.length, ' local'), localOrigin);
    registration.handleStateless(markerEnd('aborted'));

    expect(blockRoomUndoDepth(document)).toBe(1);
    expect(undoBlockRoom(document)).toBe(true);
    expect(text.toString()).toBe('AI');
    expect(undoBlockRoom(document)).toBe(false);
    detach();
    registration.destroy();
  });

  it('ignores malformed, mismatched, and unmarked provider traffic', () => {
    const document = createDocument();
    const provider = { kind: 'hocuspocus-provider' };
    const registration = registerInteractiveMutationUndoProvider(document, provider);
    const detach = attachBlockRoomLocalUndoOrigin(document, { kind: 'editor' }, () => true);
    const text = document.getText('body');

    registration.handleStateless('{');
    registration.handleStateless(JSON.stringify({ kind: 'interactive_mutation.begin', mutationId: 'not-a-uuid' }));
    document.transact(() => text.insert(0, 'unmarked'), provider);
    registration.handleStateless(markerBegin());
    registration.handleStateless(markerEnd('accepted', SECOND_MUTATION));
    registration.handleStateless(markerEnd('accepted'));

    expect(text.toString()).toBe('unmarked');
    expect(blockRoomUndoDepth(document)).toBe(0);
    detach();
    registration.destroy();
  });
});
