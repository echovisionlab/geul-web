// @vitest-environment jsdom

import { act, type ReactNode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { MESH_OPTIMIZATION_METHOD_DRACO } from '@/lib/types/mesh-optimization';
import { ImmersiveSceneSettingsForm, type ImmersiveSceneUploadControls } from './SettingsForm';
import type { ImmersiveSceneProps } from './schema';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

vi.mock('./DescriptionEditor', () => ({
  ImmersiveSceneDescriptionEditor: ({
    label,
    value,
    onChange,
    testId,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    testId?: string;
  }) => (
    <label>
      {label}
      <textarea data-testid={testId} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
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
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(<MantineProvider>{node}</MantineProvider>);
  });
}

interface ControlledSettingsFormProps {
  initialProps: Partial<ImmersiveSceneProps>;
  uploadControls: ImmersiveSceneUploadControls;
  panel?: 'unit' | 'scene';
  onSharedUpdate?: (patch: Record<string, unknown>) => void;
  onLocalizedUpdate?: (patch: Record<string, unknown>) => void;
}

function ControlledSettingsForm({
  initialProps,
  uploadControls,
  panel,
  onSharedUpdate,
  onLocalizedUpdate,
}: ControlledSettingsFormProps) {
  const [currentProps, setCurrentProps] = useState(initialProps);
  const applyPatch = (
    patch: Record<string, unknown>,
    notify: ((nextPatch: Record<string, unknown>) => void) | undefined,
  ) => {
    notify?.(patch);
    setCurrentProps((current) => ({ ...current, ...patch }) as Partial<ImmersiveSceneProps>);
  };

  return (
    <>
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={currentProps}
        updateSharedProps={(patch) => applyPatch(patch, onSharedUpdate)}
        updateLocalizedProps={(patch) => applyPatch(patch, onLocalizedUpdate)}
        uploadControls={uploadControls}
        panel={panel}
      />
      <output data-testid="immersive-scene-current-props">{JSON.stringify(currentProps)}</output>
    </>
  );
}

async function flushEffects() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function flushTimers() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function clickElement(element: HTMLElement | null | undefined) {
  expect(element).toBeTruthy();
  await act(async () => {
    element?.click();
    await Promise.resolve();
  });
}

async function openUnit(name: string) {
  await clickElement(findButtonByText(name));
}

async function selectUnitTab(tabKey: string) {
  await clickElement(findButtonByText(tabKey));
}

function findFileInput(acceptFragment: string, index = 0) {
  return [...document.querySelectorAll<HTMLInputElement>('input[type="file"]')].filter((input) =>
    input.accept.includes(acceptFragment),
  )[index];
}

async function selectFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  Object.defineProperty(input, 'value', {
    value: `C:\\fakepath\\${file.name}`,
    writable: true,
    configurable: true,
  });
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

function readControlledProps(): Partial<ImmersiveSceneProps> {
  const value = document.querySelector('[data-testid="immersive-scene-current-props"]')?.textContent;
  return JSON.parse(value || '{}') as Partial<ImmersiveSceneProps>;
}

function findInputByLabelText(text: string) {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  return label?.control ?? label?.querySelector<HTMLInputElement>('input') ?? undefined;
}

async function pressSlider(label: string, key = 'ArrowRight') {
  const slider = document.querySelector<HTMLElement>(`[role="slider"][aria-label="${label}"]`);
  expect(slider).toBeTruthy();
  await act(async () => {
    slider?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    await Promise.resolve();
  });
}

async function changeNumberInput(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).toBeTruthy();
  await act(async () => {
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    valueSetter?.call(input, value);
    input?.dispatchEvent(new Event('input', { bubbles: true }));
    input?.dispatchEvent(new Event('change', { bubbles: true }));
    await Promise.resolve();
  });
}

async function waitForButtonByText(text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const button = findButtonByText(text);
    if (button) {
      return button;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    await flushEffects();
  }
  return undefined;
}

async function waitForText(text: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (document.body.textContent?.includes(text)) {
      return true;
    }
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 25));
    });
    await flushEffects();
  }
  return false;
}

function createUploadControls(overrides: Partial<ImmersiveSceneUploadControls> = {}): ImmersiveSceneUploadControls {
  return {
    uploadMeshFile: vi.fn<ImmersiveSceneUploadControls['uploadMeshFile']>(),
    uploadTextureFile: vi.fn<ImmersiveSceneUploadControls['uploadTextureFile']>(),
    isUploadingMesh: false,
    isUploadingTexture: false,
    meshAcceptString: '.glb,.gltf,model/gltf-binary',
    textureAcceptString: 'image/png,image/jpeg,image/webp',
    abortMeshUpload: vi.fn(),
    abortTextureUpload: vi.fn(),
    ...overrides,
  };
}

function findButtonByText(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(text),
  );
}

function findButtonByAriaLabel(label: string) {
  return document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

async function changeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

async function changeTextareaValue(input: HTMLTextAreaElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await Promise.resolve();
  });
}

beforeEach(() => {
  installDomMocks();
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  document.body.innerHTML = '';
  root = null;
  container = null;
  vi.restoreAllMocks();
});

