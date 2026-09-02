// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import type { ImmersiveSceneConfig } from './schema';
import type { ImmersiveSceneUploadControls } from './SettingsForm';
import { ImmersiveSceneWorkspaceContent } from './Workspace';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

vi.mock('./SceneRenderer', () => ({
  ImmersiveSceneRenderer: ({ config, progress }: { config: ImmersiveSceneConfig; progress: number }) => (
    <output data-testid="scene-preview-state">
      {config.units.length}:{progress}
    </output>
  ),
}));

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function installDomMocks() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

function render(node: ReactNode) {
  container = document.createElement('div');
  container.style.height = '720px';
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

function createUploadControls(): ImmersiveSceneUploadControls {
  return {
    uploadMeshFile: vi.fn(),
    uploadTextureFile: vi.fn(),
    isUploadingMesh: false,
    isUploadingTexture: false,
    meshAcceptString: '.glb',
    textureAcceptString: 'image/png,image/webp',
    abortMeshUpload: vi.fn(),
    abortTextureUpload: vi.fn(),
  };
}

function findButtonByText(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(text),
  );
}

beforeEach(() => {
  installDomMocks();
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('ImmersiveSceneWorkspaceContent', () => {
  it('keeps all units collapsed initially and preserves preview selection when closing one', async () => {
    render(
      <ImmersiveSceneWorkspaceContent
        sectionId="scene-section"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            { id: 'opening', name: 'Opening', mesh: 'sphere', color: '#fff' },
            { id: 'signal', name: 'Signal field', mesh: 'torus', color: '#0ff' },
            { id: 'finale', name: 'Finale', mesh: 'cone', color: '#f80' },
          ]),
          copyJson: JSON.stringify([
            { id: 'opening', title: 'Opening', text: '' },
            { id: 'signal', title: 'Signal field', text: '' },
            { id: 'finale', title: 'Finale', text: '' },
          ]),
        }}
        updateSharedProps={vi.fn()}
        updateLocalizedProps={vi.fn()}
        uploadControls={createUploadControls()}
      />,
    );

    expect(document.querySelector('input[value="Opening"]')).toBeFalsy();
    expect(document.querySelector('[data-testid="scene-preview-state"]')?.textContent).toBe('3:0');

    const signalButton = findButtonByText('Signal field');
    await act(async () => {
      signalButton?.click();
      await Promise.resolve();
    });
    expect(document.querySelector('input[value="Signal field"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="scene-preview-state"]')?.textContent).toBe('3:0.5');

    await act(async () => {
      signalButton?.click();
      await Promise.resolve();
    });
    expect(document.querySelector('input[value="Signal field"]')).toBeFalsy();
    expect(document.querySelector('[data-testid="scene-preview-state"]')?.textContent).toBe('3:0.5');
  });
});
