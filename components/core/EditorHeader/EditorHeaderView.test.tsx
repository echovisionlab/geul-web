// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EditorHeaderView } from './EditorHeaderView';

vi.mock('@mantine/hooks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@mantine/hooks')>()),
  useMediaQuery: vi.fn(() => false),
}));
const labels = {
  title: 'Title',
  back: 'Back',
  untitled: 'Untitled',
  delete: 'Delete',
  cancel: 'Cancel',
  close: 'Close',
  changeStatus: 'Change status',
  collabButton: 'Collaboration',
  connection: 'Connection',
  current: 'Current',
  status: 'Status',
  actions: 'Actions',
  syncStatus: 'Synced',
};
let dispose: (() => void) | undefined;
afterEach(() => {
  dispose?.();
  dispose = undefined;
});
describe('EditorHeader collaboration semantics', () => {
  it('keeps collaboration name stable and represents synchronization as a separate description', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    dispose = () => {
      act(() => root.unmount());
      host.remove();
    };
    const props = {
      title: 'Draft post',
      onBack: vi.fn(),
      isConnected: true,
      isSynced: true,
      groupStatusWithCollab: true,
      labels,
    };
    act(() => root.render(<EditorHeaderView {...props} />));
    const button = host.querySelector('[data-testid="editor-header-collab-button"]')!;
    expect(button.getAttribute('aria-label')).toBe('Collaboration');
    const descriptionId = button.getAttribute('aria-describedby')!;
    expect(document.getElementById(descriptionId)?.textContent).toBe('Synced');
    act(() =>
      root.render(<EditorHeaderView {...props} isSynced={false} labels={{ ...labels, syncStatus: 'Syncing' }} />),
    );
    expect(button.getAttribute('aria-label')).toBe('Collaboration');
    expect(document.getElementById(descriptionId)?.textContent).toBe('Syncing');
    expect(button.querySelector('span')?.textContent).not.toBe('Syncing');
  });
});
