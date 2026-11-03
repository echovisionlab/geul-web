import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  AIEditorTurnTerminalStatus,
  type AIEditorDocumentToolApprovalRequired,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';
import type { AIDocumentTarget } from '@/lib/ai/document-client';
import type { AIEditorAssistantClient, AIEditorTurn } from '@/lib/ai/editor-orchestration';
import type { AIEditorContext } from '@/lib/editor/ai-support';

export type AIEditorTurnPhase = 'input' | 'streaming' | 'approval' | 'resolving' | 'completed' | 'error';

/** The view translates these. */
export type AIEditorTurnError =
  | 'requestFailed'
  | 'missingMutation'
  | 'documentChanged'
  | 'missingOutcome'
  | 'turnFailed'
  | 'streamEnded'
  | 'approveFailed'
  | 'denyFailed'
  | 'cancelFailed';

export interface AIEditorTurnState {
  phase: AIEditorTurnPhase;
  /** The last started action, which Retry repeats. */
  action: string | null;
  assistantText: string;
  approval: AIEditorDocumentToolApprovalRequired | null;
  error: AIEditorTurnError | null;
}

/** Read when a turn starts, so each turn uses the editor's current client, document and selection. */
export interface AIEditorTurnScope {
  client: AIEditorAssistantClient;
  target: AIDocumentTarget;
  context: AIEditorContext;
}

export interface AIEditorTurnStoreOptions {
  scope: () => AIEditorTurnScope;
  initialAction?: string;
  onApproveFailed?: () => void;
}

export interface AIEditorTurnStore {
  readonly api: StoreApi<AIEditorTurnState>;
  start: (action: string, prompt?: string) => Promise<void>;
  approve: () => Promise<void>;
  deny: () => Promise<void>;
  /** Repeats the last action; a custom action repeats with `prompt`. */
  retry: (prompt: string) => Promise<void>;
  stop: () => Promise<void>;
  /** Cancels the running turn. The store stays usable because React may mount it again. */
  dispose: () => void;
}

class TurnFailure extends Error {
  constructor(readonly code: AIEditorTurnError) {
    super(code);
  }
}

function selectedHandles(context: AIEditorContext): readonly string[] {
  // Generation is anchored to the current stable Block handle. An empty list
  // means whole-document context in the RPC and would lose the editor cursor anchor.
  return context.selectedBlockIds.length > 0 ? context.selectedBlockIds : [context.currentBlockId];
}

/** One AI menu's turn: streams it, resolves its document approval, and stops or retries it. */
export function createAIEditorTurnStore(options: AIEditorTurnStoreOptions): AIEditorTurnStore {
  const api = createStore<AIEditorTurnState>()(() => ({
    phase: 'input',
    action: options.initialAction || null,
    assistantText: '',
    approval: null,
    error: null,
  }));
  const set = api.setState;
  let turn: AIEditorTurn | null = null;
  // Start, Stop, Retry and dispose each move this on; an older stream then stops updating the store.
  let generation = 0;

  const start = async (action: string, prompt?: string): Promise<void> => {
    const run = ++generation;
    set({ action, assistantText: '', approval: null, error: null, phase: 'streaming' });
    const { client, target, context } = options.scope();
    try {
      const started = await client.start({
        target,
        selection: { mode: context.mode, blockHandles: selectedHandles(context) },
        action,
        prompt,
      });
      if (run !== generation) {
        // Nothing will read this turn's stream, so end it on the server as well.
        void started.cancel().catch(() => undefined);
        return;
      }
      turn = started;
      let receivedTerminal = false;
      for await (const event of started.events) {
        if (run !== generation) {
          return;
        }
        switch (event.event.case) {
          case 'assistantText': {
            const delta = event.event.value.text;
            set((state) => ({ assistantText: state.assistantText + delta }));
            break;
          }
          case 'approvalRequired':
            if (!event.event.value.mutation) {
              throw new TurnFailure('missingMutation');
            }
            set({ approval: event.event.value, phase: 'approval' });
            break;
          case 'documentResult':
            set({ approval: null });
            if (event.event.value.result.case === 'rejected') {
              throw new TurnFailure('documentChanged');
            }
            if (event.event.value.result.case !== 'accepted') {
              throw new TurnFailure('missingOutcome');
            }
            set({ phase: 'streaming' });
            break;
          case 'terminal':
            receivedTerminal = true;
            turn = null;
            if (event.event.value.status === AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED) {
              set({ approval: null, phase: 'completed' });
            } else if (
              event.event.value.status === AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_CANCELLED
            ) {
              set({ approval: null, phase: 'input' });
            } else {
              set({ approval: null });
              throw new TurnFailure('turnFailed');
            }
            break;
          default:
            break;
        }
      }
      if (!receivedTerminal && run === generation) {
        throw new TurnFailure('streamEnded');
      }
    } catch (value) {
      if (run !== generation) {
        return;
      }
      turn = null;
      set({ error: value instanceof TurnFailure ? value.code : 'requestFailed', phase: 'error' });
    }
  };

  const approve = async (): Promise<void> => {
    const run = generation;
    const current = turn;
    const { approval } = api.getState();
    if (!current || !approval || api.getState().phase === 'resolving') {
      return;
    }
    set({ phase: 'resolving' });
    try {
      // The stream reports the applied change; until then the approval stays resolving.
      await current.resolve(approval.toolCallId, 'approve');
    } catch {
      if (run !== generation || current !== turn) {
        return;
      }
      set({ error: 'approveFailed', phase: 'error' });
      options.onApproveFailed?.();
    }
  };

  const deny = async (): Promise<void> => {
    const run = generation;
    const current = turn;
    const { approval } = api.getState();
    if (!current || !approval || api.getState().phase === 'resolving') {
      return;
    }
    set({ phase: 'resolving' });
    try {
      await current.resolve(approval.toolCallId, 'deny');
      if (run !== generation || current !== turn) {
        return;
      }
      set({ approval: null, phase: 'streaming' });
    } catch {
      if (run !== generation || current !== turn) {
        return;
      }
      set({ error: 'denyFailed', phase: 'error' });
    }
  };

  const retry = async (prompt: string): Promise<void> => {
    const { action } = api.getState();
    if (!action) {
      return;
    }
    const run = ++generation;
    try {
      await turn?.cancel();
    } catch {
      if (run !== generation) {
        return;
      }
      set({ error: 'cancelFailed', phase: 'error' });
      return;
    } finally {
      if (run === generation) {
        turn = null;
      }
    }
    if (run !== generation) {
      return;
    }
    await start(action, action === 'custom' ? prompt.trim() : undefined);
  };

  const stop = async (): Promise<void> => {
    const run = ++generation;
    try {
      await turn?.cancel();
    } catch {
      // The stream is aborted by the client even when the cancellation RPC fails.
    } finally {
      if (run === generation) {
        turn = null;
      }
      if (run === generation) {
        set({ approval: null, assistantText: '', phase: 'input' });
      }
    }
  };

  const dispose = () => {
    generation += 1;
    void turn?.cancel().catch(() => undefined);
    turn = null;
  };

  return { api, start, approve, deny, retry, stop, dispose };
}
