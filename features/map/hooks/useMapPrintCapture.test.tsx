// @vitest-environment jsdom
import { act, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Map } from 'maplibre-gl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useMapPrintCapture } from './useMapPrintCapture';

const mocks = vi.hoisted(() => ({ imports: 0, toJpeg: vi.fn() }));
vi.mock('dom-to-image-more', () => {
  mocks.imports += 1;
  return { default: { toJpeg: mocks.toJpeg } };
});

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: Root | null = null;
const canvasCapture = vi.fn(() => 'data:image/jpeg;base64,canvas');
const mapRef = {
  current: {
    loaded: () => true,
    areTilesLoaded: () => true,
    getCanvas: () => ({ toDataURL: canvasCapture }),
    once: vi.fn(),
    off: vi.fn(),
  },
} as unknown as RefObject<Map | null>;
const containerRef: RefObject<HTMLDivElement | null> = { current: null };

function Probe() {
  const imageUrl = useMapPrintCapture({ mapRef, containerRef, isReady: true });
  return <div data-image={imageUrl ?? ''} />;
}

async function mount() {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  host = document.createElement('div');
  containerRef.current = host;
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root!.render(<Probe />);
  });
}

async function beforePrint() {
  await act(async () => {
    window.dispatchEvent(new Event('beforeprint'));
    await Promise.resolve();
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  root = null;
  host?.remove();
  host = null;
  containerRef.current = null;
  mocks.toJpeg.mockReset();
  canvasCapture.mockClear();
  vi.unstubAllGlobals();
});

describe('useMapPrintCapture', () => {
  it('keeps the settled canvas snapshot without loading DOM capture until print', async () => {
    mocks.toJpeg.mockResolvedValue('data:image/jpeg;base64,dom');
    await mount();
    expect(mocks.imports).toBe(0);
    expect(canvasCapture).toHaveBeenCalledTimes(1);
    expect(host?.firstElementChild?.getAttribute('data-image')).toBe('data:image/jpeg;base64,canvas');
    await beforePrint();
    await vi.waitFor(() => expect(mocks.toJpeg).toHaveBeenCalledTimes(1));
    expect(mocks.imports).toBe(1);
    expect(host?.firstElementChild?.getAttribute('data-image')).toBe('data:image/jpeg;base64,dom');
    await beforePrint();
    expect(mocks.toJpeg).toHaveBeenCalledTimes(1);
  });

  it('falls back to the canvas after DOM capture rejects and permits a later retry', async () => {
    mocks.toJpeg
      .mockRejectedValueOnce(new Error('DOM capture unavailable'))
      .mockResolvedValue('data:image/jpeg;base64,retry');
    await mount();
    await beforePrint();
    expect(canvasCapture).toHaveBeenCalledTimes(2);
    expect(host?.firstElementChild?.getAttribute('data-image')).toBe('data:image/jpeg;base64,canvas');
    await beforePrint();
    expect(mocks.toJpeg).toHaveBeenCalledTimes(2);
    expect(host?.firstElementChild?.getAttribute('data-image')).toBe('data:image/jpeg;base64,retry');
  });

  it('does not capture an obsolete container after unmount while DOM capture is pending', async () => {
    let rejectCapture!: (reason: Error) => void;
    mocks.toJpeg.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectCapture = reject;
      }),
    );
    await mount();
    await beforePrint();
    expect(mocks.toJpeg).toHaveBeenCalledTimes(1);
    act(() => {
      root!.unmount();
      root = null;
    });
    await act(async () => {
      rejectCapture(new Error('cancelled'));
      await Promise.resolve();
    });
    expect(canvasCapture).toHaveBeenCalledTimes(1);
  });
});
