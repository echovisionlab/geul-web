// @vitest-environment jsdom

import { MantineProvider } from '@mantine/core';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadIonianRuntime, loadThreeRuntime } from '@/lib/three/cdn-runtime';
import { ErrorCodeParticles } from './ErrorCodeParticles';

vi.mock('@/lib/three/cdn-runtime', () => ({
  loadThreeRuntime: vi.fn(),
  loadIonianRuntime: vi.fn(),
}));

let root: Root;
let host: HTMLDivElement;

beforeEach(() => {
  vi.stubGlobal('WebGL2RenderingContext', class {});
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  vi.mocked(loadThreeRuntime).mockRejectedValue(new Error('CDN unavailable'));
  vi.mocked(loadIonianRuntime).mockResolvedValue({} as Awaited<ReturnType<typeof loadIonianRuntime>>);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function mount(code = '500') {
  await act(async () => {
    root.render(
      <MantineProvider env="test">
        <ErrorCodeParticles code={code} />
      </MantineProvider>,
    );
  });
}

function expectReadable(code: string) {
  expect(host.querySelector('p')?.textContent).toBe(code);
  expect(host.querySelector('[data-error-code]')?.getAttribute('data-particles-ready')).toBe('false');
  expect(host.querySelector('p')?.style.opacity).toBe('1');
}

function mockGraphics(glyphPending: Promise<void> = Promise.resolve()) {
  const canvas = document.createElement('canvas');
  const rendererDispose = vi.fn();
  const setAnimationLoop = vi.fn();
  const renderFrame = vi.fn();
  const instanceGeometry = new THREE.BoxGeometry();
  const geometryDispose = vi.spyOn(instanceGeometry, 'dispose');
  const engineDispose = vi.fn();
  const pointerFacing = vi.fn();
  const pointerPosition = vi.fn();
  const setMeshSequence = vi.fn().mockReturnValue(glyphPending);
  const scheduleTransition = vi.fn();
  const setOverallProgress = vi.fn();
  const observerDisconnect = vi.fn();
  const particles = new THREE.Mesh(instanceGeometry, new THREE.ShaderMaterial());
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        fillText: vi.fn(),
        getImageData: () => {
          const data = new Uint8ClampedArray(480 * 200 * 4);
          data[3] = 255;
          return { data };
        },
      }) as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect = observerDisconnect;
    },
  );
  class Renderer {
    domElement = canvas;
    debug = { checkShaderErrors: false };
    dispose = rendererDispose;
    setAnimationLoop = setAnimationLoop;
    setPixelRatio() {}
    setSize() {}
    async compileAsync() {}
    render() {}
  }
  class Engine {
    getObject() {
      return particles;
    }
    registerMesh() {}
    setGeometrySize() {}
    setVelocityTractionForce() {}
    setPositionalTractionForce() {}
    setTextureSequence() {}
    setPointerFacing = pointerFacing;
    setPointerFacingPosition = pointerPosition;
    renderFrame = renderFrame;
    dispose = engineDispose;
    setMeshSequence = setMeshSequence;
    scheduleMeshSequenceTransition = scheduleTransition;
    setOverallProgress = setOverallProgress;
  }
  vi.mocked(loadThreeRuntime).mockResolvedValue({ ...THREE, WebGLRenderer: Renderer } as unknown as typeof THREE);
  vi.mocked(loadIonianRuntime).mockResolvedValue({ ParticlesEngine: Engine } as unknown as Awaited<
    ReturnType<typeof loadIonianRuntime>
  >);
  return {
    canvas,
    rendererDispose,
    setAnimationLoop,
    renderFrame,
    geometryDispose,
    engineDispose,
    observerDisconnect,
    pointerFacing,
    pointerPosition,
    setMeshSequence,
    scheduleTransition,
    setOverallProgress,
    particles,
  };
}

