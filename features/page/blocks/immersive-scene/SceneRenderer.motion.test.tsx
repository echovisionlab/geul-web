// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import enMessages from '@/messages/en.json';
import koMessages from '@/messages/ko.json';
import { ImmersiveSceneRenderer } from './SceneRenderer';
import { parseImmersiveSceneConfig } from './schema';

const runtime = vi.hoisted(() => ({
  render: vi.fn(),
  pointer: vi.fn(),
  intersection: vi.fn(),
  repelDistance: vi.fn(),
  engineOptions: vi.fn(),
  rendererOptions: vi.fn(),
  clearColor: vi.fn(),
  engines: [] as { object: import('three').Points<import('three').BufferGeometry, import('three').ShaderMaterial> }[],
}));

// Exercise the actual playback/effect owner while replacing only GPU/CDN I/O.
vi.mock('@/lib/three/cdn-runtime', async () => {
  const three = await vi.importActual<typeof import('three')>('three');
  class Renderer {
    debug = { checkShaderErrors: false };
    constructor(options: unknown) {
      runtime.rendererOptions(options);
    }
    setClearColor(color: unknown, alpha: number) {
      runtime.clearColor(color, alpha);
    }
    setPixelRatio() {}
    setSize() {}
    render() {}
    dispose() {}
  }
  class Engine {
    object = new three.Points(
      new three.BufferGeometry(),
      new three.ShaderMaterial({
        uniforms: {},
        fragmentShader: 'uniform float uProgress;\nvoid main() { gl_FragColor = finalColor; }',
      }),
    );
    constructor(options: unknown) {
      runtime.engineOptions(options);
      runtime.engines.push(this);
    }
    setVelocityTractionForce() {}
    setPositionalTractionForce() {}
    setMaxRepelDistance(distance: number) {
      runtime.repelDistance(distance);
    }
    setGeometrySize() {}
    registerMesh() {}
    async setMeshSequence() {}
    setTextureSequence() {}
    setOverallProgress() {}
    getObject() {
      return this.object;
    }
    useIntersect(enabled: boolean) {
      runtime.intersection(enabled);
    }
    setPointerPosition(position: unknown) {
      runtime.pointer(position);
    }
    renderFrame(delta: number, elapsed: number) {
      runtime.render(delta, elapsed);
    }
    dispose() {}
  }
  return {
    loadThreeRuntime: async () => ({ ...three, WebGLRenderer: Renderer }),
    loadIonianRuntime: async () => ({ ParticlesEngine: Engine }),
  };
});

const config = parseImmersiveSceneConfig({
  playback: 'autoplay',
  loop: 'true',
  transition: 'linear',
  unitHoldSeconds: '0.2',
  unitGapSeconds: '1',
  unitsJson: JSON.stringify([
    { id: 'one', mesh: 'sphere', color: '#ffffff', attribution: 'Credit [One](https://example.com/one)' },
    { id: 'two', mesh: 'box', color: '#777777', attribution: 'Credit [Two](https://example.com/two)' },
  ]),
  copyJson: JSON.stringify([
    { id: 'one', title: 'Opening', text: 'Opening information' },
    { id: 'two', title: 'Ending', text: 'Ending information' },
  ]),
});

let container: HTMLDivElement;
let root: Root;
let frames: Map<number, FrameRequestCallback>;
let reduceMotion: boolean;

