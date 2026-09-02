// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileClient } from '@/lib/api/browser-client';
import { mediaDeliveryFixture } from '@/tests/helpers/media-delivery';
import { parseImmersiveSceneConfig, type ImmersiveSceneProps } from './schema';
import { fetchAuthenticatedImmersiveSceneMedia, useAuthenticatedImmersiveSceneProps } from './useAuthenticatedMedia';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/lib/api/browser-client', () => ({
  createFileClient: vi.fn(),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function render(node: ReactNode) {
  container ??= document.createElement('div');
  if (!container.isConnected) {
    document.body.appendChild(container);
  }
  root ??= createRoot(container);
  act(() => root?.render(node));
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function Harness({ props }: { props: Partial<ImmersiveSceneProps> }) {
  const hydratedProps = useAuthenticatedImmersiveSceneProps(props);
  const unit = parseImmersiveSceneConfig(hydratedProps).units[0];
  return (
    <output
      data-source-url={unit.meshUrl ?? ''}
      data-source-name={unit.meshFileName ?? ''}
      data-optimized-url={unit.meshOptimizationUrl ?? ''}
      data-optimized-name={unit.meshOptimizationFileName ?? ''}
    />
  );
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe('useAuthenticatedImmersiveSceneProps', () => {
  it('chunks 201 unique editor media IDs without N+1 calls and merges every delivery', async () => {
    const getBulkMediaDeliveries = vi.fn().mockImplementation(async ({ fileIds }: { fileIds: string[] }) => ({
      files: Object.fromEntries(
        fileIds.map((fileId) => [
          fileId,
          {
            delivery: mediaDeliveryFixture({
              fileId,
              assetUrl: `https://cdn.example/${fileId}.glb`,
            }),
          },
        ]),
      ),
    }));
    vi.mocked(createFileClient).mockReturnValue({ getBulkMediaDeliveries } as never);
    const fileIds = Array.from({ length: 201 }, (_, index) => `file-${index + 1}`);

    const deliveries = await fetchAuthenticatedImmersiveSceneMedia([...fileIds, 'file-1', ' file-2 ']);

    expect(getBulkMediaDeliveries).toHaveBeenCalledTimes(3);
    expect(getBulkMediaDeliveries.mock.calls.map(([request]) => request.fileIds.length)).toEqual([100, 100, 1]);
    expect(getBulkMediaDeliveries.mock.calls.flatMap(([request]) => request.fileIds)).toEqual(fileIds);
    expect(Object.keys(deliveries)).toHaveLength(201);
    expect(deliveries['file-201']?.asset?.url).toBe('https://cdn.example/file-201.glb');
  });

  it('bulk hydrates editor assets again when durable IDs change', async () => {
    const getBulkMediaDeliveries = vi.fn().mockImplementation(async ({ fileIds }: { fileIds: string[] }) => ({
      files: Object.fromEntries(
        fileIds.map((fileId) => [
          fileId,
          {
            delivery: mediaDeliveryFixture({
              fileId,
              assetUrl: `https://cdn.example/${fileId}.glb`,
              downloadUrl: `https://signed.example/${fileId}.glb`,
              fileName: `${fileId}.glb`,
              fileSize: fileId === 'optimized-file' ? BigInt(1024) : BigInt(2048),
            }),
          },
        ]),
      ),
    }));
    vi.mocked(createFileClient).mockReturnValue({ getBulkMediaDeliveries } as never);

    const sourceProps: Partial<ImmersiveSceneProps> = {
      unitsJson: JSON.stringify([
        {
          id: 'unit-1',
          mesh: 'sphere',
          meshSource: 'file',
          meshFileId: 'source-file',
          color: '#ffffff',
        },
      ]),
    };
    render(<Harness props={sourceProps} />);
    await flushEffects();

    expect(getBulkMediaDeliveries).toHaveBeenLastCalledWith({ fileIds: ['source-file'] });
    expect(container?.querySelector('output')?.getAttribute('data-source-url')).toBe(
      'https://cdn.example/source-file.glb',
    );
    expect(container?.querySelector('output')?.getAttribute('data-source-name')).toBe('source-file.glb');

    const optimizedProps: Partial<ImmersiveSceneProps> = {
      unitsJson: JSON.stringify([
        {
          id: 'unit-1',
          mesh: 'sphere',
          meshSource: 'file',
          meshFileId: 'source-file',
          meshOptimizationFileId: 'optimized-file',
          color: '#ffffff',
        },
      ]),
    };
    render(<Harness props={optimizedProps} />);
    await flushEffects();

    expect(getBulkMediaDeliveries).toHaveBeenLastCalledWith({
      fileIds: ['optimized-file', 'source-file'],
    });
    expect(container?.querySelector('output')?.getAttribute('data-optimized-url')).toBe(
      'https://cdn.example/optimized-file.glb',
    );
    expect(container?.querySelector('output')?.getAttribute('data-optimized-name')).toBe('optimized-file.glb');
    expect(optimizedProps.unitsJson).not.toContain('Url');
    expect(optimizedProps.unitsJson).not.toContain('FileName');
  });
});
