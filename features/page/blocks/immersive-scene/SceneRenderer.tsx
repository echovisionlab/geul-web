'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { ParticlesEngine, TextureSequence } from '@echovisionlab/ionian';
import type * as Three from 'three';
import { Box, Title, useComputedColorScheme } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { toCdnUrl } from '@/lib/utils/file-url';
import { ImmersiveSceneDescriptionView } from './DescriptionView';
import classes from './SceneRenderer.module.css';
import {
  applyParticleObjectTransform,
  clamp,
  parseBoolean,
  parseNumber,
  parseOptionalNumber,
  resolveActiveUnit,
  resolveAutoplayClockState,
  resolveAutoplayTimelineState,
  resolveLoadedMeshScale,
  resolveMeshOffsetYAtProgress,
  resolveMeshOffsetYSignature,
  resolveParticleGeometryScale,
  resolveParticleSizeAtProgress,
  resolvePlaybackProgress,
  resolveRendererUnitSignature,
  resolveRenderUnitSequence,
  resolveSceneColorScheme,
  resolveSceneTextColors,
  resolveThemedUnitTexture,
  resolveUnitMeshScale,
  resolveUnitPresentation,
  type AutoplayClockState,
  type SceneColorScheme,
} from './scene-renderer-model';
import {
  DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS,
  DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS,
  type ImmersiveSceneConfig,
  type ImmersiveSceneMesh,
  type ImmersiveSceneUnit,
} from './schema';
import {
  DEFAULT_ROTATION_SPEED,
  DEFAULT_SCROLL_ROTATION_TURNS,
  ZERO_ROTATION_VECTOR,
  addRotationVectors,
  advanceRotation,
  resolveInitialRotationAtProgress,
  resolveRotationSpeedAtProgress,
  resolveSceneInitialRotation,
  resolveSceneRotationSpeed,
  resolveSceneScrollRotationTurns,
  resolveScrollRotationAtProgress,
  type RotationVector,
} from './rotation';

type ThreeModule = typeof import('three');

interface ImmersiveSceneRendererProps {
  config: ImmersiveSceneConfig;
  preview?: boolean;
  progress?: number;
}

type RendererStatus = 'idle' | 'ready' | 'fallback';
type AssetLoadStatus = 'idle' | 'primitive' | 'color' | 'loaded' | 'fallback';
const DRACO_DECODER_PATH = '/draco/gltf/';

interface RendererAssetStatus {
  mesh: AssetLoadStatus;
  texture: AssetLoadStatus;
}

interface UnitMeshAsset {
  fileId?: string;
  url: string;
}

type ShaderMaterialLike = Three.Material & {
  fragmentShader: string;
  uniforms: Record<string, { value: unknown }>;
  needsUpdate: boolean;
};

function createGeometry(THREE: ThreeModule, mesh: ImmersiveSceneMesh): Three.BufferGeometry {
  switch (mesh) {
    case 'box':
      return new THREE.BoxGeometry(1.45, 1.45, 1.45, 18, 18, 18);
    case 'torus':
      return new THREE.TorusKnotGeometry(0.68, 0.2, 180, 24);
    case 'cone':
      return new THREE.ConeGeometry(1, 1.75, 80, 24);
    case 'sphere':
    default:
      return new THREE.SphereGeometry(1, 72, 36);
  }
}