describe('error number recovery', () => {
  it.each(['400', '404', '500'])('retains %s when the graphics runtime cannot load', async (code) => {
    await mount(code);
    expectReadable(code);
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('retains the number when the Ionian chunk cannot load', async () => {
    vi.mocked(loadThreeRuntime).mockResolvedValue(THREE);
    vi.mocked(loadIonianRuntime).mockRejectedValue(new Error('Ionian unavailable'));
    await mount();
    expectReadable('500');
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('reveals a cloud and runs one Ionian transition into the error number', async () => {
    const { setMeshSequence, scheduleTransition, setAnimationLoop } = mockGraphics();
    await mount();
    expect(setMeshSequence).toHaveBeenCalledWith(['error-scatter', '500']);
    expect(host.querySelector('p')?.style.opacity).toBe('0');
    expect(scheduleTransition).toHaveBeenCalledExactlyOnceWith(1, 1100, expect.any(Function));
    const draw = setAnimationLoop.mock.lastCall![0] as (time: number) => void;
    for (let time = 1000; time <= 1300; time += 50) {
      draw(time);
    }
    expect(scheduleTransition).toHaveBeenCalledTimes(1);
  });

  it('follows the pointer outside the number and clears input when the page loses it', async () => {
    const { pointerPosition } = mockGraphics();
    await mount();
    const number = host.querySelector<HTMLElement>('[data-error-code]')!;
    vi.spyOn(number, 'getBoundingClientRect').mockReturnValue({
      left: 200,
      top: 100,
      width: 480,
      height: 200,
    } as DOMRect);
    expect(number.getAttribute('data-particles-ready')).toBe('true');
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 760, clientY: 220 }));
    expect(pointerPosition).toHaveBeenLastCalledWith({ x: 1, y: expect.closeTo(-0.2) });
    window.dispatchEvent(new Event('blur'));
    expect(pointerPosition).toHaveBeenLastCalledWith(null);
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100, clientY: 0 }));
    expect(pointerPosition).toHaveBeenLastCalledWith({ x: -1, y: 1 });
    window.dispatchEvent(new MouseEvent('pointerout', { relatedTarget: document.body }));
    expect(pointerPosition).toHaveBeenLastCalledWith({ x: -1, y: 1 });
    window.dispatchEvent(new MouseEvent('pointerout', { relatedTarget: null }));
    expect(pointerPosition).toHaveBeenLastCalledWith(null);
    await act(async () => root.unmount());
    pointerPosition.mockClear();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 760, clientY: 220 }));
    expect(pointerPosition).not.toHaveBeenCalled();
  });

  it('stops drift, following, and continuous rendering when reduced motion changes', async () => {
    const mediaEvents = new EventTarget();
    const motion = Object.assign(mediaEvents, { matches: false });
    const matchMedia = window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation((query) =>
      query === '(prefers-reduced-motion: reduce)' ? (motion as unknown as MediaQueryList) : matchMedia(query),
    );
    const { particles, pointerFacing, pointerPosition, setAnimationLoop, setOverallProgress, scheduleTransition } =
      mockGraphics();
    await mount();
    expect(particles.material.uniforms.uErrorDrift.value).toBe(1);
    motion.matches = true;
    mediaEvents.dispatchEvent(new Event('change'));
    expect(particles.material.uniforms.uErrorDrift.value).toBe(0);
    expect(pointerFacing).toHaveBeenLastCalledWith({ enabled: false });
    expect(pointerPosition).toHaveBeenLastCalledWith(null);
    expect(setAnimationLoop).toHaveBeenLastCalledWith(null);
    expect(setOverallProgress).toHaveBeenLastCalledWith(1);
    pointerPosition.mockClear();
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 760, clientY: 220 }));
    expect(pointerPosition).not.toHaveBeenCalled();
    motion.matches = false;
    mediaEvents.dispatchEvent(new Event('change'));
    expect(particles.material.uniforms.uErrorDrift.value).toBe(1);
    expect(setAnimationLoop).toHaveBeenLastCalledWith(expect.any(Function));
    const draw = setAnimationLoop.mock.lastCall![0] as (time: number) => void;
    for (let time = 1000; time <= 1300; time += 50) {
      draw(time);
    }
    expect(scheduleTransition).toHaveBeenCalledTimes(1);
  });

  it('releases the renderer when unmounted while the glyph is still preparing', async () => {
    let completeGlyph!: () => void;
    const glyphPending = new Promise<void>((resolve) => {
      completeGlyph = resolve;
    });
    const {
      canvas,
      rendererDispose,
      setAnimationLoop,
      renderFrame,
      geometryDispose,
      engineDispose,
      observerDisconnect,
    } = mockGraphics(glyphPending);
    await mount();
    expect(host.querySelector('canvas')).toBe(canvas);
    // Do not flash a completed text number before the entrance is ready.
    expect(host.querySelector('p')?.textContent).toBe('500');
    expect(host.querySelector('p')?.style.opacity).toBe('0');
    await act(async () => root.unmount());
    await act(async () => completeGlyph());
    expect(engineDispose).toHaveBeenCalledTimes(1);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(rendererDispose).toHaveBeenCalledTimes(1);
    expect(observerDisconnect).toHaveBeenCalledTimes(1);
    expect(renderFrame).not.toHaveBeenCalled();
    expect(setAnimationLoop).toHaveBeenCalledExactlyOnceWith(null);
    expect(canvas.isConnected).toBe(false);
  });
});
