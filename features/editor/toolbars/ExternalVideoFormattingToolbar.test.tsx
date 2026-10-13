// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ExternalVideoFormattingToolbar,
  type ExternalVideoFormattingToolbarProps,
} from './ExternalVideoFormattingToolbar';

const labels = {
  toolbar: 'Video layout',
  editLink: 'Edit link',
  aspectRatio: 'Aspect ratio',
  automaticAspectRatio: 'Auto',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
};

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

function renderToolbar({
  selection,
  enabled = true,
  onUpdateLayout = vi.fn(),
  onEditLink = vi.fn(),
}: {
  selection?: { aspectRatio: 'auto' | '16:9' | '4:3'; textAlignment: 'left' | 'center' | 'right' };
  enabled?: boolean;
  onUpdateLayout?: NonNullable<ExternalVideoFormattingToolbarProps['onUpdateLayout']>;
  onEditLink?: NonNullable<ExternalVideoFormattingToolbarProps['onEditLink']>;
} = {}) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(
      <DesignSystemProvider forceColorScheme="light">
        <ExternalVideoFormattingToolbar
          labels={labels}
          selection={selection}
          enabled={enabled}
          onUpdateLayout={onUpdateLayout}
          onEditLink={onEditLink}
        >
          <button type="button" aria-label="Bold" />
        </ExternalVideoFormattingToolbar>
      </DesignSystemProvider>,
    );
  });
  return { onUpdateLayout, onEditLink };
}

describe('ExternalVideoFormattingToolbar', () => {
  it('renders selected-video controls and sends layout commands through its ports', () => {
    const { onUpdateLayout, onEditLink } = renderToolbar({
      selection: { aspectRatio: 'auto', textAlignment: 'left' },
    });

    expect(container?.querySelector('button[aria-label="Bold"]')).toBeNull();
    expect(container?.querySelectorAll('button')).toHaveLength(5);
    expect(container?.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe('Video layout');
    expect(container?.querySelector('button[aria-label="Align left"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(container?.querySelector('button[aria-label="Align right"]')?.getAttribute('aria-pressed')).toBe('false');

    act(() => {
      container?.querySelector<HTMLButtonElement>('button[aria-label="Align right"]')?.click();
    });
    expect(onUpdateLayout).toHaveBeenCalledWith({ textAlignment: 'right' });

    act(() => {
      container?.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]')?.click();
    });
    expect(onEditLink).toHaveBeenCalledOnce();
  });

  it('delegates to normal controls without a selected video and disables unavailable commands', () => {
    renderToolbar();
    expect(container?.querySelector('button[aria-label="Bold"]')).toBeTruthy();

    act(() => root?.unmount());
    root = createRoot(container!);
    act(() => {
      root?.render(
        <DesignSystemProvider forceColorScheme="light">
          <ExternalVideoFormattingToolbar
            labels={labels}
            selection={{ aspectRatio: '16:9', textAlignment: 'center' }}
            enabled={false}
          >
            <button type="button" aria-label="Bold" />
          </ExternalVideoFormattingToolbar>
        </DesignSystemProvider>,
      );
    });

    expect(container?.querySelector('button[aria-label="Bold"]')).toBeNull();
    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Align center"]')?.disabled).toBe(true);
    expect(container?.querySelector<HTMLButtonElement>('button[aria-label="Edit link"]')?.disabled).toBe(true);
  });
});