function createSceneMesh(THREE: ThreeModule, unit: ImmersiveSceneUnit): Three.Mesh {
  const geometry = createGeometry(THREE, unit.mesh);
  const scale = resolveUnitMeshScale(unit);
  geometry.scale(scale, scale, scale);
  const material = new THREE.MeshBasicMaterial({ color: unit.color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = unit.id;
  return mesh;
}

function applyLoadedMeshScale(mesh: Three.Mesh, unit: ImmersiveSceneUnit) {
  const scale = resolveLoadedMeshScale(mesh.scale, unit);
  mesh.scale.set(scale.x, scale.y, scale.z);
  mesh.updateMatrixWorld(true);
  return mesh;
}

export function resolveUnitMeshAsset(unit: ImmersiveSceneUnit): UnitMeshAsset | null {
  if (unit.meshSource !== 'file') {
    return null;
  }

  const optimizedFileId = unit.meshOptimizationFileId?.trim();
  if (optimizedFileId) {
    const optimizedUrl = unit.meshOptimizationUrl?.trim();
    return optimizedUrl ? { fileId: optimizedFileId, url: optimizedUrl } : null;
  }

  const sourceFileId = unit.meshFileId?.trim();
  const sourceUrl = unit.meshUrl?.trim();
  if (!sourceFileId || !sourceUrl) {
    return null;
  }
  return {
    fileId: sourceFileId,
    url: sourceUrl,
  };
}

function resolveSceneMeshId(unit: ImmersiveSceneUnit) {
  const asset = resolveUnitMeshAsset(unit);
  if (asset) {
    return `mesh:${asset.fileId || unit.id}`;
  }
  return `primitive:${unit.id}`;
}

function resolveSceneTextureId(unit: ImmersiveSceneUnit, colorScheme: SceneColorScheme) {
  const texture = resolveThemedUnitTexture(unit, colorScheme);
  return `texture:${colorScheme}:${texture.fileId || unit.id}`;
}

function isShaderMaterialLike(material: Three.Material): material is ShaderMaterialLike {
  return (
    'fragmentShader' in material &&
    typeof material.fragmentShader === 'string' &&
    'uniforms' in material &&
    typeof material.uniforms === 'object' &&
    material.uniforms !== null
  );
}

async function registerSceneMesh(
  engine: ParticlesEngine,
  THREE: ThreeModule,
  unit: ImmersiveSceneUnit,
): Promise<{ id: string; status: AssetLoadStatus }> {
  const meshId = resolveSceneMeshId(unit);
  const asset = resolveUnitMeshAsset(unit);
  if (asset) {
    const options = unit.meshObjectName ? { meshName: unit.meshObjectName } : undefined;
    try {
      const mesh = await engine.fetchAndRegisterMesh(meshId, toCdnUrl(asset.url), options);
      if (mesh) {
        applyLoadedMeshScale(mesh, unit);
        return { id: meshId, status: 'loaded' };
      }
    } catch {
      // Fall through to the primitive target so one failed asset does not blank the scene.
    }
  }

  engine.registerMesh(meshId, createSceneMesh(THREE, unit));
  return {
    id: meshId,
    status: asset ? 'fallback' : 'primitive',
  };
}

async function resolveSceneTextureSequenceItem(
  engine: ParticlesEngine,
  unit: ImmersiveSceneUnit,
  colorScheme: SceneColorScheme,
): Promise<{ item: TextureSequence[number]; status: AssetLoadStatus }> {
  const texture = resolveThemedUnitTexture(unit, colorScheme);
  if (texture.source === 'image' && texture.url) {
    const textureId = resolveSceneTextureId(unit, colorScheme);
    try {
      const registeredTexture = await engine.fetchAndRegisterMatcap(textureId, toCdnUrl(texture.url));
      if (registeredTexture) {
        return {
          item: {
            type: 'matcap',
            id: textureId,
          },
          status: 'loaded',
        };
      }
    } catch {
      // Fall through to the color target so one failed asset does not blank the scene.
    }
  }

  return {
    item: {
      type: 'color',
      value: texture.color,
    },
    status: texture.source === 'image' && texture.url ? 'fallback' : 'color',
  };
}

function aggregateAssetStatuses(statuses: AssetLoadStatus[], fallbackStatus: AssetLoadStatus) {
  if (statuses.includes('fallback')) {
    return 'fallback';
  }
  if (statuses.includes('loaded')) {
    return 'loaded';
  }
  return fallbackStatus;
}

function installParticleBrightness(engine: ParticlesEngine, brightness: number) {
  const material = engine.getObject().material;
  const materials = Array.isArray(material) ? material : [material];

  for (const item of materials) {
    if (!isShaderMaterialLike(item)) {
      continue;
    }

    item.uniforms.uParticleBrightness = { value: brightness };
    if (!item.fragmentShader.includes('uParticleBrightness')) {
      item.fragmentShader = item.fragmentShader
        .replace('uniform float uProgress;', 'uniform float uProgress;\nuniform float uParticleBrightness;')
        .replace(
          'gl_FragColor = finalColor;',
          'gl_FragColor = vec4(finalColor.rgb * uParticleBrightness, finalColor.a);',
        );
      item.needsUpdate = true;
    }
  }
}

function updateParticleBrightness(engine: ParticlesEngine, brightness: number) {
  const material = engine.getObject().material;
  const materials = Array.isArray(material) ? material : [material];

  for (const item of materials) {
    if (isShaderMaterialLike(item) && item.uniforms.uParticleBrightness) {
      item.uniforms.uParticleBrightness.value = brightness;
    }
  }
}

export function resolveScrollProgress(element: HTMLElement, scrollRoot: HTMLElement | null) {
  const rect = element.getBoundingClientRect();
  const viewportTop = scrollRoot?.getBoundingClientRect().top ?? 0;
  const viewportHeight = scrollRoot?.clientHeight ?? window.innerHeight;
  const scrollableDistance = rect.height - viewportHeight;
  if (scrollableDistance <= 0) {
    return rect.top <= viewportTop ? 1 : 0;
  }
  return clamp((viewportTop - rect.top) / scrollableDistance, 0, 1);
}

export function ImmersiveSceneRenderer({ config, preview = false, progress }: ImmersiveSceneRendererProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ParticlesEngine | null>(null);
  const renderFrameRef = useRef<(() => void) | null>(null);
  const progressRef = useRef(0);
  const particleBrightnessRef = useRef(1.25);
  const rotationControlsRef = useRef({
    enabled: true,
    initialRotation: { ...ZERO_ROTATION_VECTOR },
    speed: { ...DEFAULT_ROTATION_SPEED },
    scrollEnabled: true,
    scrollTurns: { ...DEFAULT_SCROLL_ROTATION_TURNS },
    isScrollScene: false,
  });
  const accumulatedTimeRotationRef = useRef<RotationVector>({ ...ZERO_ROTATION_VECTOR });
  const hoverControlsRef = useRef({
    enabled: true,
    radius: 0.45,
  });
  const reducedMotion = useReducedMotion();
  const computedColorScheme = useComputedColorScheme('light');
  const [rendererStatus, setRendererStatus] = useState<RendererStatus>('idle');
  const [assetStatus, setAssetStatus] = useState<RendererAssetStatus>({
    mesh: 'idle',
    texture: 'idle',
  });
  const [visualProgress, setVisualProgress] = useState(() => resolvePlaybackProgress(progress ?? 0, config.transition));
  const [autoplayTextSegmentProgress, setAutoplayTextSegmentProgress] = useState(0);

  const units = config.units;
  const latestUnitsRef = useRef(units);
  const isStatic = units.length <= 1;
  const textureSize = Number(config.textureSize);
  const heightVh = parseNumber(config.heightVh, 360, { min: 120, max: 900 });
  const minHeightPx = parseNumber(config.minHeightPx, 720, { min: 360, max: 1600 });
  const unitHoldSeconds = parseNumber(config.unitHoldSeconds, DEFAULT_IMMERSIVE_SCENE_UNIT_HOLD_SECONDS, {
    min: 0.2,
    max: 60,
  });
  const unitGapSeconds = parseNumber(config.unitGapSeconds, DEFAULT_IMMERSIVE_SCENE_UNIT_GAP_SECONDS, {
    min: 0,
    max: 30,
  });
  const transitionWindow = parseNumber(config.transitionWindow, 0.22, { min: 0.08, max: 0.8 });
  const particleSize = parseNumber(config.particleSize, 1, { min: 0.2, max: 5 });
  const colorScheme = resolveSceneColorScheme(config.preferredScheme, computedColorScheme);
  const backgroundEnabled = parseBoolean(config.backgroundEnabled, true);
  const backgroundColor =
    colorScheme === 'dark' ? config.darkBackgroundColor || config.backgroundColor : config.backgroundColor;
  const textColors = resolveSceneTextColors(colorScheme, config);
  const particleBrightness = parseNumber(
    colorScheme === 'dark' ? config.darkParticleBrightness : config.particleBrightness,
    colorScheme === 'dark' ? 1.45 : 1.25,
    { min: 0.2, max: 3 },
  );
  const rotationEnabled = parseBoolean(config.rotationEnabled, true);
  const initialRotation = resolveSceneInitialRotation(config);
  const rotationSpeed = resolveSceneRotationSpeed(config);
  const scrollRotationEnabled = parseBoolean(config.scrollRotationEnabled, true);
  const scrollRotationTurns = resolveSceneScrollRotationTurns(config);
  const hoverEnabled = parseBoolean(config.hoverEnabled, true);
  const hoverRepelRadius = parseNumber(config.hoverRepelRadius, 0.45, { min: 0.05, max: 2 });
  const playback = isStatic ? 'autoplay' : config.playback;
  const loop = config.loop === 'true' && playback === 'autoplay' && !isStatic;
  const isScrollScene = !preview && playback === 'scroll' && !isStatic;
  const usesAutoplayTimeline = playback === 'autoplay' && progress === undefined && !reducedMotion && !isStatic;
  const activeUnit = resolveActiveUnit(units, visualProgress, loop);
  const activeTexture = activeUnit ? resolveThemedUnitTexture(activeUnit, colorScheme) : null;
  const activeColor = activeTexture?.color ?? '#ffffff';

  const unitSignature = useMemo(() => resolveRendererUnitSignature(units), [units]);
  const meshOffsetYSignature = useMemo(() => resolveMeshOffsetYSignature(units), [units]);
  const unitHoldSecondsByIndex = useMemo(
    () => units.map((unit) => parseOptionalNumber(unit.holdSeconds, { min: 0.2, max: 60 })),
    [units],
  );

  useEffect(() => {
    latestUnitsRef.current = units;
    if (reducedMotion) {
      renderFrameRef.current?.();
    }
  }, [reducedMotion, units]);

  useEffect(() => {
    if (reducedMotion) {
      renderFrameRef.current?.();
    }
  }, [meshOffsetYSignature, reducedMotion]);

  useEffect(() => {
    particleBrightnessRef.current = particleBrightness;
    rotationControlsRef.current = {
      enabled: rotationEnabled,
      initialRotation,
      speed: rotationSpeed,
      scrollEnabled: scrollRotationEnabled,
      scrollTurns: scrollRotationTurns,
      isScrollScene,
    };
    if (!rotationEnabled) {
      accumulatedTimeRotationRef.current = { ...ZERO_ROTATION_VECTOR };
    }
    if (engineRef.current) {
      updateParticleBrightness(engineRef.current, particleBrightness);
      engineRef.current.setMaxRepelDistance(hoverEnabled ? hoverRepelRadius : 0);
      engineRef.current.useIntersect(hoverEnabled);
    }
    if (reducedMotion) {
      renderFrameRef.current?.();
    }
  }, [
    hoverEnabled,
    hoverRepelRadius,
    isScrollScene,
    particleBrightness,
    reducedMotion,
    rotationEnabled,
    initialRotation.x,
    initialRotation.y,
    initialRotation.z,
    rotationSpeed.x,
    rotationSpeed.y,
    rotationSpeed.z,
    scrollRotationEnabled,
    scrollRotationTurns.x,
    scrollRotationTurns.y,
    scrollRotationTurns.z,
  ]);

  useEffect(() => {
    hoverControlsRef.current = {
      enabled: hoverEnabled,
      radius: hoverRepelRadius,
    };
  }, [hoverEnabled, hoverRepelRadius]);

  useEffect(() => {
    const nextProgress = resolvePlaybackProgress(progress ?? 0, config.transition);
    progressRef.current = nextProgress;
    setVisualProgress(nextProgress);
    setAutoplayTextSegmentProgress(0);
    if (reducedMotion) {
      renderFrameRef.current?.();
    }
  }, [config.transition, progress, reducedMotion]);

  useEffect(() => {
    if (progress !== undefined || reducedMotion || isStatic) {
      return;
    }

    let frameId = 0;
    const root = rootRef.current;

    if (playback === 'scroll') {
      const updateFromScroll = () => {
        frameId = 0;
        if (!root) {
          return;
        }
        const nextProgress = resolvePlaybackProgress(resolveScrollProgress(root, null), config.transition);
        progressRef.current = nextProgress;
        setVisualProgress(nextProgress);
      };

      const requestUpdate = () => {
        if (frameId === 0) {
          frameId = window.requestAnimationFrame(updateFromScroll);
        }
      };

      requestUpdate();
      window.addEventListener('scroll', requestUpdate, { passive: true });
      window.addEventListener('resize', requestUpdate);
      return () => {
        if (frameId !== 0) {
          window.cancelAnimationFrame(frameId);
        }
        window.removeEventListener('scroll', requestUpdate);
        window.removeEventListener('resize', requestUpdate);
      };
    }

    let clockState: AutoplayClockState = {
      elapsedSeconds: 0,
      lastFrameTimestamp: null,
    };
    const resetFrameTimestamp = () => {
      clockState = {
        ...clockState,
        lastFrameTimestamp: null,
      };
    };
    const isPageHidden = () => typeof document !== 'undefined' && document.hidden;
    const tick = (timestamp: number) => {
      clockState = resolveAutoplayClockState(clockState, timestamp, isPageHidden());
      const timeline = resolveAutoplayTimelineState({
        elapsedSeconds: clockState.elapsedSeconds,
        unitCount: units.length,
        unitHoldSeconds,
        unitHoldSecondsByIndex,
        unitGapSeconds,
        loop,
        transition: config.transition,
      });
      progressRef.current = timeline.visualProgress;
      setVisualProgress(timeline.visualProgress);
      setAutoplayTextSegmentProgress(timeline.textSegmentProgress);

      if (timeline.shouldContinue) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', resetFrameTimestamp);
    window.addEventListener('pagehide', resetFrameTimestamp);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('visibilitychange', resetFrameTimestamp);
      window.removeEventListener('pagehide', resetFrameTimestamp);
    };
  }, [
    config.transition,
    isStatic,
    loop,
    playback,
    progress,
    reducedMotion,
    unitGapSeconds,
    unitHoldSeconds,
    unitHoldSecondsByIndex,
    units.length,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    let frameId = 0;
    let resizeObserver: ResizeObserver | null = null;
    let cleanup: (() => void) | null = null;
    const rendererUnits = units;

    async function initializeRenderer() {
      try {
        const [{ ParticlesEngine }, THREE] = await Promise.all([import('@echovisionlab/ionian'), import('three')]);

        if (disposed || !canvas) {
          return;
        }

        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: true,
          alpha: !backgroundEnabled,
          powerPreference: preview ? 'low-power' : 'high-performance',
        });
        renderer.setClearColor(backgroundColor, backgroundEnabled ? 1 : 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, preview ? 1.5 : 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(54, 1, 0.1, 100);
        camera.position.set(0, 0, 3.2);
        camera.lookAt(0, 0, 0);
        scene.add(camera);

        const engine = new ParticlesEngine({
          textureSize,
          scene,
          renderer,
          camera,
          useIntersection: hoverControlsRef.current.enabled,
          dracoDecoderPath: DRACO_DECODER_PATH,
        });
        engineRef.current = engine;
        cleanup = () => {
          if (frameId !== 0) {
            window.cancelAnimationFrame(frameId);
          }
          resizeObserver?.disconnect();
          if (engineRef.current === engine) {
            engineRef.current = null;
          }
          renderFrameRef.current = null;
          engine.dispose();
          renderer.dispose();
        };
        engine.setVelocityTractionForce(0.08);
        engine.setPositionalTractionForce(0.12);
        engine.setMaxRepelDistance(hoverControlsRef.current.enabled ? hoverControlsRef.current.radius : 0);
        const particleGeometryScale = resolveParticleGeometryScale(
          resolveParticleSizeAtProgress(rendererUnits, progressRef.current, loop, particleSize),
        );
        canvas.dataset.effectiveParticleSize = String(particleGeometryScale);
        engine.setGeometrySize({
          x: particleGeometryScale,
          y: particleGeometryScale,
          z: particleGeometryScale,
        });

        rendererUnits.forEach((unit) => {
          if (!resolveUnitMeshAsset(unit)) {
            engine.registerMesh(resolveSceneMeshId(unit), createSceneMesh(THREE, unit));
          }
        });
        const renderUnitSequence = resolveRenderUnitSequence(rendererUnits, loop);
        const meshIdByUnitId = new Map<string, string>();
        const meshStatuses: AssetLoadStatus[] = [];
        for (const unit of rendererUnits) {
          if (resolveUnitMeshAsset(unit)) {
            const meshResult = await registerSceneMesh(engine, THREE, unit);
            meshIdByUnitId.set(unit.id, meshResult.id);
            meshStatuses.push(meshResult.status);
            if (disposed) {
              return;
            }
          } else {
            meshIdByUnitId.set(unit.id, resolveSceneMeshId(unit));
            meshStatuses.push('primitive');
          }
        }
        await engine.setMeshSequence(
          renderUnitSequence.map((unit) => meshIdByUnitId.get(unit.id) ?? resolveSceneMeshId(unit)),
        );
        if (disposed) {
          return;
        }
        const textureByUnitId = new Map<string, TextureSequence[number]>();
        const textureStatuses: AssetLoadStatus[] = [];
        for (const unit of rendererUnits) {
          const textureResult = await resolveSceneTextureSequenceItem(engine, unit, colorScheme);
          textureByUnitId.set(unit.id, textureResult.item);
          textureStatuses.push(textureResult.status);
          if (disposed) {
            return;
          }
        }
        const textureSequence: TextureSequence = renderUnitSequence.map(
          (unit) =>
            textureByUnitId.get(unit.id) ?? {
              type: 'color',
              value: resolveThemedUnitTexture(unit, colorScheme).color,
            },
        );
        engine.setTextureSequence(textureSequence);
        installParticleBrightness(engine, particleBrightnessRef.current);

        const resize = () => {
          const parent = canvas.parentElement;
          const width = Math.max(1, parent?.clientWidth ?? canvas.clientWidth);
          const height = Math.max(1, parent?.clientHeight ?? canvas.clientHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        resizeObserver = new ResizeObserver(resize);
        if (canvas.parentElement) {
          resizeObserver.observe(canvas.parentElement);
        }
        resize();

        const timer = new THREE.Timer();
        timer.connect(document);
        const pointerNdc = new THREE.Vector2();
        const updatePointerPosition = (event: PointerEvent) => {
          const controls = hoverControlsRef.current;
          if (!controls.enabled) {
            return;
          }
          const parent = canvas.parentElement;
          const rect = parent?.getBoundingClientRect() ?? canvas.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) {
            return;
          }
          pointerNdc.set(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -(((event.clientY - rect.top) / rect.height) * 2 - 1),
          );
          engine.setPointerPosition(pointerNdc);
          if (reducedMotion) {
            renderFrameRef.current?.();
          }
        };
        const clearPointerPosition = () => {
          engine.setPointerPosition({ x: 2, y: 2 });
          if (reducedMotion) {
            renderFrameRef.current?.();
          }
        };
        canvas.addEventListener('pointermove', updatePointerPosition);
        canvas.addEventListener('pointerleave', clearPointerPosition);
        canvas.addEventListener('pointercancel', clearPointerPosition);
        cleanup = ((previousCleanup) => () => {
          canvas.removeEventListener('pointermove', updatePointerPosition);
          canvas.removeEventListener('pointerleave', clearPointerPosition);
          canvas.removeEventListener('pointercancel', clearPointerPosition);
          timer.dispose();
          previousCleanup?.();
        })(cleanup);

        let appliedParticleSize = particleGeometryScale;
        accumulatedTimeRotationRef.current = { ...ZERO_ROTATION_VECTOR };
        const renderFrame = (timestamp?: number) => {
          timer.update(timestamp);
          const deltaTime = timer.getDelta();
          const elapsedTime = timer.getElapsed();
          const rotationControls = rotationControlsRef.current;
          updateParticleBrightness(engine, particleBrightnessRef.current);
          engine.setOverallProgress(progressRef.current, false);
          const particleObject = engine.getObject();
          const authoredRotation = resolveInitialRotationAtProgress(
            latestUnitsRef.current,
            progressRef.current,
            loop,
            rotationControls.initialRotation,
          );
          let dynamicRotation = { ...ZERO_ROTATION_VECTOR };
          if (rotationControls.enabled && !reducedMotion) {
            accumulatedTimeRotationRef.current = advanceRotation(
              accumulatedTimeRotationRef.current,
              resolveRotationSpeedAtProgress(latestUnitsRef.current, progressRef.current, loop, rotationControls.speed),
              deltaTime,
            );
            const scrollRotation =
              rotationControls.scrollEnabled && rotationControls.isScrollScene
                ? resolveScrollRotationAtProgress(
                    latestUnitsRef.current,
                    progressRef.current,
                    loop,
                    rotationControls.scrollTurns,
                  )
                : ZERO_ROTATION_VECTOR;
            dynamicRotation = addRotationVectors(accumulatedTimeRotationRef.current, scrollRotation);
          }
          const meshOffsetY = resolveMeshOffsetYAtProgress(latestUnitsRef.current, progressRef.current, loop);
          applyParticleObjectTransform(
            particleObject,
            addRotationVectors(authoredRotation, dynamicRotation),
            meshOffsetY,
          );
          const nextParticleSize = resolveParticleGeometryScale(
            resolveParticleSizeAtProgress(rendererUnits, progressRef.current, loop, particleSize),
          );
          if (Math.abs(nextParticleSize - appliedParticleSize) > 0.001) {
            engine.setGeometrySize({ x: nextParticleSize, y: nextParticleSize, z: nextParticleSize });
            appliedParticleSize = nextParticleSize;
            canvas.dataset.effectiveParticleSize = String(nextParticleSize);
          }
          engine.renderFrame(deltaTime, elapsedTime);
          renderer.render(scene, camera);
        };
        renderFrameRef.current = renderFrame;

        if (reducedMotion) {
          renderFrame();
        } else {
          const animate = (timestamp: number) => {
            renderFrame(timestamp);
            frameId = window.requestAnimationFrame(animate);
          };
          frameId = window.requestAnimationFrame(animate);
        }

        if (!disposed) {
          setAssetStatus({
            mesh: aggregateAssetStatuses(meshStatuses, 'primitive'),
            texture: aggregateAssetStatuses(textureStatuses, 'color'),
          });
          setRendererStatus('ready');
        }
      } catch {
        if (!disposed) {
          setAssetStatus({ mesh: 'fallback', texture: 'fallback' });
          setRendererStatus('fallback');
        }
      }
    }

    setRendererStatus('idle');
    setAssetStatus({ mesh: 'idle', texture: 'idle' });
    void initializeRenderer();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [
    backgroundColor,
    backgroundEnabled,
    colorScheme,
    loop,
    particleSize,
    preview,
    reducedMotion,
    textureSize,
    unitSignature,
  ]);

  const heightMode = preview ? 'preview' : isScrollScene ? 'scroll' : 'intrinsic';
  const rootStyle = {
    '--immersive-scene-intrinsic-height': `${minHeightPx}px`,
    '--immersive-scene-scroll-document-height': `${heightVh}vh`,
    background: backgroundEnabled ? backgroundColor : 'transparent',
    color: textColors.root,
  } as CSSProperties;
  const segmentCount = loop ? units.length : units.length - 1;
  const segmentProgress =
    units.length <= 1 ? 0 : usesAutoplayTimeline ? autoplayTextSegmentProgress : visualProgress * segmentCount;

  return (
    <Box
      ref={rootRef}
      className={classes.root}
      data-immersive-scene
      data-playback={isStatic ? 'static' : playback}
      data-color-scheme={colorScheme}
      data-background-enabled={backgroundEnabled ? 'true' : 'false'}
      data-renderer-status={rendererStatus}
      data-mesh-asset-status={assetStatus.mesh}
      data-texture-asset-status={assetStatus.texture}
      data-particle-count={`${textureSize}x${textureSize}`}
      data-default-particle-size={particleSize}
      data-particle-brightness={particleBrightness}
      data-rotation-enabled={rotationEnabled ? 'true' : 'false'}
      data-rotation-x={config.rotationX}
      data-rotation-y={config.rotationY}
      data-rotation-z={config.rotationZ}
      data-rotation-speed-x={rotationSpeed.x}
      data-rotation-speed-y={rotationSpeed.y}
      data-rotation-speed-z={rotationSpeed.z}
      data-scroll-rotation-enabled={scrollRotationEnabled ? 'true' : 'false'}
      data-scroll-rotation-turns-x={scrollRotationTurns.x}
      data-scroll-rotation-turns-y={scrollRotationTurns.y}
      data-scroll-rotation-turns-z={scrollRotationTurns.z}
      data-hover-enabled={hoverEnabled ? 'true' : 'false'}
      data-hover-repel-radius={hoverRepelRadius}
      data-height-mode={heightMode}
      data-scroll-owner="document"
      data-preview={preview ? 'true' : 'false'}
      style={rootStyle}
    >
      <Box className={classes.viewport} data-immersive-scene-viewport>
        <Box
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `radial-gradient(circle at 50% 38%, ${activeColor}55 0 1px, transparent 1.2px), radial-gradient(circle at 48% 48%, ${activeColor}26 0 1px, transparent 1.4px)`,
            backgroundSize: '7px 7px, 13px 13px',
            opacity: backgroundEnabled ? (rendererStatus === 'ready' ? 0.2 : 0.7) : 0,
            transform: `scale(${1 + visualProgress * 0.08})`,
            transition: reducedMotion ? undefined : 'opacity 240ms ease, transform 600ms ease',
          }}
        />
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          data-immersive-scene-canvas
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: rendererStatus === 'ready' ? 1 : 0,
            transition: reducedMotion ? undefined : 'opacity 240ms ease',
          }}
        />
        <Box
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            pointerEvents: 'none',
            padding: preview ? '32px' : 'clamp(32px, 7vw, 96px)',
            textAlign: 'center',
          }}
        >
          {units.map((unit, index) => {
            const { opacity } = resolveUnitPresentation(segmentProgress, index, units.length, transitionWindow, loop);
            return (
              <Box
                key={unit.id}
                data-immersive-scene-unit={unit.id}
                aria-hidden={opacity < 0.5}
                style={{
                  gridArea: '1 / 1',
                  maxWidth: preview ? 520 : 820,
                  opacity,
                  transition: reducedMotion || usesAutoplayTimeline ? undefined : 'opacity 220ms ease',
                }}
              >
                {unit.title ? (
                  <Title
                    order={preview ? 3 : 2}
                    style={{
                      color: textColors.title,
                      fontWeight: 800,
                      letterSpacing: 0,
                      fontSize: preview ? 28 : 'clamp(40px, 7vw, 92px)',
                      lineHeight: 1,
                    }}
                  >
                    {unit.title}
                  </Title>
                ) : null}
                {unit.text ? (
                  <Box
                    mt={preview ? 'sm' : 'xl'}
                    style={{
                      color: textColors.body,
                      fontSize: preview ? 'var(--mantine-font-size-sm)' : 'var(--mantine-font-size-xl)',
                    }}
                  >
                    <ImmersiveSceneDescriptionView>{unit.text}</ImmersiveSceneDescriptionView>
                  </Box>
                ) : null}
              </Box>
            );
          })}
        </Box>
        <Box
          data-immersive-scene-attribution-layer
          style={{
            position: 'absolute',
            insetInlineEnd: preview ? 16 : 'clamp(16px, 2.5vw, 32px)',
            insetBlockEnd: preview ? 16 : 'max(clamp(16px, 2.5vw, 32px), env(safe-area-inset-bottom))',
            zIndex: 2,
            display: 'grid',
            width: 'max-content',
            maxWidth: preview ? 'min(260px, calc(100% - 32px))' : 'min(28rem, calc(100% - 32px))',
            textAlign: 'end',
            pointerEvents: 'none',
          }}
        >
          {units.map((unit, index) => {
            const attribution = unit.attribution?.trim();
            if (!attribution) {
              return null;
            }

            const { opacity } = resolveUnitPresentation(segmentProgress, index, units.length, transitionWindow, loop);
            const isInteractive = opacity >= 0.5;
            return (
              <Box
                key={unit.id}
                role="note"
                data-immersive-scene-unit-attribution={unit.id}
                aria-hidden={!isInteractive}
                inert={isInteractive ? undefined : true}
                style={{
                  gridArea: '1 / 1',
                  minWidth: 0,
                  padding: preview ? '6px 8px' : 'clamp(6px, 1vw, 10px) clamp(8px, 1.25vw, 12px)',
                  borderRadius: 6,
                  color: textColors.body,
                  background: `color-mix(in srgb, ${backgroundColor} 62%, transparent)`,
                  backdropFilter: 'blur(10px)',
                  opacity,
                  pointerEvents: isInteractive ? 'auto' : 'none',
                  transition: reducedMotion || usesAutoplayTimeline ? undefined : 'opacity 220ms ease',
                }}
              >
                <ImmersiveSceneDescriptionView variant="attribution">{attribution}</ImmersiveSceneDescriptionView>
              </Box>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}
