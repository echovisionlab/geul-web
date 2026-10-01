// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProgramEventEditorAction } from './program-event-actions';
import { useProgramEventLifecycle } from './useProgramEventLifecycle';

const mutationState = vi.hoisted(() => ({
  mutates: [] as Array<ReturnType<typeof vi.fn>>,
  mutateAsynces: [] as Array<ReturnType<typeof vi.fn>>,
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: () => {
    const mutate = vi.fn();
    const mutateAsync = vi.fn().mockResolvedValue({ success: true });
    mutationState.mutates.push(mutate);
    mutationState.mutateAsynces.push(mutateAsync);
    return { mutate, mutateAsync, isPending: false };
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

let latest: ReturnType<typeof useProgramEventLifecycle> | null = null;
let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Harness({ allowedActions }: { allowedActions: readonly ProgramEventEditorAction[] }) {
  latest = useProgramEventLifecycle({
    eventId: '11111111-1111-4111-8111-111111111111',
    initialStatus: 'archived',
    allowedActions,
  });
  return null;
}

beforeEach(() => {
  latest = null;
  mutationState.mutates.length = 0;
  mutationState.mutateAsynces.length = 0;
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

describe('useProgramEventLifecycle action authority', () => {
  it('fails closed for every archived Author mutation command', async () => {
    act(() => root?.render(<Harness allowedActions={[]} />));

    act(() => {
      latest?.changeStatus('published');
      latest?.changeStatus('archived');
      latest?.deleteEvent.mutate();
    });

    expect(mutationState.mutates).toHaveLength(4);
    for (const mutate of mutationState.mutates) {
      expect(mutate).not.toHaveBeenCalled();
    }
    await expect(latest?.saveEditableEvent({ title: 'blocked' })).resolves.toMatchObject({
      error: 'notifications.saveFailed',
    });
    expect(mutationState.mutateAsynces[0]).not.toHaveBeenCalled();
    expect(latest?.canEdit).toBe(false);
    expect(latest?.canDelete).toBe(false);
    expect(latest?.statusOptions.map((option) => option.value)).toEqual(['archived']);
  });

  it('routes queued Event saves and only exact lifecycle actions granted to an archived Admin', async () => {
    act(() => root?.render(<Harness allowedActions={['edit', 'publish', 'delete']} />));

    await act(async () => {
      await latest?.saveEditableEvent({ title: 'allowed' });
      latest?.changeStatus('published');
      latest?.changeStatus('archived');
      latest?.deleteEvent.mutate();
    });

    const [update, publish, archive, remove] = mutationState.mutates;
    expect(update).not.toHaveBeenCalled();
    expect(mutationState.mutateAsynces[0]).toHaveBeenCalledWith({ title: 'allowed' });
    expect(publish).toHaveBeenCalledOnce();
    expect(archive).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
    expect(latest?.statusOptions.map((option) => option.value)).toEqual(['archived', 'published']);
  });
});
