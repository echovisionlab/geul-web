import { validateShaderProgramSources, type ShaderError } from './shader-source';
import { validateShaderPassGraph, type ShaderProgramDocument } from './shader-program';
import { shaderAssetKey } from './shader-worker-protocol';

export interface ShaderPreviewRuntimeEvents {
  onReady: () => void;
  onStopped: () => void;
  onError: (error: ShaderError) => void;
}

export interface ShaderResolvedAsset {
  fileId: string;
  kind: 'image' | 'video';
  url: string;
  mimeType?: string;
}

export type ShaderAssetResolver = (fileId: string, kind: 'image' | 'video') => Promise<ShaderResolvedAsset>;

export interface ShaderRuntimeRunOptions {
  audioEnabled?: boolean;
  resolveAsset?: ShaderAssetResolver;
}

export interface ShaderPreviewRuntime {
  run: (program: ShaderProgramDocument, options?: ShaderRuntimeRunOptions) => void;
  stop: () => void;
  enableAudio: () => void;
  dispose: () => void;
  pointer: (x: number, y: number, pressed: boolean) => void;
  resize: (width: number, height: number) => void;
}

export type ShaderPreviewRuntimeFactory = (
  canvas: HTMLCanvasElement,
  events: ShaderPreviewRuntimeEvents,
) => ShaderPreviewRuntime;

type RuntimeMessage =
  | { type: 'ready' | 'heartbeat' | 'stopped' }
  | { type: 'error'; error: ShaderError }
  | { type: 'audio'; samples: Float32Array; sampleRate: number };

export const SHADER_START_TIMEOUT_MS = 8_000;
const HEARTBEAT_TIMEOUT_MS = 1_500;
const STOP_GRACE_MS = 100;

export function shaderContainedSize(width: number, height: number): { width: number; height: number } {
  const availableWidth = Math.max(1, width);
  const availableHeight = Math.max(1, height);
  const aspectRatio = 16 / 9;
  if (availableWidth / availableHeight > aspectRatio) {
    return { width: Math.max(1, Math.round(availableHeight * aspectRatio)), height: Math.round(availableHeight) };
  }
  return { width: Math.round(availableWidth), height: Math.max(1, Math.round(availableWidth / aspectRatio)) };
}

