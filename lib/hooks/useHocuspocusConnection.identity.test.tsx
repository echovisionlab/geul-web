// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Y from 'yjs';
import { useHocuspocusConnection } from './useHocuspocusConnection';

const providerState = vi.hoisted(() => ({
  instances: [] as Array<{
    configuration: {
      name: string;
      document: Y.Doc;
      onConnect?: () => void;
      onSynced?: () => void;
    };
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('@hocuspocus/provider', () => ({
  HocuspocusProvider: class MockHocuspocusProvider {
    readonly configuration: (typeof providerState.instances)[number]['configuration'];
    destroy = vi.fn();
    disconnect = vi.fn();
    connect = vi.fn();

    constructor(configuration: (typeof providerState.instances)[number]['configuration']) {
      this.configuration = configuration;
      providerState.instances.push(this);
    }
  },
}));

const entityId = '11111111-1111-4111-8111-111111111111';
const snapshots: Array<{ name: string; connection: ReturnType<typeof useHocuspocusConnection> }> = [];
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness({ locale }: { locale: string }) {
  const name = `email-layout:${entityId}:${locale}`;
  const connection = useHocuspocusConnection({ documentName: name });
  snapshots.push({ name, connection });
  return null;
}

beforeEach(() => {
  providerState.instances.length = 0;
  snapshots.length = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe('useHocuspocusConnection request identity', () => {
  it('masks the previous document synchronously when documentName changes', async () => {
    await act(async () => {
      root?.render(<Harness locale="en" />);
      await Promise.resolve();
    });
    const first = providerState.instances[0]!;
    act(() => {
      first.configuration.onConnect?.();
      first.configuration.onSynced?.();
    });
    expect(snapshots.at(-1)?.connection).toMatchObject({
      provider: first,
      doc: first.configuration.document,
      isConnected: true,
      isSynced: true,
    });

    await act(async () => {
      root?.render(<Harness locale="ko" />);
      await Promise.resolve();
    });

    const firstKoreanRender = snapshots.find((snapshot) => snapshot.name.endsWith(':ko'));
    expect(firstKoreanRender?.connection).toEqual({
      provider: null,
      doc: null,
      isConnected: false,
      isSynced: false,
    });
    expect(providerState.instances.at(-1)?.configuration.name).toBe(`email-layout:${entityId}:ko`);
    expect(snapshots.at(-1)?.connection.doc).not.toBe(first.configuration.document);
    expect(snapshots.at(-1)?.connection.isSynced).toBe(false);

    act(() => first.configuration.onSynced?.());
    expect(snapshots.at(-1)?.connection.isSynced).toBe(false);
  });
});
