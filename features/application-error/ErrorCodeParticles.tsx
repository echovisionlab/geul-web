'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Text, useComputedColorScheme } from '@mantine/core';
import { loadIonianRuntime, loadThreeRuntime } from '@/lib/three/cdn-runtime';

const WIDTH = 480;
const HEIGHT = 200;
const WORLD_SCALE = 100;
const PARTICLE_TEXTURE_SIZE = 64;
const ENTRANCE_DURATION_MS = 1100;
const ENTRANCE_LEAD_FRAMES = 5;
const SCATTER_ID = 'error-scatter';

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

function scatterVertices() {
  const vertices: number[] = [];
  const random = (index: number, axis: number) => {
    const value = Math.sin(index * 127.1 + axis * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  const gaussian = (index: number, axis: number) =>
    Math.sqrt(-2 * Math.log(Math.max(random(index, axis), 0.0001))) * Math.cos(2 * Math.PI * random(index, axis + 1));
  for (let index = 0; index < PARTICLE_TEXTURE_SIZE ** 2; index++) {
    const x = gaussian(index, 1) * 1.05;
    const y = gaussian(index, 3) * 0.28 + Math.sin(x * 1.9) * 0.16 + Math.sin(x * 4.1) * 0.08;
    const z = gaussian(index, 5) * 0.12;
    // Gaussian falloff and uneven density avoid a hard rectangular edge or
    // a recognizable surface silhouette in the starting noise field.
    vertices.push(x, y, z, x + 0.005, y, z, x, y + 0.005, z);
  }
  return vertices;
}

// Bounded, continuous displacement of each Ionian instance. Only position
// changes; opacity and color remain stable to avoid a flashing effect.
const PARTICLE_DRIFT = `
uniform float uErrorDrift;
vec3 errorParticleDrift(vec2 id, float time) {
  float seed = dot(id, vec2(127.1, 311.7));
  return uErrorDrift * vec3(
    sin(time * 0.7 + seed) * 0.028 + sin(time * 1.1 + seed * 1.7) * 0.012,
    cos(time * 0.85 + seed * 0.91) * 0.035,
    sin(time * 0.6 + seed * 1.13) * 0.09
  );
}
`;

function sampleNumber(code: string, fontFamily: string) {
  const mask = document.createElement('canvas');
  mask.width = WIDTH;
  mask.height = HEIGHT;
  const context = mask.getContext('2d');
  if (!context) {
    throw new Error('Number mask unavailable');
  }
  context.font = `800 180px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(code, WIDTH / 2, HEIGHT / 2, WIDTH - 40);
  const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
  const vertices: number[] = [];
  for (let y = 0; y < HEIGHT; y += 3) {
    for (let x = 0; x < WIDTH; x += 3) {
      if (pixels[(y * WIDTH + x) * 4 + 3] > 100) {
        const left = (x - WIDTH / 2) / WORLD_SCALE;
        const top = (HEIGHT / 2 - y) / WORLD_SCALE;
        const step = 3 / WORLD_SCALE;
        // Triangulate filled glyph cells for Ionian's mesh surface sampler.
        vertices.push(
          left,
          top,
          0,
          left,
          top - step,
          0,
          left + step,
          top,
          0,
          left + step,
          top,
          0,
          left,
          top - step,
          0,
          left + step,
          top - step,
          0,
        );
      }
    }
  }
  if (vertices.length === 0) {
    throw new Error('Number mask is empty');
  }
  return vertices;
}

export function ErrorCodeParticles({ code }: { code: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderedCode, setRenderedCode] = useState<string | null>(null);
  const [fallbackCode, setFallbackCode] = useState<string | null>(null);
  const scheme = useComputedColorScheme('light');
  const renderKey = `${code}:${scheme}`;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    if (typeof WebGL2RenderingContext === 'undefined') {
      setFallbackCode(renderKey);
      return;
    }
    let cancelled = false;
    let release: (() => void) | undefined;
    void (async () => {
      try {
        const [THREE, { ParticlesEngine }] = await Promise.all([loadThreeRuntime(), loadIonianRuntime()]);
        if (cancelled) {
          return;
        }
        const style = getComputedStyle(host);
        const vertices = sampleNumber(code, style.fontFamily);
        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
        release = () => renderer.dispose();
        renderer.debug.checkShaderErrors = process.env.NODE_ENV === 'development';
        const scene = new THREE.Scene();
        // Perspective makes a flat glyph's pointer-facing tilt visible.
        const camera = new THREE.PerspectiveCamera(32, WIDTH / HEIGHT, 0.1, 100);
        camera.position.z = HEIGHT / WORLD_SCALE / 2 / Math.tan(THREE.MathUtils.degToRad(16));
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const engine = new ParticlesEngine({
          textureSize: PARTICLE_TEXTURE_SIZE,
          scene,
          renderer,
          camera,
          useIntersection: false,
          dracoDecoderPath: null,
          pointerFacing: {
            enabled: !reducedMotion.matches,
            strength: { x: 0.9, y: 0.95, z: 0.4 },
            response: { x: 2.5, y: 3.5, z: 2.5 },
            maxAngle: { x: Math.PI / 9, y: Math.PI / 6, z: Math.PI / 36 },
          },
        });
        let detach = () => {};
        let disposed = false;
        release = () => {
          if (disposed) {
            return;
          }
          disposed = true;
          renderer.setAnimationLoop(null);
          detach();
          // Ionian owns the sampled assets; its default instance geometry needs
          // explicit disposal by the host.
          const instanceGeometry = engine.getObject().geometry;
          engine.dispose();
          instanceGeometry.dispose();
          renderer.dispose();
          renderer.domElement.remove();
        };
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.computeVertexNormals();
        const glyph = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
        engine.registerMesh(code, glyph);
        // Ionian samples the scattered field and assembles its particles into
        // the glyph through its own mesh sequence transition.
        const scatter = new THREE.BufferGeometry();
        scatter.setAttribute('position', new THREE.Float32BufferAttribute(scatterVertices(), 3));
        scatter.computeVertexNormals();
        engine.registerMesh(SCATTER_ID, new THREE.Mesh(scatter, new THREE.MeshBasicMaterial()));
        engine.setGeometrySize({ x: 10, y: 10, z: 10 });
        engine.setVelocityTractionForce(0.16);
        engine.setPositionalTractionForce(0.6);
        engine.setTextureSequence([{ type: 'color', value: style.color }]);
        const materials = engine.getObject().material;
        const driftStrength = { value: reducedMotion.matches ? 0 : 1 };
        for (const material of Array.isArray(materials) ? materials : [materials]) {
          if (material instanceof THREE.ShaderMaterial) {
            // Extend the engine's own instance material, keeping its simulation,
            // geometry, time uniform, and pointer-facing behavior intact.
            material.uniforms.uErrorDrift = driftStrength;
            material.vertexShader =
              PARTICLE_DRIFT +
              material.vertexShader
                .replace('vec3 pos = color.xyz;', 'vec3 pos = color.xyz + errorParticleDrift(uvRef, uTime);')
                .replace(
                  'localPosition.y *= max(1.0, length(velocity.xyz) * 1000.0);',
                  'localPosition.y *= clamp(length(velocity.xyz) * 1000.0, 1.0, 2.5);',
                );
            // Convert Ionian's linear solid color to the site's display color.
            if (!material.fragmentShader.includes('<colorspace_fragment>')) {
              material.fragmentShader = material.fragmentShader.replace(
                'gl_FragColor = finalColor;',
                'gl_FragColor = finalColor;\n#include <colorspace_fragment>',
              );
            }
            material.needsUpdate = true;
          }
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;';
        renderer.domElement.setAttribute('aria-hidden', 'true');
        let elapsed = 3;
        let ready = false;
        let previousFrame = 0;
        let lost = false;
        const includeScatter = !reducedMotion.matches;
        let settledForReducedMotion = false;
        const settleSimulation = () => {
          for (let frame = 0; frame < 180; frame++) {
            engine.renderFrame(1 / 60, elapsed);
          }
        };
        const draw = (now: number) => {
          const delta = previousFrame ? Math.max(0, Math.min((now - previousFrame) / 1000, 0.05)) : 1 / 60;
          elapsed += delta;
          previousFrame = now;
          if (!reducedMotion.matches) {
            engine.renderFrame(delta, elapsed);
          }
          renderer.render(scene, camera);
        };
        const updateLoop = () => {
          previousFrame = performance.now();
          renderer.setAnimationLoop(null);
          if (!ready || lost || cancelled) {
            return;
          }
          engine.setPointerFacing({ enabled: !reducedMotion.matches });
          driftStrength.value = reducedMotion.matches ? 0 : 1;
          if (reducedMotion.matches) {
            engine.setPointerFacingPosition(null);
            if (!settledForReducedMotion) {
              engine.setOverallProgress(1);
              settleSimulation();
              settledForReducedMotion = true;
            }
            engine.renderFrame(1, elapsed);
          } else {
            settledForReducedMotion = false;
          }
          if (reducedMotion.matches || document.hidden) {
            draw(performance.now());
          } else {
            renderer.setAnimationLoop(draw);
          }
        };
        const resize = () => {
          renderer.setSize(host.clientWidth, host.clientHeight, false);
          if (host.clientHeight > 0) {
            camera.aspect = host.clientWidth / host.clientHeight;
            camera.updateProjectionMatrix();
          }
          if (ready && !lost) {
            draw(performance.now());
          }
        };
        const resizeObserver = new ResizeObserver(resize);
        const move = (event: PointerEvent) => {
          const bounds = host.getBoundingClientRect();
          if (!reducedMotion.matches && bounds.width > 0 && bounds.height > 0) {
            engine.setPointerFacingPosition({
              x: THREE.MathUtils.clamp((2 * (event.clientX - bounds.left)) / bounds.width - 1, -1, 1),
              y: THREE.MathUtils.clamp(1 - (2 * (event.clientY - bounds.top)) / bounds.height, -1, 1),
            });
          }
        };
        const leave = () => engine.setPointerFacingPosition(null);
        const leaveViewport = (event: PointerEvent) => {
          if (event.relatedTarget === null) {
            leave();
          }
        };
        const contextLost = (event: Event) => {
          event.preventDefault();
          lost = true;
          renderer.setAnimationLoop(null);
          renderer.domElement.style.visibility = 'hidden';
          setRenderedCode(null);
          setFallbackCode(renderKey);
        };
        detach = () => {
          resizeObserver.disconnect();
          reducedMotion.removeEventListener('change', updateLoop);
          document.removeEventListener('visibilitychange', updateLoop);
          window.removeEventListener('blur', leave);
          window.removeEventListener('pointermove', move);
          window.removeEventListener('pointerout', leaveViewport);
          renderer.domElement.removeEventListener('webglcontextlost', contextLost);
        };
        host.append(renderer.domElement);
        resizeObserver.observe(host);
        reducedMotion.addEventListener('change', updateLoop);
        document.addEventListener('visibilitychange', updateLoop);
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerout', leaveViewport);
        window.addEventListener('blur', leave);
        renderer.domElement.addEventListener('webglcontextlost', contextLost);
        resize();
        await engine.setMeshSequence(includeScatter ? [SCATTER_ID, code] : [code]);
        if (cancelled || lost) {
          return;
        }
        // Prepare the visible particle shader before revealing the noise so
        // its first compilation cannot pause the entrance on screen.
        await renderer.compileAsync(scene, camera);
        if (cancelled || lost) {
          return;
        }
        // Settle the starting cloud, then reveal its actual Ionian transition.
        // Reduced motion skips the entrance and shows the completed number.
        if (reducedMotion.matches) {
          engine.setOverallProgress(1);
        }
        settleSimulation();
        settledForReducedMotion = reducedMotion.matches;
        if (includeScatter && !reducedMotion.matches) {
          // Start gathering on the first visible frame, with no idle hold or
          // slow ease-in. The particles decelerate as they reach the glyph.
          engine.scheduleMeshSequenceTransition(1, ENTRANCE_DURATION_MS, easeOutCubic);
          engine.renderFrame(0, elapsed);
          // Reveal particles already in motion instead of showing the settled
          // cloud while their attraction starts accelerating from rest.
          for (let frame = 0; frame < ENTRANCE_LEAD_FRAMES; frame++) {
            elapsed += 1 / 60;
            engine.renderFrame(1 / 60, elapsed);
          }
        }
        ready = true;
        draw(performance.now());
        updateLoop();
        setRenderedCode(renderKey);
      } catch {
        release?.();
        // Keep a readable number and recovery actions if graphics are unavailable.
        if (!cancelled) {
          setRenderedCode(null);
          setFallbackCode(renderKey);
        }
      }
    })();
    return () => {
      cancelled = true;
      release?.();
    };
  }, [code, renderKey]);

  return (
    <Box
      ref={hostRef}
      aria-hidden="true"
      c="dimmed"
      w="min(480px, 80vw)"
      pos="relative"
      style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
      data-error-code={code}
      data-particle-engine="ionian"
      data-particles-ready={renderedCode === renderKey}
    >
      <Text
        fz="6rem"
        fw={700}
        ta="center"
        lh={1}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: fallbackCode === renderKey ? 1 : 0,
        }}
      >
        {code}
      </Text>
    </Box>
  );
}