beforeEach(() => {
  reduceMotion = false;
  frames = new Map();
  runtime.render.mockClear();
  runtime.pointer.mockClear();
  runtime.intersection.mockClear();
  runtime.repelDistance.mockClear();
  runtime.engineOptions.mockClear();
  runtime.rendererOptions.mockClear();
  runtime.clearColor.mockClear();
  runtime.engines.length = 0;
  let frameId = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)' && reduceMotion,
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
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderScene(sceneConfig = config) {
  await act(async () =>
    root.render(
      <TestProviders>
        <ImmersiveSceneRenderer config={sceneConfig} />
      </TestProviders>,
    ),
  );
  expect(container.querySelector('[data-renderer-status="ready"]')).not.toBeNull();
}
function frame(timestamp: number) {
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const callback of pending) {
      callback(timestamp);
    }
  });
}
function click(label: string) {
  const button = [...container.querySelectorAll('button')].find((element) => element.textContent === label);
  expect(button).toBeDefined();
  act(() => button!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

const radians = (degrees: number) => degrees * (Math.PI / 180);

describe('Authored immersive scene controls', () => {
  const singleUnit = {
    unitsJson: '[{"id":"single","mesh":"sphere","color":"#ffffff"}]',
    particleBrightness: '1.6',
    darkParticleBrightness: '1.9',
    rotationX: '10',
    rotationY: '20',
    rotationZ: '30',
    rotationSpeedX: '0.2',
    rotationSpeedY: '0.42',
    rotationSpeedZ: '-0.1',
    hoverRepelRadius: '0.7',
  };

  it.each([
    ['light', 1.6],
    ['dark', 1.9],
  ] as const)('lights particles with the authored %s-scheme brightness', async (preferredScheme, brightness) => {
    await renderScene(parseImmersiveSceneConfig({ ...singleUnit, preferredScheme }));

    expect(runtime.engines[0].object.material.uniforms.uParticleBrightness.value).toBe(brightness);
  });

  it('keeps the background, rotation and hover effects running when they are enabled', async () => {
    await renderScene(parseImmersiveSceneConfig(singleUnit));
    for (let time = 0; time <= 500; time += 100) {
      frame(time);
    }

    expect(runtime.rendererOptions).toHaveBeenCalledWith(expect.objectContaining({ alpha: false }));
    expect(runtime.clearColor).toHaveBeenLastCalledWith(expect.anything(), 1);
    expect(runtime.engines[0].object.rotation.y).toBeGreaterThan(radians(20));
    expect(runtime.engineOptions).toHaveBeenCalledWith(expect.objectContaining({ useIntersection: true }));
    expect(runtime.repelDistance).toHaveBeenLastCalledWith(0.7);
  });

  it('drops the background, holds the authored pose and ignores the pointer when the controls are off', async () => {
    await renderScene(
      parseImmersiveSceneConfig({
        ...singleUnit,
        backgroundEnabled: 'false',
        rotationEnabled: 'false',
        hoverEnabled: 'false',
      }),
    );
    for (let time = 0; time <= 500; time += 100) {
      frame(time);
    }

    expect(runtime.rendererOptions).toHaveBeenCalledWith(expect.objectContaining({ alpha: true }));
    expect(runtime.clearColor).toHaveBeenLastCalledWith(expect.anything(), 0);
    const { rotation } = runtime.engines[0].object;
    expect(rotation.x).toBeCloseTo(radians(10));
    expect(rotation.y).toBeCloseTo(radians(20));
    expect(rotation.z).toBeCloseTo(radians(30));
    expect(runtime.engineOptions).toHaveBeenCalledWith(expect.objectContaining({ useIntersection: false }));
    expect(runtime.repelDistance).toHaveBeenLastCalledWith(0);
  });
});

describe('Public immersive motion and information', () => {
  it('freezes playback, canvas frames and pointer effects, then resumes at the same progress', async () => {
    await renderScene();
    for (let time = 0; time <= 700; time += 100) {
      frame(time);
    }
    const scene = container.querySelector('[data-immersive-scene]')!;
    const progress = scene.getAttribute('data-progress');
    expect(Number(progress)).toBeGreaterThan(0);
    click('Pause animation');
    expect(scene.getAttribute('data-motion-paused')).toBe('true');
    expect(runtime.intersection).toHaveBeenLastCalledWith(false);
    const renders = runtime.render.mock.calls.length;
    const pointers = runtime.pointer.mock.calls.length;
    frame(60_000);
    act(() => container.querySelector('canvas')!.dispatchEvent(new MouseEvent('pointermove', { bubbles: true })));
    expect(scene.getAttribute('data-progress')).toBe(progress);
    expect(runtime.render).toHaveBeenCalledTimes(renders);
    expect(runtime.pointer).toHaveBeenCalledTimes(pointers);
    click('Resume animation');
    frame(60_100);
    expect(scene.getAttribute('data-progress')).toBe(progress);
    frame(60_200);
    expect(Number(scene.getAttribute('data-progress'))).toBeGreaterThan(Number(progress));
    expect(runtime.render.mock.calls.length).toBeGreaterThan(renders);
  });

  it('opens all authored descriptions and attribution links and persistently pauses the scene', async () => {
    await renderScene();
    click('Read all scene information');
    expect(container.querySelector('[data-motion-paused="true"]')).not.toBeNull();
    const information = [...container.querySelectorAll('[data-immersive-scene-information-unit]')];
    expect(information.map((unit) => unit.textContent)).toEqual([
      'OpeningOpening informationCredit One',
      'EndingEnding informationCredit Two',
    ]);
    expect(information.map((unit) => unit.querySelector('a')!.getAttribute('href'))).toEqual([
      'https://example.com/one',
      'https://example.com/two',
    ]);
    expect(information.every((unit) => !unit.closest('[inert]'))).toBe(true);
    expect(container.querySelector('[data-immersive-scene-unit="one"]')!.getAttribute('aria-hidden')).toBe('true');
    click('Read all scene information');
    expect(container.querySelector('[data-motion-paused="true"]')).not.toBeNull();
  });

  it('defaults to a readable complete information path with no automatic frames in reduced motion', async () => {
    reduceMotion = true;
    await renderScene();
    expect(container.querySelector('[data-motion-paused="true"]')).not.toBeNull();
    expect(container.querySelector('button')!.getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[data-immersive-scene-information-unit] a')).toHaveLength(2);
    const renders = runtime.render.mock.calls.length;
    frame(20_000);
    expect(runtime.render).toHaveBeenCalledTimes(renders);
    expect(container.textContent).toContain('Ending information');
    expect(container.querySelector('[data-height-mode="intrinsic"]')).not.toBeNull();
  });

  it('uses locale messages for controls while preserving authored scene content', async () => {
    await act(async () =>
      root.render(
        <TestProviders
          locale="ko"
          messages={{ ...enMessages, common: { ...enMessages.common, motion: koMessages.common.motion } }}
        >
          <ImmersiveSceneRenderer config={config} />
        </TestProviders>,
      ),
    );
    expect(container.textContent).toContain('애니메이션 일시 정지');
    click('장면의 모든 정보 읽기');
    expect(container.textContent).toContain('애니메이션 재개');
    expect(container.textContent).toContain('Ending information');
  });

  it('keeps complete information in the existing keyboard scroll region for constrained editor previews', async () => {
    await act(async () =>
      root.render(
        <TestProviders>
          <ImmersiveSceneRenderer config={config} preview progress={0.5} />
        </TestProviders>,
      ),
    );
    const region = container.querySelector('[role="region"]')!;
    expect(region.getAttribute('aria-label')).toBe('Read all scene information');
    expect(region.getAttribute('tabindex')).toBe('0');
    click('Read all scene information');
    expect(region.querySelector('[data-immersive-scene-information-unit="two"]')!.textContent).toContain(
      'Ending information',
    );
  });
});
