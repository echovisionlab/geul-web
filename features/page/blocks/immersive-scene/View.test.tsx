import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { getThemeDefinition, themeIds } from '@/lib/theme/themes';
import { themeVariables } from '@/theme';
import {
  resolveAutoplayClockState,
  resolveAutoplayTimelineState,
  resolveLoadedMeshScale,
  applyParticleObjectTransform,
  resolveMeshOffsetYAtProgress,
  resolveMeshOffsetYSignature,
  resolveParticleGeometryScale,
  resolveParticleSizeAtProgress,
  resolveRenderUnitSequence,
  resolveRendererUnitSignature,
  resolveSceneTextColors,
  resolveThemedUnitTexture,
  resolveUnitMeshScale,
  resolveUnitPresentation,
} from './scene-renderer-model';
import { resolveScrollProgress, resolveUnitMeshAsset } from './SceneRenderer';
import { parseImmersiveSceneConfig, type ImmersiveSceneUnit } from './schema';
import { ImmersiveSceneView } from './ViewRuntime';

const testUnits: ImmersiveSceneUnit[] = [
  {
    id: 'first',
    mesh: 'sphere',
    color: '#ffffff',
    title: 'First',
    text: 'First copy',
  },
  {
    id: 'second',
    mesh: 'box',
    color: '#f97316',
    title: 'Second',
    text: 'Second copy',
  },
  {
    id: 'third',
    mesh: 'cone',
    color: '#60a5fa',
    title: 'Third',
    text: 'Third copy',
  },
];

function colorChannels(color: string): [number, number, number, number] {
  if (/^#[\da-f]{6}$/i.test(color)) {
    return [1, 3, 5].map((offset) => parseInt(color.slice(offset, offset + 2), 16)).concat(1) as [
      number,
      number,
      number,
      number,
    ];
  }
  const channels = color.match(/[\d.]+/g)?.map(Number);
  if (!color.startsWith('rgb(') || !channels || channels.length < 3) {
    throw new Error(`Unsupported contrast-test color: ${color}`);
  }
  return [channels[0], channels[1], channels[2], channels[3] === undefined ? 1 : channels[3] / 100];
}

