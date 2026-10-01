// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { notifications } from '@mantine/notifications';
import { useDebouncedPatch } from '@/lib/editor/useDebouncedPatch';
import { clearEditorSaveRecovery } from '@/lib/editor/editor-save-recovery';
import { useEditorNavigation } from './useEditorNavigation';

vi.mock('next-intl', () => ({ useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}` }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));

let root: Root;
let host: HTMLDivElement;
let edit: ReturnType<typeof useDebouncedPatch<{ title?: string }>>;
let performNavigation: ReturnType<typeof useEditorNavigation>;
let navigationResult: Promise<boolean> | undefined;

function Editor({
  write,
  onNavigate,
}: {
  write: (patch: { title?: string }) => Promise<void>;
  onNavigate: () => void;
}) {
  edit = useDebouncedPatch({
    write,
    delay: 500,
    scope: 'post-one',
    document: 'post:one',
    recoveryScope: 'post-room:one:en',
  });
  performNavigation = useEditorNavigation('post:one');
  return (
    <button
      type="button"
      onClick={() => {
        navigationResult = performNavigation(onNavigate);
      }}
    >
      Leave editor
    </button>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  window.sessionStorage.clear();
  host = document.createElement('div');
  root = createRoot(host);
  navigationResult = undefined;
});

afterEach(() => {
  act(() => root.unmount());
  clearEditorSaveRecovery('post-room:one:en');
  window.sessionStorage.clear();
  vi.useRealTimers();
});

it('waits for a clicked navigation intent until the registered save is acknowledged', async () => {
  let finish!: () => void;
  const write = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const onNavigate = vi.fn();
  act(() => root.render(<Editor write={write} onNavigate={onNavigate} />));
  act(() => edit({ title: 'draft' }));

  act(() => host.querySelector('button')?.click());
  expect(write).toHaveBeenCalledExactlyOnceWith({ title: 'draft' });
  expect(onNavigate).not.toHaveBeenCalled();

  await act(async () => {
    finish();
    await navigationResult;
  });

  expect(await navigationResult).toBe(true);
  expect(onNavigate).toHaveBeenCalledOnce();
});

it('keeps the editor mounted and reports the common save failure when acknowledgement fails', async () => {
  const write = vi.fn().mockRejectedValue(new Error('permission denied'));
  const onNavigate = vi.fn();
  act(() => root.render(<Editor write={write} onNavigate={onNavigate} />));
  act(() => edit({ title: 'draft' }));
  act(() => host.querySelector('button')?.click());

  await act(async () => {
    await navigationResult;
  });

  expect(await navigationResult).toBe(false);
  expect(onNavigate).not.toHaveBeenCalled();
  expect(host.querySelector('button')?.textContent).toBe('Leave editor');
  expect(notifications.show).toHaveBeenCalledWith({
    message: 'common.notifications.saveFailed',
    color: 'red',
  });
});