describe('ImmersiveSceneSettingsForm', () => {
  it('renders named units as a vertical accordion collapsed by default', async () => {
    const updateSharedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            {
              id: 'unit-1',
              name: 'Opening',
              mesh: 'sphere',
              color: '#ffffff',
            },
            {
              id: 'unit-2',
              name: 'Finale',
              mesh: 'cone',
              color: '#111111',
            },
          ]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={vi.fn()}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    const openingButton = findButtonByText('Opening');
    const finaleButton = findButtonByText('Finale');
    expect(openingButton).toBeTruthy();
    expect(finaleButton).toBeTruthy();
    expect(document.querySelector('input[value="Opening"]')).toBeFalsy();

    await act(async () => {
      openingButton?.click();
      await Promise.resolve();
    });

    expect(document.querySelector('input[value="Opening"]')).toBeTruthy();

    const meshTab = findButtonByText('blockEditor.sections.sceneMesh');
    await act(async () => {
      meshTab?.click();
      await Promise.resolve();
    });

    const meshScaleControl = document.querySelector<HTMLElement>('[data-testid="immersive-scene-mesh-scale-unit-1"]');
    const meshScaleInput =
      meshScaleControl instanceof HTMLInputElement
        ? meshScaleControl
        : meshScaleControl?.querySelector<HTMLInputElement>('input');
    expect(meshScaleInput?.value).toBe('1');
    if (meshScaleInput) {
      await changeInputValue(meshScaleInput, '1.8');
    }
    const meshScaleUpdate = [...updateSharedProps.mock.calls]
      .reverse()
      .map(([value]) => value as { unitsJson?: string })
      .find((value) => JSON.parse(value.unitsJson ?? '[]')[0]?.scale === '1.8');
    expect(JSON.parse(meshScaleUpdate?.unitsJson ?? '[]')[0]).toMatchObject({
      id: 'unit-1',
      scale: '1.8',
    });

    const particleSizeControl = document.querySelector<HTMLElement>(
      '[data-testid="immersive-scene-particle-size-unit-1"]',
    );
    const particleSizeInput =
      particleSizeControl instanceof HTMLInputElement
        ? particleSizeControl
        : particleSizeControl?.querySelector<HTMLInputElement>('input');
    expect(particleSizeInput?.value).toBe('');
    expect(particleSizeInput?.placeholder).toBe('1');

    if (particleSizeInput) {
      await changeInputValue(particleSizeInput, '0.6');
    }
    const serializedUpdate = [...updateSharedProps.mock.calls]
      .reverse()
      .map(([value]) => value as { unitsJson?: string })
      .find((value) => value.unitsJson);
    expect(JSON.parse(serializedUpdate?.unitsJson ?? '[]')[0]).toMatchObject({
      id: 'unit-1',
      particleSize: '0.6',
    });

    if (particleSizeInput) {
      await changeInputValue(particleSizeInput, '4.0');
    }
    const decimalUpdate = [...updateSharedProps.mock.calls]
      .reverse()
      .map(([value]) => value as { unitsJson?: string })
      .find((value) => value.unitsJson);
    expect(JSON.parse(decimalUpdate?.unitsJson ?? '[]')[0]).toMatchObject({
      id: 'unit-1',
      particleSize: '4.0',
    });

    await act(async () => {
      openingButton?.click();
      await Promise.resolve();
    });

    expect(document.querySelector('input[value="Opening"]')).toBeFalsy();
  });

  it('updates the selected unit mesh height offset in shared visual state', async () => {
    const updateSharedProps = vi.fn();
    const updateLocalizedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            { id: 'unit-1', name: 'Opening', mesh: 'sphere', meshOffsetY: '1.4', color: '#ffffff' },
            { id: 'unit-2', name: 'Middle', mesh: 'box', color: '#777777' },
          ]),
          copyJson: JSON.stringify([
            { id: 'unit-1', title: 'Opening', text: 'Localized opening' },
            { id: 'unit-2', title: 'Middle', text: 'Localized middle' },
          ]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={updateLocalizedProps}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Middle')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      findButtonByText('blockEditor.sections.sceneMesh')?.click();
      await Promise.resolve();
    });

    const offsetControl = document.querySelector('[data-testid="immersive-scene-mesh-offset-y-unit-2"]');
    const slider = offsetControl?.querySelector<HTMLElement>('[role="slider"]');
    expect(offsetControl?.textContent).toContain('blockEditor.labels.meshOffsetY');
    expect(slider?.getAttribute('aria-valuenow')).toBe('0');
    expect(document.querySelector('[data-testid="immersive-scene-mesh-offset-y-value-unit-2"]')?.textContent).toBe(
      '0.0',
    );

    await act(async () => {
      slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await Promise.resolve();
    });

    const sharedUnits = JSON.parse(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson) as Array<
      Record<string, unknown>
    >;
    expect(sharedUnits).toEqual([
      expect.objectContaining({ id: 'unit-1', meshOffsetY: '1.4' }),
      expect.objectContaining({ id: 'unit-2', meshOffsetY: '0.1' }),
    ]);
    expect(JSON.parse(updateLocalizedProps.mock.calls.at(-1)?.[0].copyJson)).toEqual([
      { id: 'unit-1', title: 'Opening', text: 'Localized opening' },
      { id: 'unit-2', title: 'Middle', text: 'Localized middle' },
    ]);
  });

  it('omits the optional mesh height offset after resetting it to zero', async () => {
    const updateSharedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([{ id: 'unit-1', mesh: 'sphere', meshOffsetY: '0.1', color: '#ffffff' }]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={vi.fn()}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Unit 1')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      findButtonByText('blockEditor.sections.sceneMesh')?.click();
      await Promise.resolve();
    });

    const slider = document.querySelector<HTMLElement>(
      '[data-testid="immersive-scene-mesh-offset-y-unit-1"] [role="slider"]',
    );
    expect(slider?.getAttribute('aria-valuenow')).toBe('0.1');

    await act(async () => {
      slider?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      await Promise.resolve();
    });

    expect(JSON.parse(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson)[0]).not.toHaveProperty('meshOffsetY');
  });

  it('labels unit copy as a description and preserves multiline input', async () => {
    const updateLocalizedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([{ id: 'unit-1', mesh: 'sphere', color: '#ffffff' }]),
          copyJson: JSON.stringify([{ id: 'unit-1', title: 'Opening', text: 'First line' }]),
        }}
        updateSharedProps={vi.fn()}
        updateLocalizedProps={updateLocalizedProps}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Unit 1')?.click();
      await Promise.resolve();
    });

    const descriptionInput = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="immersive-scene-unit-description-unit-1"]',
    );
    expect(descriptionInput).toBeTruthy();
    expect(document.body.textContent).toContain('blockEditor.labels.description');

    await changeTextareaValue(descriptionInput!, 'First line\nSecond line\n\nSeparate paragraph');

    expect(JSON.parse(updateLocalizedProps.mock.calls.at(-1)?.[0].copyJson)).toEqual([
      {
        id: 'unit-1',
        title: 'Opening',
        text: 'First line\nSecond line\n\nSeparate paragraph',
      },
    ]);
  });

  it('persists rich unit attribution only in shared visual state', async () => {
    const updateSharedProps = vi.fn();
    const updateLocalizedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            {
              id: 'unit-1',
              name: 'Opening',
              mesh: 'sphere',
              color: '#ffffff',
              attribution: 'Created by [Artist A](https://example.com/artists/a)',
            },
            { id: 'unit-2', name: 'Middle', mesh: 'box', color: '#777777' },
            {
              id: 'unit-3',
              name: 'Ending',
              mesh: 'cone',
              color: '#111111',
              attribution: 'Created by [Artist C](https://example.com/artists/c)',
            },
          ]),
          copyJson: JSON.stringify([
            { id: 'unit-1', title: 'Opening', text: 'Localized opening' },
            { id: 'unit-2', title: 'Middle', text: 'Localized middle' },
            { id: 'unit-3', title: 'Ending', text: 'Localized ending' },
          ]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={updateLocalizedProps}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Opening')?.click();
      await Promise.resolve();
    });

    const attributionInput = document.querySelector<HTMLTextAreaElement>(
      '[data-testid="immersive-scene-unit-attribution-unit-1"]',
    );
    expect(attributionInput).toBeTruthy();
    expect(document.body.textContent).toContain('blockEditor.labels.unitAttribution');

    await changeTextareaValue(attributionInput!, 'Created by [Artist B](https://example.com/artists/b)');

    const sharedUpdate = [...updateSharedProps.mock.calls]
      .reverse()
      .map(([value]) => value as { unitsJson?: string })
      .find((value) => value.unitsJson);
    const sharedUnits = JSON.parse(sharedUpdate?.unitsJson ?? '[]') as Array<Record<string, unknown>>;
    expect(sharedUnits.map((unit) => unit.attribution)).toEqual([
      'Created by [Artist B](https://example.com/artists/b)',
      undefined,
      'Created by [Artist C](https://example.com/artists/c)',
    ]);

    for (const [localizedUpdate] of updateLocalizedProps.mock.calls) {
      const localizedUnits = JSON.parse(String(localizedUpdate.copyJson)) as Array<Record<string, unknown>>;
      expect(localizedUnits).toEqual([
        { id: 'unit-1', title: 'Opening', text: 'Localized opening' },
        { id: 'unit-2', title: 'Middle', text: 'Localized middle' },
        { id: 'unit-3', title: 'Ending', text: 'Localized ending' },
      ]);
      expect(localizedUnits.every((unit) => !Object.hasOwn(unit, 'attribution'))).toBe(true);
    }

    await changeTextareaValue(attributionInput!, '');
    const clearedUpdate = [...updateSharedProps.mock.calls]
      .reverse()
      .map(([value]) => value as { unitsJson?: string })
      .find((value) => value.unitsJson);
    expect(JSON.parse(clearedUpdate?.unitsJson ?? '[]')[0]).not.toHaveProperty('attribution');
  });

  it('persists unit names and ordering only in shared visual state', async () => {
    const updateSharedProps = vi.fn();
    const updateLocalizedProps = vi.fn();
    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            {
              id: 'unit-1',
              name: 'Opening',
              mesh: 'sphere',
              color: '#ffffff',
            },
            {
              id: 'unit-2',
              name: 'Finale',
              mesh: 'cone',
              color: '#111111',
            },
          ]),
          copyJson: JSON.stringify([
            { id: 'unit-1', title: 'Hello', text: 'Opening copy' },
            { id: 'unit-2', title: 'Bye', text: 'Final copy' },
          ]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={updateLocalizedProps}
        uploadControls={createUploadControls()}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Opening')?.click();
      await Promise.resolve();
    });
    const nameInput = document.querySelector<HTMLInputElement>('input[value="Opening"]');
    expect(nameInput).toBeTruthy();
    await changeInputValue(nameInput!, 'Introduction');

    let visualUnits = JSON.parse(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson);
    expect(visualUnits[0]).toEqual(expect.objectContaining({ id: 'unit-1', name: 'Introduction' }));
    expect(JSON.parse(updateLocalizedProps.mock.calls.at(-1)?.[0].copyJson)).toEqual([
      { id: 'unit-1', title: 'Hello', text: 'Opening copy' },
      { id: 'unit-2', title: 'Bye', text: 'Final copy' },
    ]);

    await act(async () => {
      findButtonByAriaLabel('blockEditor.actions.moveUnitDown')?.click();
      await Promise.resolve();
    });

    visualUnits = JSON.parse(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson);
    expect(visualUnits.map((unit: { id: string }) => unit.id)).toEqual(['unit-2', 'unit-1']);
    expect(JSON.parse(updateLocalizedProps.mock.calls.at(-1)?.[0].copyJson)).toEqual([
      expect.objectContaining({ id: 'unit-2', title: 'Bye' }),
      expect.objectContaining({ id: 'unit-1', title: 'Hello' }),
    ]);
  });

  it('reports upload progress, cancels each uploader, and accepts the same mesh file again', async () => {
    const firstMeshUpload = createDeferred<{ fileId: string; url: string }>();
    const textureUpload = createDeferred<{ fileId: string; url: string }>();
    let meshAttempt = 0;
    const uploadMeshFile = vi.fn<ImmersiveSceneUploadControls['uploadMeshFile']>((_file, options) => {
      meshAttempt += 1;
      options.onProgress?.({ percentage: 35 });
      return meshAttempt === 1
        ? firstMeshUpload.promise
        : Promise.resolve({ fileId: 'mesh-retry', url: '/media/mesh-retry.glb' });
    });
    const uploadTextureFile = vi.fn<ImmersiveSceneUploadControls['uploadTextureFile']>((_file, options) => {
      options.onProgress?.({ percentage: 45 });
      return textureUpload.promise;
    });
    const abortMeshUpload = vi.fn();
    const abortTextureUpload = vi.fn();

    render(
      <ControlledSettingsForm
        initialProps={{
          unitsJson: JSON.stringify([
            {
              id: 'upload-unit',
              name: 'Upload unit',
              mesh: 'sphere',
              meshSource: 'file',
              color: '#ffffff',
              textureSource: 'image',
              darkTextureSource: 'image',
            },
          ]),
        }}
        uploadControls={createUploadControls({
          uploadMeshFile,
          uploadTextureFile,
          abortMeshUpload,
          abortTextureUpload,
        })}
      />,
    );

    await openUnit('Upload unit');
    await selectUnitTab('blockEditor.sections.sceneMesh');
    const meshFile = new File(['mesh'], 'triangle.glb', { type: 'model/gltf-binary' });
    let meshInput = findFileInput('.glb');
    expect(meshInput).toBeTruthy();
    await selectFile(meshInput!, meshFile);
    expect(
      document
        .querySelector('[role="progressbar"][aria-label="blockEditor.labels.meshUploadProgress"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('35');
    expect(meshInput?.value).toBe('');

    await clickElement(findButtonByAriaLabel('blockEditor.actions.cancelMeshUpload'));
    expect(abortMeshUpload).toHaveBeenCalledOnce();
    expect(
      document.querySelector('[role="progressbar"][aria-label="blockEditor.labels.meshUploadProgress"]'),
    ).toBeNull();
    await act(async () => {
      firstMeshUpload.reject(new Error('Upload aborted'));
      await Promise.resolve();
      await Promise.resolve();
    });

    meshInput = findFileInput('.glb');
    expect(meshInput).toBeTruthy();
    await selectFile(meshInput!, meshFile);
    await flushEffects();
    expect(uploadMeshFile).toHaveBeenCalledTimes(2);
    expect(uploadMeshFile.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        entityId: 'page-1',
        entityType: TranscodeEntityType.PAGE,
        slotId: 'page-block:section-1:immersive-scene:upload-unit:mesh',
      }),
    );
    expect(JSON.parse(readControlledProps().unitsJson ?? '[]')[0]).toMatchObject({
      meshSource: 'file',
      meshFileId: 'mesh-retry',
    });

    await selectUnitTab('blockEditor.sections.sceneTexture');
    const textureInput = findFileInput('image/png', 0);
    expect(textureInput).toBeTruthy();
    await selectFile(textureInput!, new File(['texture'], 'light.png', { type: 'image/png' }));
    expect(
      document
        .querySelector('[role="progressbar"][aria-label="blockEditor.labels.lightTextureUploadProgress"]')
        ?.getAttribute('aria-valuenow'),
    ).toBe('45');
    await clickElement(findButtonByAriaLabel('blockEditor.actions.cancelTextureUpload'));
    expect(abortTextureUpload).toHaveBeenCalledOnce();
    await act(async () => {
      textureUpload.reject(new Error('Upload aborted'));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(uploadTextureFile.mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        slotId: 'page-block:section-1:immersive-scene:upload-unit:texture',
      }),
    );
  });

  it('maps light and dark texture uploads to distinct slots and durable unit fields', async () => {
    const uploadTextureFile = vi
      .fn<ImmersiveSceneUploadControls['uploadTextureFile']>()
      .mockResolvedValueOnce({ fileId: 'light-texture-file', url: '/media/light-texture-file.png' })
      .mockResolvedValueOnce({ fileId: 'dark-texture-file', url: '/media/dark-texture-file.png' });

    render(
      <ControlledSettingsForm
        initialProps={{
          unitsJson: JSON.stringify([
            {
              id: 'themed-unit',
              name: 'Themed unit',
              mesh: 'sphere',
              color: '#ffffff',
              textureSource: 'image',
              darkTextureSource: 'image',
            },
          ]),
        }}
        uploadControls={createUploadControls({ uploadTextureFile })}
      />,
    );

    await openUnit('Themed unit');
    await selectUnitTab('blockEditor.sections.sceneTexture');
    await selectFile(findFileInput('image/png', 0)!, new File(['light-texture'], 'light.png', { type: 'image/png' }));
    await flushEffects();
    await selectFile(findFileInput('image/png', 1)!, new File(['dark-texture'], 'dark.png', { type: 'image/png' }));
    await flushEffects();

    expect(uploadTextureFile).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'light.png', type: 'image/png' }),
      expect.objectContaining({
        entityId: 'page-1',
        entityType: TranscodeEntityType.PAGE,
        slotId: 'page-block:section-1:immersive-scene:themed-unit:texture',
      }),
    );
    expect(uploadTextureFile).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'dark.png', type: 'image/png' }),
      expect.objectContaining({
        entityId: 'page-1',
        entityType: TranscodeEntityType.PAGE,
        slotId: 'page-block:section-1:immersive-scene:themed-unit:dark-texture',
      }),
    );

    const unit = JSON.parse(readControlledProps().unitsJson ?? '[]')[0] as Record<string, unknown>;
    expect(unit).toMatchObject({
      textureSource: 'image',
      textureFileId: 'light-texture-file',
      darkTextureSource: 'image',
      darkTextureFileId: 'dark-texture-file',
    });
    expect(unit).not.toHaveProperty('textureUrl');
    expect(unit).not.toHaveProperty('textureFileName');
    expect(unit).not.toHaveProperty('textureFileSize');
    expect(unit).not.toHaveProperty('darkTextureUrl');
    expect(unit).not.toHaveProperty('darkTextureFileName');
    expect(unit).not.toHaveProperty('darkTextureFileSize');
  });

  it('clears completed asset references and deletes each detached source file', async () => {
    const deleteUploadedFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <ControlledSettingsForm
        initialProps={{
          unitsJson: JSON.stringify([
            {
              id: 'asset-unit',
              name: 'Asset unit',
              mesh: 'sphere',
              meshSource: 'file',
              meshFileId: 'mesh-file',
              meshUrl: '/media/mesh-file.glb',
              meshFileName: 'mesh.glb',
              meshFileSize: '1024',
              color: '#ffffff',
              textureSource: 'image',
              textureFileId: 'texture-file',
              textureUrl: '/media/texture-file.png',
              darkTextureSource: 'image',
              darkTextureFileId: 'dark-texture-file',
              darkTextureUrl: '/media/dark-texture-file.png',
            },
          ]),
        }}
        uploadControls={createUploadControls({ deleteUploadedFile })}
      />,
    );

    await openUnit('Asset unit');
    await selectUnitTab('blockEditor.sections.sceneMesh');
    await clickElement(findButtonByAriaLabel('blockEditor.actions.clearMeshAsset'));
    await selectUnitTab('blockEditor.sections.sceneTexture');
    await clickElement(findButtonByAriaLabel('blockEditor.actions.clearTextureAsset'));
    await clickElement(findButtonByAriaLabel('blockEditor.actions.clearDarkTextureAsset'));
    await flushEffects();

    const unit = JSON.parse(readControlledProps().unitsJson ?? '[]')[0] as Record<string, unknown>;
    expect(unit).not.toHaveProperty('meshFileId');
    expect(unit).not.toHaveProperty('textureFileId');
    expect(unit).not.toHaveProperty('darkTextureFileId');
    expect(deleteUploadedFile.mock.calls.map(([fileId]) => fileId).sort()).toEqual([
      'dark-texture-file',
      'mesh-file',
      'texture-file',
    ]);
  });

  it('deletes completed asset files when their unit is removed', async () => {
    const deleteUploadedFile = vi.fn().mockResolvedValue({ success: true });
    render(
      <ControlledSettingsForm
        initialProps={{
          unitsJson: JSON.stringify([
            {
              id: 'removed-unit',
              name: 'Removed unit',
              mesh: 'sphere',
              meshSource: 'file',
              meshFileId: 'removed-mesh',
              color: '#ffffff',
              textureSource: 'image',
              textureFileId: 'removed-texture',
              darkTextureSource: 'image',
              darkTextureFileId: 'removed-dark-texture',
            },
            { id: 'retained-unit', name: 'Retained unit', mesh: 'box', color: '#111111' },
          ]),
        }}
        uploadControls={createUploadControls({ deleteUploadedFile })}
      />,
    );

    await clickElement(findButtonByAriaLabel('blockEditor.actions.removeSceneUnit'));
    await flushEffects();

    expect(JSON.parse(readControlledProps().unitsJson ?? '[]').map((unit: { id: string }) => unit.id)).toEqual([
      'retained-unit',
    ]);
    expect(deleteUploadedFile.mock.calls.map(([fileId]) => fileId).sort()).toEqual([
      'removed-dark-texture',
      'removed-mesh',
      'removed-texture',
    ]);
  });

  it('aborts unit uploads and deletes late results after the unit is removed', async () => {
    const meshUpload = createDeferred<{ fileId: string; url: string }>();
    const darkTextureUpload = createDeferred<{ fileId: string; url: string }>();
    const abortMeshUpload = vi.fn();
    const abortTextureUpload = vi.fn();
    const deleteUploadedFile = vi.fn().mockResolvedValue({ success: true });
    const uploadMeshFile = vi.fn<ImmersiveSceneUploadControls['uploadMeshFile']>((_file, options) => {
      options.onProgress?.({ percentage: 25 });
      return meshUpload.promise;
    });
    const uploadTextureFile = vi.fn<ImmersiveSceneUploadControls['uploadTextureFile']>((_file, options) => {
      options.onProgress?.({ percentage: 30 });
      return darkTextureUpload.promise;
    });

    render(
      <ControlledSettingsForm
        initialProps={{
          unitsJson: JSON.stringify([
            {
              id: 'pending-unit',
              name: 'Pending unit',
              mesh: 'sphere',
              meshSource: 'file',
              color: '#ffffff',
              textureSource: 'image',
              darkTextureSource: 'image',
            },
            { id: 'retained-unit', name: 'Retained unit', mesh: 'box', color: '#111111' },
          ]),
        }}
        uploadControls={createUploadControls({
          uploadMeshFile,
          uploadTextureFile,
          abortMeshUpload,
          abortTextureUpload,
          deleteUploadedFile,
        })}
      />,
    );

    await openUnit('Pending unit');
    await selectUnitTab('blockEditor.sections.sceneMesh');
    await selectFile(findFileInput('.glb')!, new File(['mesh'], 'triangle.glb', { type: 'model/gltf-binary' }));
    await selectUnitTab('blockEditor.sections.sceneTexture');
    await selectFile(findFileInput('image/png', 1)!, new File(['dark-texture'], 'dark.png', { type: 'image/png' }));

    await clickElement(findButtonByAriaLabel('blockEditor.actions.removeSceneUnit'));
    expect(abortMeshUpload).toHaveBeenCalledOnce();
    expect(abortTextureUpload).toHaveBeenCalledOnce();

    await act(async () => {
      meshUpload.resolve({ fileId: 'late-mesh', url: '/media/late-mesh.glb' });
      darkTextureUpload.resolve({ fileId: 'late-dark-texture', url: '/media/late-dark-texture.png' });
      await Promise.resolve();
      await Promise.resolve();
    });
    await flushEffects();

    expect(JSON.stringify(readControlledProps())).not.toContain('late-mesh');
    expect(JSON.stringify(readControlledProps())).not.toContain('late-dark-texture');
    expect(deleteUploadedFile.mock.calls.map(([fileId]) => fileId).sort()).toEqual(['late-dark-texture', 'late-mesh']);
  });

  it('serializes appearance, particle, rotation, scroll, and hover control changes', async () => {
    render(
      <ControlledSettingsForm
        initialProps={{
          playback: 'scroll',
          unitsJson: JSON.stringify([
            { id: 'first', mesh: 'sphere', color: '#ffffff' },
            { id: 'second', mesh: 'box', color: '#111111' },
          ]),
          backgroundEnabled: 'true',
          particleBrightness: '1.25',
          darkParticleBrightness: '1.45',
          rotationEnabled: 'true',
          rotationX: '0',
          rotationY: '0',
          rotationZ: '0',
          rotationSpeedX: '0',
          rotationSpeedY: '0.18',
          rotationSpeedZ: '0',
          scrollRotationEnabled: 'true',
          scrollRotationTurnsX: '0',
          scrollRotationTurnsY: '0.35',
          scrollRotationTurnsZ: '0',
          hoverEnabled: 'true',
          hoverRepelRadius: '0.45',
        }}
        uploadControls={createUploadControls()}
        panel="scene"
      />,
    );

    await clickElement(findInputByLabelText('blockEditor.labels.backgroundEnabled'));
    await clickElement(findButtonByText('blockEditor.sections.sceneParticles'));
    await pressSlider('blockEditor.labels.particleBrightness');
    await pressSlider('blockEditor.labels.darkParticleBrightness');
    await clickElement(findButtonByText('blockEditor.sections.sceneMotion'));
    await changeNumberInput('blockEditor.labels.initialRotation X', '15');
    await changeNumberInput('blockEditor.labels.rotationSpeedAxes Y', '0.2');
    await changeNumberInput('blockEditor.labels.scrollRotationAxes Z', '0.4');
    await pressSlider('blockEditor.labels.hoverRepelRadius');
    await clickElement(findInputByLabelText('blockEditor.labels.scrollRotationEnabled'));
    await clickElement(findInputByLabelText('blockEditor.labels.rotationEnabled'));
    await clickElement(findInputByLabelText('blockEditor.labels.hoverEnabled'));

    expect(readControlledProps()).toMatchObject({
      backgroundEnabled: 'false',
      particleBrightness: '1.3',
      darkParticleBrightness: '1.5',
      rotationEnabled: 'false',
      rotationX: '15',
      rotationSpeedY: '0.2',
      scrollRotationEnabled: 'false',
      scrollRotationTurnsZ: '0.4',
      hoverEnabled: 'false',
      hoverRepelRadius: '0.5',
    });
  });

  it('keeps blank item rotation axes inherited while preserving explicit zero overrides', async () => {
    render(
      <ControlledSettingsForm
        initialProps={{
          playback: 'scroll',
          rotationEnabled: 'true',
          rotationX: '10',
          rotationY: '-15',
          rotationZ: '5',
          rotationSpeedX: '0.08',
          rotationSpeedY: '0.18',
          rotationSpeedZ: '-0.06',
          scrollRotationEnabled: 'true',
          scrollRotationTurnsX: '0.15',
          scrollRotationTurnsY: '0.35',
          scrollRotationTurnsZ: '-0.2',
          unitsJson: JSON.stringify([
            {
              id: 'opening',
              name: 'Opening',
              mesh: 'sphere',
              color: '#ffffff',
              rotationX: '25',
              rotationSpeedY: '0',
              scrollRotationTurnsZ: '0.4',
            },
            {
              id: 'ending',
              name: 'Ending',
              mesh: 'box',
              color: '#111111',
            },
          ]),
        }}
        uploadControls={createUploadControls()}
        panel="unit"
      />,
    );

    await openUnit('Opening');
    await selectUnitTab('blockEditor.sections.sceneMotion');

    const rotationX = document.querySelector<HTMLInputElement>(
      'input[aria-label="blockEditor.labels.initialRotation X"]',
    );
    const rotationY = document.querySelector<HTMLInputElement>(
      'input[aria-label="blockEditor.labels.initialRotation Y"]',
    );
    const speedY = document.querySelector<HTMLInputElement>(
      'input[aria-label="blockEditor.labels.rotationSpeedAxes Y"]',
    );
    const scrollZ = document.querySelector<HTMLInputElement>(
      'input[aria-label="blockEditor.labels.scrollRotationAxes Z"]',
    );

    expect(rotationX?.value).toBe('25°');
    expect(rotationX?.placeholder).toBe('10');
    expect(rotationY?.value).toBe('');
    expect(rotationY?.placeholder).toBe('-15');
    expect(speedY?.value).toBe('0');
    expect(speedY?.placeholder).toBe('0.18');
    expect(scrollZ?.value).toBe('0.4');
    expect(scrollZ?.placeholder).toBe('-0.2');

    await changeNumberInput('blockEditor.labels.initialRotation X', '');
    await changeNumberInput('blockEditor.labels.initialRotation Y', '0');

    const [unit] = JSON.parse(readControlledProps().unitsJson ?? '[]') as Array<Record<string, string>>;
    expect(unit).not.toHaveProperty('rotationX');
    expect(unit).toMatchObject({
      rotationY: '0',
      rotationSpeedY: '0',
      scrollRotationTurnsZ: '0.4',
    });
  });

  it('preserves localized unit copy when selecting an optimized GLB candidate', async () => {
    const candidate = {
      id: 'candidate-1',
      sourceFileId: 'source-file',
      fileId: 'optimized-file',
      url: '/media/page/page-1/files/optimized-file.glb',
      fileName: 'optimized-file.glb',
      fileSize: 2048,
      originalFileSize: 4096,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 71,
      status: 'completed' as const,
      triangleCount: 4096,
      vertexCount: 2048,
      originalTriangleCount: 8192,
      originalVertexCount: 4096,
    };
    const meshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({ candidates: [candidate] }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn().mockResolvedValue({ candidate }),
      clearCandidates: vi.fn(),
    };
    const updateSharedProps = vi.fn();
    const updateLocalizedProps = vi.fn();

    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            {
              id: 'unit-1',
              mesh: 'sphere',
              color: '#ffffff',
              meshSource: 'file',
              meshFileId: 'source-file',
              meshUrl: '/media/page/page-1/files/source-file.glb',
              meshFileName: 'source-file.glb',
              meshFileSize: '4096',
            },
          ]),
          copyJson: JSON.stringify([
            {
              id: 'unit-1',
              title: 'Written title',
              text: 'Written text',
            },
          ]),
        }}
        updateSharedProps={updateSharedProps}
        updateLocalizedProps={updateLocalizedProps}
        uploadControls={createUploadControls({ meshOptimizationControls })}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Unit 1')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      findButtonByText('blockEditor.sections.sceneMesh')?.click();
      await Promise.resolve();
    });
    await flushEffects();
    await flushTimers();
    await flushEffects();

    const useButton = await waitForButtonByText('blockEditor.actions.useOptimizedMesh');
    expect(useButton).toBeTruthy();

    await act(async () => {
      useButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(meshOptimizationControls.useCandidate).toHaveBeenCalledWith({
      sourceFileId: 'source-file',
      entityId: 'page-1',
      entityType: TranscodeEntityType.PAGE,
      sectionId: 'section-1',
      unitId: 'unit-1',
      candidateId: 'candidate-1',
    });
    expect(updateSharedProps).toHaveBeenCalledWith({
      unitsJson: expect.any(String),
    });
    expect(JSON.parse(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson)).toEqual([
      expect.objectContaining({
        id: 'unit-1',
        meshOptimizationCandidateId: 'candidate-1',
        meshOptimizationSourceFileId: 'source-file',
        meshOptimizationFileId: 'optimized-file',
      }),
    ]);
    expect(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson).not.toContain('/media/');
    expect(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson).not.toContain('FileSize');
    expect(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson).not.toContain('TriangleCount');
    expect(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson).not.toContain('meshOptimizationMethod');
    expect(updateSharedProps.mock.calls.at(-1)?.[0].unitsJson).not.toContain('meshOptimizationTargetRatioPercent');
    expect(updateLocalizedProps).toHaveBeenCalledWith({
      copyJson: JSON.stringify([
        {
          id: 'unit-1',
          title: 'Written title',
          text: 'Written text',
        },
      ]),
    });
  });

  it('restores a selected optimized GLB from durable unit fields', async () => {
    const candidate = {
      id: 'candidate-1',
      sourceFileId: 'source-file',
      fileId: 'optimized-file',
      url: '/media/page/page-1/files/optimized-file.glb',
      fileName: 'optimized-file.glb',
      fileSize: 2048,
      originalFileSize: 4096,
      method: MESH_OPTIMIZATION_METHOD_DRACO,
      targetRatioPercent: 1,
      status: 'completed' as const,
      triangleCount: 150,
      vertexCount: 250,
      originalTriangleCount: 1000,
      originalVertexCount: 1000,
    };
    const meshOptimizationControls = {
      listCandidates: vi.fn().mockResolvedValue({ candidates: [candidate] }),
      generateCandidate: vi.fn(),
      useCandidate: vi.fn(),
      clearCandidates: vi.fn(),
    };

    render(
      <ImmersiveSceneSettingsForm
        sectionId="section-1"
        pageId="page-1"
        props={{
          unitsJson: JSON.stringify([
            {
              id: 'unit-1',
              mesh: 'sphere',
              color: '#ffffff',
              meshSource: 'file',
              meshFileId: 'source-file',
              meshUrl: '/media/page/page-1/files/source-file.glb',
              meshOptimizationCandidateId: 'candidate-1',
              meshOptimizationSourceFileId: 'source-file',
              meshOptimizationFileId: 'optimized-file',
              meshOptimizationMethod: MESH_OPTIMIZATION_METHOD_DRACO,
              meshOptimizationTargetRatioPercent: '1',
            },
          ]),
        }}
        updateSharedProps={vi.fn()}
        updateLocalizedProps={vi.fn()}
        uploadControls={createUploadControls({ meshOptimizationControls })}
      />,
    );
    await flushEffects();

    await act(async () => {
      findButtonByText('Unit 1')?.click();
      await Promise.resolve();
    });
    await act(async () => {
      findButtonByText('blockEditor.sections.sceneMesh')?.click();
      await Promise.resolve();
    });
    await flushEffects();
    await flushTimers();
    await flushEffects();

    expect(await waitForText('optimized-file.glb')).toBe(true);

    const selected = document.querySelector('[data-testid="immersive-scene-selected-mesh-optimization-unit-1"]');
    expect(selected?.textContent).toContain('blockEditor.labels.selectedOptimizedMesh');
    expect(selected?.textContent).toContain('1%');
    expect(selected?.textContent).toContain('optimized-file.glb');

    const slider = document.querySelector(
      '[data-testid="immersive-scene-mesh-optimization-target-ratio-unit-1"] [role="slider"]',
    );
    expect(slider?.getAttribute('aria-valuenow')).toBe('1');
    expect(findButtonByText('blockEditor.actions.useOptimizedMesh')).toBeUndefined();
  });
});
