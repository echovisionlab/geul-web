import { create } from '@bufbuild/protobuf';
import {
  AIDocumentAcceptedMutationSchema,
  AIDocumentMutationSchema,
  AIDocumentOperationSchema,
  AIDocumentValidationSchema,
  AIEditorAssistantTextDeltaSchema,
  AIEditorDocumentToolApprovalRequiredSchema,
  AIEditorDocumentToolResultSchema,
  AIEditorTurnEventSchema,
  AIEditorTurnTerminalOutcomeSchema,
  AIEditorTurnTerminalStatus,
  type AIEditorTurnEvent,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import type { AIEditorAssistantClient, AIEditorTurn } from '@/lib/ai/editor-orchestration';
import type { AIEditorContext } from '@/lib/editor/ai-support';
import { createAIEditorTurnStore, type AIEditorTurnScope, type AIEditorTurnStoreOptions } from './ai-editor-turn-store';

const target = { type: 'post' as const, id: 'post-1', locale: 'en' };
const modifyContext: AIEditorContext = {
  currentBlockId: 'paragraph-1',
  isSupported: true,
  mode: 'modify',
  selectedBlockIds: [],
};
const { AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED: COMPLETED, AI_EDITOR_TURN_TERMINAL_STATUS_CANCELLED: CANCELLED } =
  AIEditorTurnTerminalStatus;

function turnEvent(event: AIEditorTurnEvent['event']): AIEditorTurnEvent {
  return create(AIEditorTurnEventSchema, { turnId: 'turn-1', event });
}

const text = (value: string) =>
  turnEvent({ case: 'assistantText', value: create(AIEditorAssistantTextDeltaSchema, { text: value }) });

const mutation = create(AIDocumentMutationSchema, {
  protocolVersion: 'dcdp/1',
  expectedDocumentRevision: 'document-rev-1',
  operations: [
    create(AIDocumentOperationSchema, { operation: { case: 'deleteBlock', value: { blockHandle: 'paragraph-1' } } }),
  ],
});

const approvalRequired = ({ withMutation = true } = {}) =>
  turnEvent({
    case: 'approvalRequired',
    value: create(AIEditorDocumentToolApprovalRequiredSchema, {
      toolCallId: 'tool-1',
      summary: 'One Block will change',
      ...(withMutation ? { mutation } : {}),
    }),
  });

const documentResult = (result: 'accepted' | 'rejected' | 'missing') =>
  turnEvent({
    case: 'documentResult',
    value: create(AIEditorDocumentToolResultSchema, {
      toolCallId: 'tool-1',
      ...(result === 'accepted'
        ? {
            result: {
              case: 'accepted' as const,
              value: create(AIDocumentAcceptedMutationSchema, { documentRevision: 'document-rev-2' }),
            },
          }
        : result === 'rejected'
          ? { result: { case: 'rejected' as const, value: create(AIDocumentValidationSchema, {}) } }
          : {}),
    }),
  });

const terminal = (status: AIEditorTurnTerminalStatus) =>
  turnEvent({ case: 'terminal', value: create(AIEditorTurnTerminalOutcomeSchema, { status }) });

type ScriptItem = { event: AIEditorTurnEvent } | { end: true } | { error: unknown };

/** A turn whose stream yields only what the test emits. */
function scriptedTurn() {
  const queue: ScriptItem[] = [];
  let wake: (() => void) | null = null;
  const push = (item: ScriptItem) => {
    queue.push(item);
    wake?.();
    wake = null;
  };
  async function* events(): AsyncGenerator<AIEditorTurnEvent> {
    for (;;) {
      const item = queue.shift();
      if (!item) {
        await new Promise<void>((resolve) => {
          wake = resolve;
        });
        continue;
      }
      if ('error' in item) {
        throw item.error;
      }
      if ('end' in item) {
        return;
      }
      yield item.event;
    }
  }
  return {
    events: events(),
    resolve: vi.fn<AIEditorTurn['resolve']>(async () => undefined),
    cancel: vi.fn<AIEditorTurn['cancel']>(async () => undefined),
    emit: (event: AIEditorTurnEvent) => push({ event }),
    end: () => push({ end: true }),
    fail: (error: unknown) => push({ error }),
  };
}

function clientFor(...turns: AIEditorTurn[]) {
  const start = vi.fn<AIEditorAssistantClient['start']>();
  for (const turn of turns) {
    start.mockResolvedValueOnce(turn);
  }
  return { start } satisfies AIEditorAssistantClient;
}

function storeFor(
  client: AIEditorAssistantClient,
  options: Omit<AIEditorTurnStoreOptions, 'scope'> & { context?: AIEditorContext } = {},
) {
  const { context = modifyContext, ...rest } = options;
  const store = createAIEditorTurnStore({ scope: () => ({ client, target, context }), ...rest });
  return { store, state: () => store.api.getState() };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

async function settle() {
  for (let index = 0; index < 20; index += 1) {
    await Promise.resolve();
  }
}

describe('AI editor turn store', () => {
  it('streams assistant text into one turn and completes it', async () => {
    const turn = scriptedTurn();
    const client = clientFor(turn);
    const { store, state } = storeFor(client);

    void store.start('improve-writing');
    expect(state()).toEqual({
      phase: 'streaming',
      action: 'improve-writing',
      assistantText: '',
      approval: null,
      error: null,
    });
    expect(client.start).toHaveBeenCalledWith({
      target,
      selection: { mode: 'modify', blockHandles: ['paragraph-1'] },
      action: 'improve-writing',
      prompt: undefined,
    });

    await settle();
    turn.emit(text('Hello, '));
    turn.emit(text('world'));
    await settle();
    expect(state().assistantText).toBe('Hello, world');

    turn.emit(terminal(COMPLETED));
    await settle();
    expect(state()).toMatchObject({ phase: 'completed', assistantText: 'Hello, world', approval: null, error: null });
  });

  it('reads the latest client, document and selected Blocks when a turn starts', async () => {
    const firstClient = clientFor(scriptedTurn());
    const secondClient = clientFor(scriptedTurn());
    let scope: AIEditorTurnScope = { client: firstClient, target, context: modifyContext };
    const store = createAIEditorTurnStore({ scope: () => scope });

    void store.start('improve-writing');
    scope = {
      client: secondClient,
      target: { ...target, id: 'post-2' },
      context: { ...modifyContext, mode: 'generate', selectedBlockIds: ['heading-1', 'paragraph-2'] },
    };
    void store.start('continue-writing');
    await settle();

    expect(firstClient.start).toHaveBeenCalledTimes(1);
    expect(secondClient.start).toHaveBeenCalledWith({
      target: { ...target, id: 'post-2' },
      selection: { mode: 'generate', blockHandles: ['heading-1', 'paragraph-2'] },
      action: 'continue-writing',
      prompt: undefined,
    });
  });

  it('keeps an approved change resolving until the stream reports it applied', async () => {
    const turn = scriptedTurn();
    const onApproveFailed = vi.fn();
    const { store, state } = storeFor(clientFor(turn), { onApproveFailed });
    void store.start('improve-writing');
    await settle();
    turn.emit(approvalRequired());
    await settle();
    expect(state()).toMatchObject({
      phase: 'approval',
      approval: { toolCallId: 'tool-1', summary: 'One Block will change' },
    });

    const approving = store.approve();
    expect(state().phase).toBe('resolving');
    await approving;
    expect(turn.resolve).toHaveBeenCalledWith('tool-1', 'approve');
    expect(state().phase).toBe('resolving');

    turn.emit(documentResult('accepted'));
    await settle();
    expect(state()).toMatchObject({ phase: 'streaming', approval: null });
    turn.emit(terminal(COMPLETED));
    await settle();
    expect(state().phase).toBe('completed');
    expect(onApproveFailed).not.toHaveBeenCalled();
  });

  it('returns a denied change to streaming', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.emit(approvalRequired());
    await settle();

    const denying = store.deny();
    expect(state().phase).toBe('resolving');
    await denying;

    expect(turn.resolve).toHaveBeenCalledWith('tool-1', 'deny');
    expect(state()).toMatchObject({ phase: 'streaming', approval: null });
  });

  it('ignores a decision while no change awaits approval', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();

    await store.approve();
    await store.deny();

    expect(turn.resolve).not.toHaveBeenCalled();
    expect(state().phase).toBe('streaming');
  });

  it('reports a failed approval once, and Retry cancels that turn before starting again', async () => {
    const turn = scriptedTurn();
    const retried = scriptedTurn();
    const client = clientFor(turn, retried);
    const onApproveFailed = vi.fn();
    const { store, state } = storeFor(client, { onApproveFailed });
    void store.start('improve-writing');
    await settle();
    turn.emit(approvalRequired());
    await settle();
    turn.resolve.mockRejectedValueOnce(new Error('offline'));

    await store.approve();
    expect(state()).toMatchObject({ phase: 'error', error: 'approveFailed' });
    expect(onApproveFailed).toHaveBeenCalledTimes(1);

    void store.retry('');
    await settle();
    expect(turn.cancel).toHaveBeenCalledTimes(1);
    expect(client.start).toHaveBeenCalledTimes(2);
    expect(client.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'improve-writing', prompt: undefined }),
    );
    expect(state()).toMatchObject({ phase: 'streaming', error: null });
  });

  it('reports a failed denial', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.emit(approvalRequired());
    await settle();
    turn.resolve.mockRejectedValueOnce(new Error('offline'));

    await store.deny();

    expect(state()).toMatchObject({ phase: 'error', error: 'denyFailed' });
  });

  it('keeps the error and does not start again when Retry cannot cancel the previous turn', async () => {
    const turn = scriptedTurn();
    const client = clientFor(turn);
    const { store, state } = storeFor(client);
    void store.start('improve-writing');
    await settle();
    turn.emit(approvalRequired());
    await settle();
    turn.resolve.mockRejectedValueOnce(new Error('offline'));
    await store.approve();
    turn.cancel.mockRejectedValueOnce(new Error('offline'));

    await store.retry('');

    expect(state()).toMatchObject({ phase: 'error', error: 'cancelFailed' });
    expect(client.start).toHaveBeenCalledTimes(1);
  });

  it('retries a custom prompt with the trimmed current prompt', async () => {
    const turn = scriptedTurn();
    const client = clientFor(turn, scriptedTurn());
    const { store, state } = storeFor(client);
    void store.start('custom', 'first draft');
    await settle();
    turn.end();
    await settle();
    expect(state()).toMatchObject({ phase: 'error', error: 'streamEnded' });

    void store.retry('  second draft  ');
    await settle();

    expect(client.start).toHaveBeenLastCalledWith(
      expect.objectContaining({ action: 'custom', prompt: 'second draft' }),
    );
  });

  it('retries only an action that was started or given initially', async () => {
    const empty = storeFor(clientFor(scriptedTurn()));
    await empty.store.retry('anything');
    expect(empty.state().phase).toBe('input');

    const client = clientFor(scriptedTurn());
    const initial = storeFor(client, { initialAction: 'summarize' });
    expect(initial.state().action).toBe('summarize');
    void initial.store.retry('');
    await settle();
    expect(client.start).toHaveBeenCalledWith(expect.objectContaining({ action: 'summarize', prompt: undefined }));
  });

  it('stops a streaming turn after its cancellation and ignores what it streams afterwards', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.emit(text('partial'));
    await settle();

    const stopping = store.stop();
    expect(state().phase).toBe('streaming');
    await stopping;

    expect(turn.cancel).toHaveBeenCalledTimes(1);
    expect(state()).toMatchObject({ phase: 'input', assistantText: '', approval: null });
    turn.emit(text('late'));
    turn.emit(terminal(COMPLETED));
    await settle();
    expect(state()).toMatchObject({ phase: 'input', assistantText: '' });
  });

  it('returns to the prompt even when the cancellation request fails', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.cancel.mockRejectedValueOnce(new Error('offline'));

    await store.stop();

    expect(state()).toMatchObject({ phase: 'input', error: null });
  });

  it('returns a cancelled turn to the prompt and keeps its text', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.emit(text('partial'));
    turn.emit(terminal(CANCELLED));
    await settle();

    expect(state()).toMatchObject({ phase: 'input', assistantText: 'partial', approval: null, error: null });
  });

  it.each([
    {
      name: 'an approval without its document change',
      events: () => [approvalRequired({ withMutation: false })],
      error: 'missingMutation',
    },
    {
      name: 'a document change the server rejected',
      events: () => [approvalRequired(), documentResult('rejected')],
      error: 'documentChanged',
    },
    {
      name: 'a document result without an outcome',
      events: () => [approvalRequired(), documentResult('missing')],
      error: 'missingOutcome',
    },
    {
      name: 'a failed terminal outcome',
      events: () => [terminal(AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_FAILED)],
      error: 'turnFailed',
    },
    {
      name: 'an unspecified terminal outcome',
      events: () => [terminal(AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_UNSPECIFIED)],
      error: 'turnFailed',
    },
  ])('fails on $name', async ({ events, error }) => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    for (const event of events()) {
      turn.emit(event);
    }
    await settle();

    expect(state()).toMatchObject({ phase: 'error', error, approval: null });
  });

  it('fails when the stream ends without a terminal outcome', async () => {
    const turn = scriptedTurn();
    const { store, state } = storeFor(clientFor(turn));
    void store.start('improve-writing');
    await settle();
    turn.end();
    await settle();

    expect(state()).toMatchObject({ phase: 'error', error: 'streamEnded' });
  });

  it('fails when the turn cannot start or its stream breaks', async () => {
    const refused = storeFor({
      start: vi.fn<AIEditorAssistantClient['start']>().mockRejectedValue(new Error('denied')),
    });
    void refused.store.start('improve-writing');
    await settle();
    expect(refused.state()).toMatchObject({ phase: 'error', error: 'requestFailed' });

    const turn = scriptedTurn();
    const broken = storeFor(clientFor(turn));
    void broken.store.start('improve-writing');
    await settle();
    turn.fail(new Error('AI editor stream changed turn identity'));
    await settle();
    expect(broken.state()).toMatchObject({ phase: 'error', error: 'requestFailed' });
  });

  it('cancels and ignores a turn that finishes starting after Stop', async () => {
    const turn = scriptedTurn();
    const starting = deferred<AIEditorTurn>();
    const { store, state } = storeFor({ start: vi.fn<AIEditorAssistantClient['start']>(() => starting.promise) });
    void store.start('improve-writing');
    await store.stop();
    expect(state().phase).toBe('input');

    starting.resolve(turn);
    await settle();
    expect(turn.cancel).toHaveBeenCalledTimes(1);

    turn.emit(text('late'));
    turn.emit(terminal(COMPLETED));
    await settle();
    expect(state()).toMatchObject({ phase: 'input', assistantText: '' });
  });

  it('lets a newer turn replace an older one', async () => {
    const older = scriptedTurn();
    const newer = scriptedTurn();
    const { store, state } = storeFor(clientFor(older, newer));
    void store.start('improve-writing');
    await settle();
    void store.start('summarize');
    await settle();

    older.emit(text('old'));
    newer.emit(text('new'));
    await settle();

    expect(state()).toMatchObject({ action: 'summarize', assistantText: 'new' });
  });

  it('cancels the running turn on dispose, even when cancellation fails, and can start again', async () => {
    const turn = scriptedTurn();
    const next = scriptedTurn();
    const client = clientFor(turn, next);
    const { store, state } = storeFor(client);
    void store.start('improve-writing');
    await settle();
    turn.cancel.mockRejectedValueOnce(new Error('offline'));

    store.dispose();
    await settle();
    expect(turn.cancel).toHaveBeenCalledTimes(1);
    turn.emit(text('late'));
    await settle();
    expect(state().assistantText).toBe('');

    void store.start('summarize');
    await settle();
    next.emit(text('again'));
    await settle();
    expect(state().assistantText).toBe('again');
  });
});