function textContrast(text: string, background: string) {
  const [red, green, blue, alpha] = colorChannels(text);
  const backgroundChannels = colorChannels(background).slice(0, 3);
  const foregroundChannels = [red, green, blue].map(
    (channel, index) => channel * alpha + backgroundChannels[index] * (1 - alpha),
  );
  const luminance = (channels: number[]) =>
    channels.reduce((value, channel, index) => {
      const srgb = channel / 255;
      return (
        value + (srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
      );
    }, 0);
  const values = [luminance(foregroundChannels), luminance(backgroundChannels)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('ImmersiveSceneView', () => {
  it.each(themeIds)('keeps default scene title and body readable in %s without authored color overrides', (themeId) => {
    const config = parseImmersiveSceneConfig({});
    const { base } = getThemeDefinition(themeId);
    const variables = themeVariables(themeId);
    const background = base === 'dark' ? config.darkBackgroundColor : config.backgroundColor;
    const text = resolveSceneTextColors(base, config);
    for (const color of [text.root, text.title, text.body]) {
      const variable = /^var\((--[\w-]+)\)$/.exec(color)?.[1];
      const resolved = variable ? variables[variable] : color;
      expect(textContrast(resolved, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('renders sparse shared unit attribution with safe links and inert inactive content', () => {
    const html = renderToStaticMarkup(
      <TestProviders>
        <ImmersiveSceneView
          props={{
            playback: 'scroll',
            transition: 'linear',
            unitsJson: JSON.stringify([
              {
                id: 'credited-opening',
                mesh: 'sphere',
                color: '#d8dde5',
                attribution: 'Created by [Artist A](https://example.com/artists/a)',
              },
              { id: 'uncredited-middle', mesh: 'box', color: '#777777' },
              {
                id: 'credited-ending',
                mesh: 'cone',
                color: '#f97316',
                attribution: 'Created by [Artist C](https://example.com/artists/c)',
              },
            ]),
            copyJson: JSON.stringify([
              { id: 'credited-opening', title: 'Opening', text: '' },
              { id: 'uncredited-middle', title: 'Middle', text: '' },
              { id: 'credited-ending', title: 'Ending', text: '' },
            ]),
          }}
        />
      </TestProviders>,
    );

    expect(html.match(/data-immersive-scene-unit-attribution=/g)).toHaveLength(2);
    expect(html).toContain('data-immersive-scene-unit-attribution="credited-opening"');
    expect(html).not.toContain('data-immersive-scene-unit-attribution="uncredited-middle"');
    expect(html).toContain('data-immersive-scene-unit-attribution="credited-ending"');
    expect(html).toContain('data-variant="attribution"');
    expect(html).toContain('href="https://example.com/artists/a"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noreferrer"');
    expect(html).toContain('inert=""');
  });

  it('measures scroll progress relative to the content scroll root', () => {
    const element = {
      getBoundingClientRect: () => ({ top: -500, height: 2000 }),
    } as unknown as HTMLElement;
    const scrollRoot = {
      clientHeight: 800,
      getBoundingClientRect: () => ({ top: 100 }),
    } as unknown as HTMLElement;

    expect(resolveScrollProgress(element, scrollRoot)).toBe(0.5);
  });

  it('closes the internal particle sequence only for looped scenes', () => {
    expect(resolveRenderUnitSequence(testUnits, false).map((unit) => unit.id)).toEqual(['first', 'second', 'third']);
    expect(resolveRenderUnitSequence(testUnits, true).map((unit) => unit.id)).toEqual([
      'first',
      'second',
      'third',
      'first',
    ]);
  });

  it('uses only the selected optimized mesh delivery', () => {
    expect(
      resolveUnitMeshAsset({
        ...testUnits[0],
        meshSource: 'file',
        meshFileId: 'source-file',
        meshUrl: 'https://cdn.example/source.glb',
        meshOptimizationFileId: 'optimized-file',
        meshOptimizationUrl: 'https://cdn.example/optimized.glb',
      }),
    ).toEqual({
      fileId: 'optimized-file',
      url: 'https://cdn.example/optimized.glb',
    });
  });

  it('uses the primitive fallback when selected optimized delivery is missing', () => {
    expect(
      resolveUnitMeshAsset({
        ...testUnits[0],
        meshSource: 'file',
        meshFileId: 'source-file',
        meshUrl: 'https://cdn.example/source.glb',
        meshOptimizationFileId: 'optimized-file',
      }),
    ).toBeNull();
  });

  it('holds each unit before using the configured gap in non-loop autoplay', () => {
    const baseTimeline = {
      unitCount: 3,
      unitHoldSeconds: 2,
      unitGapSeconds: 1,
      loop: false,
      transition: 'linear' as const,
    };

    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 1.5 })).toMatchObject({
      textSegmentProgress: 0,
      visualProgress: 0,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 2.5 })).toMatchObject({
      textSegmentProgress: 0.5,
      visualProgress: 0.25,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 3.5 })).toMatchObject({
      textSegmentProgress: 1,
      visualProgress: 0.5,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 8.1 })).toMatchObject({
      textSegmentProgress: 2,
      visualProgress: 1,
      shouldContinue: false,
    });
  });

  it('keeps autoplay text progress linear while easing only the visual scene progress', () => {
    const timeline = resolveAutoplayTimelineState({
      elapsedSeconds: 2.25,
      unitCount: 3,
      unitHoldSeconds: 2,
      unitGapSeconds: 1,
      loop: false,
      transition: 'smooth',
    });

    expect(timeline.textSegmentProgress).toBeCloseTo(0.25);
    expect(timeline.visualProgress).toBeCloseTo(0.15625 / 2);
  });

  it('freezes autoplay elapsed time across hidden-tab frame gaps', () => {
    const firstFrame = resolveAutoplayClockState({ elapsedSeconds: 0, lastFrameTimestamp: null }, 1000, false);
    const visibleFrame = resolveAutoplayClockState(firstFrame, 1100, false);
    const hiddenFrame = resolveAutoplayClockState(visibleFrame, 12_000, true);
    const resumedFrame = resolveAutoplayClockState(hiddenFrame, 20_000, false);
    const nextVisibleFrame = resolveAutoplayClockState(resumedFrame, 20_100, false);

    expect(visibleFrame.elapsedSeconds).toBeCloseTo(0.1);
    expect(hiddenFrame.elapsedSeconds).toBeCloseTo(0.1);
    expect(hiddenFrame.lastFrameTimestamp).toBeNull();
    expect(resumedFrame.elapsedSeconds).toBeCloseTo(0.1);
    expect(nextVisibleFrame.elapsedSeconds).toBeCloseTo(0.2);
  });

  it('caps unusually long autoplay frame gaps when visibility events are missed', () => {
    const firstFrame = resolveAutoplayClockState({ elapsedSeconds: 0, lastFrameTimestamp: null }, 1000, false);
    const resumedFrame = resolveAutoplayClockState(firstFrame, 20_000, false);

    expect(resumedFrame.elapsedSeconds).toBeCloseTo(0.25);
  });

  it('loops by holding the final unit before crossing its gap back to the first unit', () => {
    const baseTimeline = {
      unitCount: 3,
      unitHoldSeconds: 2,
      unitGapSeconds: 1,
      loop: true,
      transition: 'linear' as const,
    };

    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 7.5 })).toMatchObject({
      textSegmentProgress: 2,
      visualProgress: 2 / 3,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 8.5 })).toMatchObject({
      textSegmentProgress: 2.5,
      visualProgress: 2.5 / 3,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 9.1 })).toMatchObject({
      textSegmentProgress: 0,
      visualProgress: 0,
      shouldContinue: true,
    });
  });

  it('allows autoplay units to advance immediately when the configured gap is zero', () => {
    expect(
      resolveAutoplayTimelineState({
        elapsedSeconds: 2.1,
        unitCount: 3,
        unitHoldSeconds: 2,
        unitGapSeconds: 0,
        loop: false,
        transition: 'linear',
      }),
    ).toMatchObject({
      textSegmentProgress: 1,
      visualProgress: 0.5,
      shouldContinue: true,
    });
  });

  it('uses a per-unit hold override before falling back to the scene hold time', () => {
    const baseTimeline = {
      unitCount: 3,
      unitHoldSeconds: 2,
      unitHoldSecondsByIndex: [4, undefined, undefined],
      unitGapSeconds: 1,
      loop: false,
      transition: 'linear' as const,
    };

    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 3.5 })).toMatchObject({
      textSegmentProgress: 0,
      visualProgress: 0,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 4.5 })).toMatchObject({
      textSegmentProgress: 0.5,
      visualProgress: 0.25,
      shouldContinue: true,
    });
    expect(resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 5.5 })).toMatchObject({
      textSegmentProgress: 1,
      visualProgress: 0.5,
      shouldContinue: true,
    });
  });

  it('settles looped text to full opacity before the final boundary', () => {
    expect(resolveUnitPresentation(2.65, 2, 3, 0.2, true).opacity).toBe(0);
    expect(resolveUnitPresentation(2.65, 0, 3, 0.2, true).opacity).toBe(0);
    expect(resolveUnitPresentation(2.8, 2, 3, 0.2, true).opacity).toBe(0);
    expect(resolveUnitPresentation(2.8, 0, 3, 0.2, true).opacity).toBeCloseTo(0.5);
    expect(resolveUnitPresentation(2.9, 0, 3, 0.2, true).opacity).toBe(1);
    expect(resolveUnitPresentation(2.99, 0, 3, 0.2, true).opacity).toBe(1);
    expect(resolveUnitPresentation(3, 0, 3, 0.2, true).opacity).toBe(1);
    expect(resolveUnitPresentation(3, 2, 3, 0.2, true).opacity).toBe(0);
  });

  it('fades incoming text from the real autoplay gap time instead of the eased visual progress', () => {
    const baseTimeline = {
      unitCount: 3,
      unitHoldSeconds: 5,
      unitGapSeconds: 1.5,
      loop: true,
      transition: 'smooth' as const,
    };

    const fadeStart = resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 6 });
    const fadeMiddle = resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 6.17 });
    const fadeEnd = resolveAutoplayTimelineState({ ...baseTimeline, elapsedSeconds: 6.34 });

    expect(resolveUnitPresentation(fadeStart.textSegmentProgress, 1, 3, 0.22, true).opacity).toBe(0);
    expect(resolveUnitPresentation(fadeMiddle.textSegmentProgress, 1, 3, 0.22, true).opacity).toBeGreaterThan(0);
    expect(resolveUnitPresentation(fadeMiddle.textSegmentProgress, 1, 3, 0.22, true).opacity).toBeLessThan(1);
    expect(resolveUnitPresentation(fadeEnd.textSegmentProgress, 1, 3, 0.22, true).opacity).toBe(1);
  });

  it('resolves overlay text colors from the scene color scheme', () => {
    const themeTextConfig = {
      textColorSource: 'theme',
      lightTextColor: '#111827',
      darkTextColorSource: 'inherit',
      darkTextColor: '#f8fafc',
    } as const;

    expect(resolveSceneTextColors('light', themeTextConfig)).toEqual({
      root: 'var(--geul-paper-ink)',
      title: 'var(--geul-paper-ink)',
      body: 'var(--geul-paper-secondary)',
    });
    expect(resolveSceneTextColors('dark', themeTextConfig)).toEqual({
      root: 'var(--geul-text-inverse-primary)',
      title: 'var(--geul-text-inverse-primary)',
      body: 'var(--geul-text-inverse-secondary)',
    });
    expect(
      resolveSceneTextColors('dark', {
        textColorSource: 'custom',
        lightTextColor: '#101010',
        darkTextColorSource: 'inherit',
        darkTextColor: '#f8fafc',
      }),
    ).toEqual({
      root: '#101010',
      title: '#101010',
      body: '#101010',
    });
    expect(
      resolveSceneTextColors('dark', {
        textColorSource: 'custom',
        lightTextColor: '#101010',
        darkTextColorSource: 'custom',
        darkTextColor: '#fefefe',
      }),
    ).toEqual({
      root: '#fefefe',
      title: '#fefefe',
      body: '#fefefe',
    });
  });

  it('uses dark particle texture overrides when the scene resolves to dark mode', () => {
    const unit: ImmersiveSceneUnit = {
      id: 'themed',
      mesh: 'sphere',
      color: '#ffffff',
      textureSource: 'image',
      textureFileId: 'light-texture',
      textureUrl: '/media/page/page-1/files/light.webp',
      darkColor: '#111827',
      darkTextureSource: 'image',
      darkTextureFileId: 'dark-texture',
      darkTextureUrl: '/media/page/page-1/files/dark.webp',
      title: 'Themed',
      text: 'Texture',
    };

    expect(resolveThemedUnitTexture(unit, 'light')).toMatchObject({
      source: 'image',
      color: '#ffffff',
      fileId: 'light-texture',
      url: '/media/page/page-1/files/light.webp',
    });
    expect(resolveThemedUnitTexture(unit, 'dark')).toMatchObject({
      source: 'image',
      color: '#111827',
      fileId: 'dark-texture',
      url: '/media/page/page-1/files/dark.webp',
    });
  });

  it('resolves visible particle point scale and per-unit mesh scale separately', () => {
    expect(resolveParticleGeometryScale(1)).toBe(1);
    expect(resolveParticleGeometryScale(0.2)).toBeCloseTo(0.2);
    expect(resolveUnitMeshScale({ scale: '1.8' })).toBe(1.8);
    expect(resolveUnitMeshScale({ scale: 'not-a-number' })).toBe(1);
    expect(resolveUnitMeshScale({ scale: '20' })).toBe(8);
  });

  it('inherits or interpolates each unit particle size independently from particle count', () => {
    const units: ImmersiveSceneUnit[] = [
      { ...testUnits[0], particleSize: '0.4' },
      { ...testUnits[1], particleSize: '2' },
      { ...testUnits[2] },
    ];

    expect(resolveParticleSizeAtProgress(units, 0, false, 1)).toBe(0.4);
    expect(resolveParticleSizeAtProgress(units, 0.25, false, 1)).toBeCloseTo(1.2);
    expect(resolveParticleSizeAtProgress(units, 0.5, false, 1)).toBe(2);
    expect(resolveParticleSizeAtProgress(units, 1, false, 1)).toBe(1);
    expect(resolveParticleSizeAtProgress(units, 1, true, 1)).toBe(0.4);
  });

  it('interpolates each unit mesh offset and closes the offset sequence when looping', () => {
    const units: ImmersiveSceneUnit[] = [
      { ...testUnits[0], meshOffsetY: '-2' },
      { ...testUnits[1], meshOffsetY: '2' },
      { ...testUnits[2], meshOffsetY: '4' },
    ];

    expect(resolveMeshOffsetYAtProgress(units, 0, false)).toBe(-2);
    expect(resolveMeshOffsetYAtProgress(units, 0.25, false)).toBe(0);
    expect(resolveMeshOffsetYAtProgress(units, 0.75, false)).toBe(3);
    expect(resolveMeshOffsetYAtProgress(units, 1, false)).toBe(4);
    expect(resolveMeshOffsetYAtProgress(units, 0.75, true)).toBe(2.5);
    expect(resolveMeshOffsetYAtProgress(units, 1, true)).toBe(-2);
  });

  it('keeps live mesh offsets out of the engine signature', () => {
    const baseUnits = [{ ...testUnits[0], meshOffsetY: '0' }];
    const offsetUnits = [{ ...testUnits[0], meshOffsetY: '-1.5' }];
    const scaleUnits = [{ ...testUnits[0], meshOffsetY: '0', scale: '1.5' }];

    expect(resolveRendererUnitSignature(offsetUnits)).toBe(resolveRendererUnitSignature(baseUnits));
    expect(resolveRendererUnitSignature(scaleUnits)).not.toBe(resolveRendererUnitSignature(baseUnits));
    expect(resolveMeshOffsetYSignature(offsetUnits)).not.toBe(resolveMeshOffsetYSignature(baseUnits));
  });

  it('applies the unit mesh offset and rotation before updating the particle object world matrix', () => {
    const calls: unknown[][] = [];
    const object = {
      position: {
        set: (...values: number[]) => calls.push(['position', ...values]),
      },
      rotation: {
        set: (...values: number[]) => calls.push(['rotation', ...values]),
      },
      updateMatrixWorld: (force?: boolean) => calls.push(['matrix', force]),
    };

    applyParticleObjectTransform(object, { x: Math.PI / 8, y: Math.PI / 4, z: Math.PI / 2 }, -1.25);

    expect(calls).toEqual([
      ['position', 0, -1.25, 0],
      ['rotation', Math.PI / 8, Math.PI / 4, Math.PI / 2],
      ['matrix', true],
    ]);
  });

  it('applies uploaded mesh scale as a multiplier over the imported GLB transform', () => {
    expect(resolveLoadedMeshScale({ x: 2, y: 0.5, z: 3 }, { scale: undefined })).toEqual({
      x: 2,
      y: 0.5,
      z: 3,
    });
    expect(resolveLoadedMeshScale({ x: 2, y: 0.5, z: 3 }, { scale: '1.5' })).toEqual({
      x: 3,
      y: 0.75,
      z: 4.5,
    });
  });
});
