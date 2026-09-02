// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { ArtistDeleteDialogView } from './ArtistDeleteDialogView';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('ArtistDeleteDialogView', () => {
  it('renders exact relation impacts and emits confirmation', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onConfirm = vi.fn();
    act(() =>
      root.render(
        <MantineProvider>
          <ArtistDeleteDialogView
            opened
            artistName="Example Artist"
            previewLoading={false}
            deleting={false}
            previewError={null}
            preview={{
              revision: 'revision-1',
              totalRelationCount: 3,
              impacts: [
                { domain: 2, entityId: 'label-1', label: 'Example Label', relationCount: 1 },
                { domain: 4, entityId: 'release-1', label: 'Example Release', relationCount: 2 },
              ],
            }}
            labels={{
              title: 'Delete artist',
              confirm: 'Delete',
              cancel: 'Cancel',
              close: 'Close',
              loading: 'Loading…',
              failed: 'Failed',
              confirmation: 'Delete {name}?',
              relationSummary: '{count} related items will be unlinked.',
            }}
            onClose={() => {}}
            onConfirm={onConfirm}
          />
        </MantineProvider>,
      ),
    );
    expect(document.body.textContent).toContain('Example Label (1)');
    expect(document.body.textContent).toContain('Example Release (2)');
    const button = Array.from(document.querySelectorAll('button')).find((item) => item.textContent === 'Delete');
    act(() => button?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    act(() => root.unmount());
    host.remove();
  });
});
