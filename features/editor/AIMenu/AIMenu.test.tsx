// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { create } from '@bufbuild/protobuf';
import {
  AIDocumentAcceptedMutationSchema,
  AIDocumentMutationSchema,
  AIDocumentOperationSchema,
  AIEditorAssistantTextDeltaSchema,
  AIEditorDocumentToolApprovalRequiredSchema,
  AIEditorDocumentToolResultSchema,
  AIEditorTurnEventSchema,
  AIEditorTurnTerminalOutcomeSchema,
  AIEditorTurnTerminalStatus,
} from '@echovisionlab/geul-proto/secure/ai_pb.ts';

import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import type { AIEditorAssistantClient } from '@/lib/ai/editor-orchestration';
import { AIMenu } from './AIMenu';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function renderMenu(client: AIEditorAssistantClient) {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <AIMenu
            client={client}
            context={{ currentBlockId: 'paragraph-1', isSupported: true, mode: 'modify', selectedBlockIds: [] }}
            target={{ type: 'post', id: 'post-1', locale: 'en' }}
            onClose={vi.fn()}
          />
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });
}

const button = (label: string) =>
  [...(container?.querySelectorAll('button') ?? [])].find((item) => item.textContent === label);

async function settle() {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }
  });
}

describe('AI menu orchestration stream', () => {
  it('shows a typed approval and resolves it through the server without interpreting assistant text as HTML', async () => {
    const operation = create(AIDocumentOperationSchema, {
      operation: { case: 'deleteBlock', value: { blockHandle: 'paragraph-1' } },
    });
    const mutation = create(AIDocumentMutationSchema, {
      protocolVersion: 'dcdp/1',
      expectedDocumentRevision: 'document-rev-1',
      operations: [operation],
    });
    let resumeAfterApproval: (() => void) | null = null;
    let markApprovalStreamed: (() => void) | null = null;
    const approvalStreamed = new Promise<void>((resolve) => {
      markApprovalStreamed = resolve;
    });
    const events = async function* () {
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: {
          case: 'assistantText',
          value: create(AIEditorAssistantTextDeltaSchema, { text: '<img src=x onerror=alert(1)>' }),
        },
      });
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: {
          case: 'approvalRequired',
          value: create(AIEditorDocumentToolApprovalRequiredSchema, {
            toolCallId: 'tool-1',
            mutation,
            summary: 'One Block will change',
          }),
        },
      });
      markApprovalStreamed?.();
      await new Promise<void>((resolve) => {
        resumeAfterApproval = resolve;
      });
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: {
          case: 'documentResult',
          value: create(AIEditorDocumentToolResultSchema, {
            toolCallId: 'tool-1',
            result: {
              case: 'accepted',
              value: create(AIDocumentAcceptedMutationSchema, { documentRevision: 'document-rev-2' }),
            },
          }),
        },
      });
      yield create(AIEditorTurnEventSchema, {
        turnId: 'turn-1',
        event: {
          case: 'terminal',
          value: create(AIEditorTurnTerminalOutcomeSchema, {
            status: AIEditorTurnTerminalStatus.AI_EDITOR_TURN_TERMINAL_STATUS_COMPLETED,
          }),
        },
      });
    };
    const turn = {
      events: events(),
      resolve: vi.fn(async () => resumeAfterApproval?.()),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    const client = { start: vi.fn().mockResolvedValue(turn) } satisfies AIEditorAssistantClient;
    const target = { type: 'post' as const, id: 'post-1', locale: 'en' };
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <DesignSystemProvider locale="en" forceColorScheme="light">
            <AIMenu
              client={client}
              context={{ currentBlockId: 'paragraph-1', isSupported: true, mode: 'modify', selectedBlockIds: [] }}
              target={target}
              onClose={vi.fn()}
              dragHandleClassName="test-ai-drag-handle"
            />
          </DesignSystemProvider>
        </NextIntlClientProvider>,
      );
    });

    const moveHandle = container.querySelector<HTMLButtonElement>('[data-ai-floating-drag-handle]');
    expect(moveHandle?.getAttribute('aria-label')).toBe('Move');
    expect(moveHandle?.getAttribute('aria-keyshortcuts')).toBe('ArrowUp ArrowDown ArrowLeft ArrowRight');
    expect(container.querySelector('button')).toBe(moveHandle);

    const improve = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Improve');
    await act(async () => {
      improve?.click();
      await approvalStreamed;
      await Promise.resolve();
    });

    expect(container?.textContent).toContain('Delete paragraph-1');

    expect(client.start).toHaveBeenCalledWith({
      target,
      selection: { mode: 'modify', blockHandles: ['paragraph-1'] },
      action: 'improve-writing',
      prompt: undefined,
    });
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    expect(container.textContent).toContain('One Block will change');

    const accept = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Accept');
    await act(async () => {
      accept?.click();
      await vi.waitFor(() => expect(turn.resolve).toHaveBeenCalledWith('tool-1', 'approve'));
    });
  });
  it('shows the translated failure message instead of the internal error', async () => {
    const ended = { events: (async function* () {})(), resolve: vi.fn(), cancel: vi.fn().mockResolvedValue(undefined) };
    renderMenu({ start: vi.fn().mockResolvedValue(ended) });
    act(() => button('Improve')?.click());
    await settle();

    expect(container?.textContent).toContain(enMessages.aiAssistant.errors.generic);
    expect(button('Retry')).toBeDefined();
  });

  it('cancels the running turn when the menu closes', async () => {
    const turn = {
      // A stream that stays open until the turn is cancelled.
      events: (async function* (): AsyncGenerator<never> {
        yield await new Promise<never>(() => {});
      })(),
      resolve: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
    };
    renderMenu({ start: vi.fn().mockResolvedValue(turn) });
    act(() => button('Improve')?.click());
    await settle();

    act(() => root?.unmount());
    root = null;
    expect(turn.cancel).toHaveBeenCalledTimes(1);
  });
});