export const createShaderPreviewWorkerRuntime: ShaderPreviewRuntimeFactory = (canvas, events) => {
  let worker: Worker | null = null;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let audioContext: AudioContext | null = null;
  let audioCursor = 0;
  const videos = new Set<HTMLVideoElement>();
  const videoCleanups = new Set<() => void>();
  let loadGeneration = 0;

  const clearTimers = () => {
    if (watchdog) {
      clearTimeout(watchdog);
    }
    if (stopTimer) {
      clearTimeout(stopTimer);
    }
    watchdog = null;
    stopTimer = null;
  };
  const terminate = () => {
    clearTimers();
    worker?.terminate();
    worker = null;
    void audioContext?.close();
    audioContext = null;
    audioCursor = 0;
    loadGeneration += 1;
    videos.forEach((video) => {
      video.pause();
      video.removeAttribute('src');
      video.load();
    });
    videos.clear();
    videoCleanups.forEach((cleanup) => cleanup());
    videoCleanups.clear();
  };
  const fail = (error: ShaderError) => {
    terminate();
    events.onError(error);
  };
  const armWatchdog = (message: string) => {
    if (watchdog) {
      clearTimeout(watchdog);
    }
    watchdog = setTimeout(() => fail({ kind: 'resource', message }), HEARTBEAT_TIMEOUT_MS);
  };
  const enableAudio = () => {
    if (!audioContext) {
      audioContext = new AudioContext({ sampleRate: 44_100 });
      audioCursor = audioContext.currentTime;
    }
    void audioContext.resume();
    worker?.postMessage({ type: 'enableAudio' });
  };
  const loadAssets = (program: ShaderProgramDocument, resolver: ShaderAssetResolver, generation: number) => {
    const channels = Object.values(program.channels).flatMap((items) => items ?? []);
    channels.forEach((channel) => {
      if (channel.kind === 'textureFile') {
        void resolver(channel.fileId, 'image')
          .then(async (asset) =>
            createImageBitmap(await (await fetch(asset.url)).blob(), {
              imageOrientation: channel.sampler.vflip ? 'flipY' : 'none',
            }),
          )
          .then((bitmap) => {
            if (generation !== loadGeneration || !worker) {
              bitmap.close();
              return;
            }
            worker.postMessage({ type: 'asset2d', key: shaderAssetKey(channel), bitmap }, [bitmap]);
          })
          .catch(() => {
            if (generation === loadGeneration && worker) {
              fail({ kind: 'resource', message: `Shader texture File ${channel.fileId} is unavailable.` });
            }
          });
      } else if (channel.kind === 'cubemapFiles') {
        void Promise.all(
          channel.fileIds.map(async (fileId) => {
            const asset = await resolver(fileId, 'image');
            return createImageBitmap(await (await fetch(asset.url)).blob(), {
              imageOrientation: channel.sampler.vflip ? 'flipY' : 'none',
            });
          }),
        )
          .then((faces) => {
            if (generation !== loadGeneration || !worker) {
              faces.forEach((face) => face.close());
              return;
            }
            worker.postMessage({ type: 'assetCube', key: shaderAssetKey(channel), faces }, faces);
          })
          .catch(() => {
            if (generation === loadGeneration && worker) {
              fail({ kind: 'resource', message: 'A Shader cubemap face is unavailable.' });
            }
          });
      } else if (channel.kind === 'videoFile') {
        void resolver(channel.fileId, 'video')
          .then((asset) => {
            if (generation !== loadGeneration || !worker) {
              return;
            }
            const video = document.createElement('video');
            video.muted = true;
            video.playsInline = true;
            video.loop = true;
            video.crossOrigin = 'anonymous';
            videos.add(video);
            const pushFrame = async (): Promise<boolean> => {
              if (generation !== loadGeneration || !worker || video.paused) {
                return false;
              }
              try {
                const bitmap = await createImageBitmap(video, {
                  imageOrientation: channel.sampler.vflip ? 'flipY' : 'none',
                });
                if (generation !== loadGeneration || !worker) {
                  bitmap.close();
                  return false;
                }
                worker.postMessage(
                  {
                    type: 'assetVideo',
                    key: shaderAssetKey(channel),
                    bitmap,
                    time: video.currentTime,
                    width: video.videoWidth,
                    height: video.videoHeight,
                  },
                  [bitmap],
                );
                return true;
              } catch {
                if (generation === loadGeneration && worker) {
                  fail({ kind: 'resource', message: `Shader video File ${channel.fileId} cannot be decoded.` });
                }
                return false;
              }
            };
            const onLoaded = () => {
              void video.play().catch(() => {
                if (generation === loadGeneration) {
                  fail({ kind: 'resource', message: `Shader video File ${channel.fileId} cannot play.` });
                }
              });
              const frameCallbacks = video as unknown as {
                requestVideoFrameCallback?: (callback: VideoFrameRequestCallback) => number;
                cancelVideoFrameCallback?: (handle: number) => void;
              };
              if (frameCallbacks.requestVideoFrameCallback && frameCallbacks.cancelVideoFrameCallback) {
                let callbackId = 0;
                const tick = () => {
                  void pushFrame().then((sent) => {
                    if (sent && generation === loadGeneration && worker) {
                      callbackId = frameCallbacks.requestVideoFrameCallback?.(tick) ?? 0;
                    }
                  });
                };
                callbackId = frameCallbacks.requestVideoFrameCallback(tick);
                videoCleanups.add(() => frameCallbacks.cancelVideoFrameCallback?.(callbackId));
              } else {
                const timer = setInterval(() => {
                  if (video.paused) {
                    clearInterval(timer);
                  } else {
                    void pushFrame();
                  }
                }, 33);
                videoCleanups.add(() => clearInterval(timer));
              }
            };
            video.addEventListener('loadeddata', onLoaded, { once: true });
            videoCleanups.add(() => video.removeEventListener('loadeddata', onLoaded));
            if (/\.m3u8(?:$|\?)/u.test(asset.url) && !video.canPlayType('application/vnd.apple.mpegurl')) {
              void import('hls.js')
                .then(({ default: Hls }) => {
                  if (generation !== loadGeneration || !Hls.isSupported()) {
                    return;
                  }
                  const hls = new Hls();
                  hls.on(Hls.Events.ERROR, (_event, data) => {
                    if (data.fatal && generation === loadGeneration) {
                      hls.destroy();
                      fail({ kind: 'resource', message: `Shader video File ${channel.fileId} cannot be decoded.` });
                    }
                  });
                  hls.loadSource(asset.url);
                  hls.attachMedia(video);
                  videoCleanups.add(() => hls.destroy());
                })
                .catch(() =>
                  fail({ kind: 'resource', message: `Shader video File ${channel.fileId} cannot be decoded.` }),
                );
            } else {
              video.src = asset.url;
            }
          })
          .catch(() => {
            if (generation === loadGeneration && worker) {
              fail({ kind: 'resource', message: `Shader video File ${channel.fileId} is unavailable.` });
            }
          });
      }
    });
  };

  return {
    run(program, options) {
      if (disposed) {
        return;
      }
      terminate();
      const sourceError = validateShaderProgramSources(program.sources);
      if (sourceError) {
        events.onError(sourceError);
        return;
      }
      const graphError = validateShaderPassGraph(program);
      if (graphError) {
        events.onError({ kind: 'link', stage: 'link', message: graphError });
        return;
      }
      if (typeof canvas.transferControlToOffscreen !== 'function') {
        events.onError({ kind: 'resource', message: 'This browser cannot isolate the shader preview canvas.' });
        return;
      }
      try {
        if (options?.audioEnabled === true) {
          enableAudio();
        }
        const bounds = canvas.getBoundingClientRect();
        const pixelRatio = Math.min(globalThis.devicePixelRatio || 1, 2);
        const contained = shaderContainedSize((bounds.width || 960) * pixelRatio, (bounds.height || 540) * pixelRatio);
        canvas.width = contained.width;
        canvas.height = contained.height;
        worker = new Worker(new URL('./shader-preview.worker.ts', import.meta.url), {
          type: 'module',
          name: 'shader-preview',
        });
        worker.onmessage = (event: MessageEvent<RuntimeMessage>) => {
          const message = event.data;
          if (message.type === 'ready') {
            events.onReady();
            armWatchdog('The shader preview stopped responding and was terminated.');
          } else if (message.type === 'heartbeat') {
            armWatchdog('The shader preview exceeded its frame budget and was terminated.');
          } else if (message.type === 'stopped') {
            terminate();
            events.onStopped();
          } else if (message.type === 'error') {
            fail(message.error);
          } else if (message.type === 'audio' && audioContext) {
            const frames = Math.floor(message.samples.length / 2);
            const buffer = audioContext.createBuffer(2, frames, message.sampleRate);
            const left = buffer.getChannelData(0);
            const right = buffer.getChannelData(1);
            for (let index = 0; index < frames; index += 1) {
              left[index] = message.samples[index * 2] ?? 0;
              right[index] = message.samples[index * 2 + 1] ?? 0;
            }
            const source = audioContext.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.destination);
            audioCursor = Math.max(audioCursor, audioContext.currentTime);
            source.start(audioCursor);
            audioCursor += buffer.duration;
          }
        };
        worker.onerror = () => fail({ kind: 'runtime', message: 'The isolated shader preview failed.' });
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage(
          { type: 'start', program, audioEnabled: options?.audioEnabled === true, canvas: offscreen },
          [offscreen],
        );
        if (options?.resolveAsset) {
          loadAssets(program, options.resolveAsset, loadGeneration);
        }
        watchdog = setTimeout(() => {
          fail({ kind: 'resource', message: 'The shader preview did not start in time and was terminated.' });
        }, SHADER_START_TIMEOUT_MS);
      } catch {
        fail({ kind: 'resource', message: 'The isolated shader preview could not be started.' });
      }
    },
    pointer(x, y, pressed) {
      worker?.postMessage({ type: 'pointer', x, y, pressed });
    },
    resize(width, height) {
      worker?.postMessage({ type: 'resize', width, height });
    },
    enableAudio,
    stop() {
      if (!worker) {
        events.onStopped();
        return;
      }
      if (watchdog) {
        clearTimeout(watchdog);
      }
      watchdog = null;
      worker.postMessage({ type: 'stop' });
      stopTimer = setTimeout(() => {
        terminate();
        events.onStopped();
      }, STOP_GRACE_MS);
    },
    dispose() {
      disposed = true;
      terminate();
    },
  };
};
