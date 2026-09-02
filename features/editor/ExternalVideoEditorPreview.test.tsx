// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExternalVideoViewProps } from '@/features/media/ExternalVideoView';
import { ExternalVideoEditorPreview } from './ExternalVideoEditorPreview';

const labels = {
  editLink: 'Edit link',
  showPreview: 'Preview',
  aspectRatio: 'Aspect ratio',
  automaticAspectRatio: 'Auto',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
};

function FixtureVideoView({ title }: ExternalVideoViewProps) {
  return <div data-testid="video-view">{title}</div>;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  host = null;
  root = null;
});

describe('ExternalVideoEditorPreview', () => {
  it('leaves the preview surface mousedown to the editor selection owner', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onSelect = vi.fn();

    act(() => {
      root?.render(
        <ExternalVideoEditorPreview
          mode="preview"
          video={{
            url: 'https://youtu.be/dQw4w9WgXcQ',
            title: 'Field recording',
            previewWidth: '64',
            textAlignment: 'left',
            aspectRatio: 'auto',
          }}
          labels={labels}
          editable
          selected={false}
          onSelect={onSelect}
          onShowPreview={vi.fn()}
          onPreviewWidthChange={vi.fn()}
          videoView={FixtureVideoView}
        />,
      );
    });

    expect(host.querySelector('[data-external-video-editor-toolbar]')).toBeNull();
    expect(host.querySelector('button[aria-label="Align right"]')).toBeNull();
    expect(host.querySelector('[data-resize-handle]')).toBeNull();

    act(() => {
      host
        ?.querySelector<HTMLElement>('[data-external-video-editor-preview]')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('selects the preview when its shield is activated from the keyboard', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onSelect = vi.fn();

    act(() => {
      root?.render(
        <ExternalVideoEditorPreview
          mode="preview"
          video={{
            url: 'https://youtu.be/dQw4w9WgXcQ',
            title: 'Field recording',
            previewWidth: '64',
            textAlignment: 'left',
            aspectRatio: 'auto',
          }}
          labels={labels}
          editable
          selected={false}
          onSelect={onSelect}
          onShowPreview={vi.fn()}
          onPreviewWidthChange={vi.fn()}
          videoView={FixtureVideoView}
        />,
      );
    });

    const selectionShield = host.querySelector<HTMLButtonElement>('button[aria-label="Field recording"]');
    expect(selectionShield).toBeTruthy();

    act(() => {
      selectionShield?.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('cancels an active resize when editing is revoked', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const onPreviewWidthChange = vi.fn();
    const renderPreview = (editable: boolean, selected: boolean) => (
      <div data-node-type="blockContainer">
        <ExternalVideoEditorPreview
          mode="preview"
          video={{
            url: 'https://youtu.be/dQw4w9WgXcQ',
            title: 'Field recording',
            previewWidth: '64',
            textAlignment: 'left',
            aspectRatio: 'auto',
          }}
          labels={labels}
          editable={editable}
          selected={selected}
          onSelect={vi.fn()}
          onShowPreview={vi.fn()}
          onPreviewWidthChange={onPreviewWidthChange}
          videoView={FixtureVideoView}
        />
      </div>
    );

    act(() => root?.render(renderPreview(true, true)));
    Object.defineProperty(host, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 1000 }),
    });
    const frame = host.querySelector<HTMLElement>('[data-selected="true"]');
    Object.defineProperty(frame, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ width: 640 }),
    });
    const handle = host.querySelector<HTMLElement>('[data-resize-direction="right"]');
    if (!frame || !handle) {
      throw new Error('Expected selected preview resize controls.');
    }
    const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 640 });
    Object.defineProperty(pointerDown, 'pointerId', { value: 7 });
    act(() => handle?.dispatchEvent(pointerDown));
    expect(host.querySelector('[data-resize-drag-shield]')).toBeTruthy();

    act(() => root?.render(renderPreview(false, false)));
    expect(host.querySelector('[data-resize-handle]')).toBeNull();
    expect(host.querySelector('[data-resize-drag-shield]')).toBeNull();
    expect(host.querySelector('[data-selected="true"]')).toBeNull();

    const pointerUp = new MouseEvent('pointerup', { bubbles: true, cancelable: true, clientX: 700 });
    Object.defineProperty(pointerUp, 'pointerId', { value: 7 });
    act(() => frame?.dispatchEvent(pointerUp));
    expect(onPreviewWidthChange).not.toHaveBeenCalled();
  });
});
