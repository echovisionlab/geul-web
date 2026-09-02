import {
  mapShaderCompileError,
  normalizeShaderError,
  type ShaderCompileSourceMap,
  type ShaderError,
} from './shader-source';
import type { ShaderChannel, ShaderProgramDocument, ShaderStage, ShaderVisualStage } from './shader-program';
import {
  shaderAssetKey,
  shaderFeedbackReadIndex,
  shaderPassReadIndex,
  shaderPassOrder,
  shaderRenderTargetPlan,
  shaderShouldRenderSoundChunk,
  shaderWorkerMessageAction,
  SHADER_SOUND_CHUNK_SAMPLES,
} from './shader-worker-protocol';

type StartMessage = { type: 'start'; program: ShaderProgramDocument; audioEnabled: boolean; canvas: OffscreenCanvas };
type StopMessage = { type: 'stop' };
type PointerMessage = { type: 'pointer'; x: number; y: number; pressed: boolean };
type ResizeMessage = { type: 'resize'; width: number; height: number };
type EnableAudioMessage = { type: 'enableAudio' };
type Asset2DMessage = { type: 'asset2d'; key: string; bitmap: ImageBitmap };
type AssetVideoMessage = {
  type: 'assetVideo';
  key: string;
  bitmap: ImageBitmap;
  time: number;
  width: number;
  height: number;
};
type AssetCubeMessage = { type: 'assetCube'; key: string; faces: ImageBitmap[] };
type IncomingMessage =
  | StartMessage
  | StopMessage
  | PointerMessage
  | ResizeMessage
  | EnableAudioMessage
  | Asset2DMessage
  | AssetVideoMessage
  | AssetCubeMessage;

const worker = globalThis as typeof globalThis & {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
  onmessage: ((event: MessageEvent<IncomingMessage>) => void) | null;
};

const BUFFER_STAGE = { A: 'bufferA', B: 'bufferB', C: 'bufferC', D: 'bufferD' } as const;
export const COMMON_UNIFORMS = `precision highp float;
precision highp int;
uniform vec3 iResolution;
uniform float iTime;
uniform float iTimeDelta;
uniform float iFrameRate;
uniform int iFrame;
uniform float iChannelTime[4];
uniform vec3 iChannelResolution[4];
uniform vec4 iMouse;
uniform vec4 iDate;
uniform float iSampleRate;
`;

interface RenderTarget {
  textures: [WebGLTexture, WebGLTexture];
  framebuffers: [WebGLFramebuffer, WebGLFramebuffer];
  write: 0 | 1;
}

interface CompiledPass {
  stage: ShaderVisualStage;
  program: WebGLProgram;
  channels: readonly ShaderChannel[];
  target?: RenderTarget;
  cubeTarget?: {
    textures: [WebGLTexture, WebGLTexture];
    framebuffers: [WebGLFramebuffer[], WebGLFramebuffer[]];
    write: 0 | 1;
  };
}

interface ExternalTexture {
  texture: WebGLTexture;
  target: number;
  width: number;
  height: number;
  time: number;
}

let gl: WebGL2RenderingContext | null = null;
let canvas: OffscreenCanvas | null = null;
let documentProgram: ShaderProgramDocument | null = null;
let passes: CompiledPass[] = [];
let blackTexture: WebGLTexture | null = null;
let blackCubeTexture: WebGLTexture | null = null;
let soundProgram: WebGLProgram | null = null;
let soundTarget: RenderTarget | null = null;
let soundSample = 0;
let soundEnabled = false;
let soundChannels: readonly ShaderChannel[] = [];
const externalTextures = new Map<string, ExternalTexture>();
const samplerObjects = new Map<string, WebGLSampler>();
let frameTimer: ReturnType<typeof setTimeout> | null = null;
let startedAt = 0;
let previousFrameAt = 0;
let frame = 0;
let lastHeartbeat = 0;
let mouse: [number, number, number, number] = [0, 0, 0, 0];
let pointerPressed = false;
let intentionallyLosingContext = false;

function report(error: ShaderError): void {
  worker.postMessage({ type: 'error', error });
}

function deleteTarget(context: WebGL2RenderingContext, target: RenderTarget): void {
  target.textures.forEach((texture) => context.deleteTexture(texture));
  target.framebuffers.forEach((framebuffer) => context.deleteFramebuffer(framebuffer));
}

function cleanup(): void {
  if (frameTimer) {
    clearTimeout(frameTimer);
  }
  frameTimer = null;
  if (gl) {
    passes.forEach((pass) => {
      gl?.deleteProgram(pass.program);
      if (pass.target) {
        deleteTarget(gl as WebGL2RenderingContext, pass.target);
      }
      if (pass.cubeTarget) {
        pass.cubeTarget.textures.forEach((texture) => gl?.deleteTexture(texture));
        pass.cubeTarget.framebuffers.flat().forEach((framebuffer) => gl?.deleteFramebuffer(framebuffer));
      }
    });
    if (blackTexture) {
      gl.deleteTexture(blackTexture);
    }
    if (blackCubeTexture) {
      gl.deleteTexture(blackCubeTexture);
    }
    if (soundProgram) {
      gl.deleteProgram(soundProgram);
    }
    if (soundTarget) {
      deleteTarget(gl, soundTarget);
    }
    externalTextures.forEach((asset) => gl?.deleteTexture(asset.texture));
    samplerObjects.forEach((sampler) => gl?.deleteSampler(sampler));
  }
  passes = [];
  blackTexture = null;
  blackCubeTexture = null;
  soundProgram = null;
  soundTarget = null;
  soundSample = 0;
  soundEnabled = false;
  soundChannels = [];
  externalTextures.clear();
  samplerObjects.clear();
  try {
    intentionallyLosingContext = true;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    // The disposable worker is the final resource boundary.
  }
  gl = null;
  canvas = null;
  documentProgram = null;
  mouse = [0, 0, 0, 0];
  pointerPressed = false;
  intentionallyLosingContext = false;
}

function stripVersion(source: string): string {
  return source.replace(/^\s*#version\s+300\s+es\s*(?:\r?\n)?/u, '');
}

function isCube(channel: ShaderChannel): boolean {
  return channel.kind === 'cubemapFiles' || channel.kind === 'cubemapPass';
}

function channelUniforms(channels: readonly ShaderChannel[]): string {
  return [0, 1, 2, 3]
    .map(
      (index) =>
        `uniform highp ${isCube(channels[index] ?? { kind: 'none' }) ? 'samplerCube' : 'sampler2D'} iChannel${index};`,
    )
    .join('\n');
}

function compileSource(
  prefix: string,
  common: string,
  stageSource: string,
  footer: string,
  stage: ShaderStage,
): { source: string; map: ShaderCompileSourceMap } {
  const commonStartLine = prefix.split('\n').length;
  const commonLineCount = common ? common.split(/\r?\n/u).length : 0;
  const stageStartLine = commonStartLine + commonLineCount;
  return {
    source: `${prefix}${common}${common ? '\n' : ''}${stageSource}${footer}`,
    map: { stage, commonStartLine, commonLineCount, stageStartLine },
  };
}

function fragmentSource(
  program: ShaderProgramDocument,
  stage: ShaderVisualStage,
): { source: string; map: ShaderCompileSourceMap } {
  const channels = program.channels[stage] ?? [];
  const body = stripVersion(program.sources[stage]);
  const prefix = `#version 300 es\n${COMMON_UNIFORMS}${channelUniforms(channels)}\nout vec4 tiptapPreviewFragmentColor;\n`;
  let footer = '';
  if (/\bvoid\s+mainImage\s*\(/u.test(body) && !/\bvoid\s+main\s*\(/u.test(body)) {
    footer = '\nvoid main() { mainImage(tiptapPreviewFragmentColor, gl_FragCoord.xy); }';
  } else if (stage === 'cubemap' && /\bvoid\s+mainCubemap\s*\(/u.test(body) && !/\bvoid\s+main\s*\(/u.test(body)) {
    footer =
      '\nuniform int tiptapPreviewCubeFace; vec3 tiptapPreviewCubeRay(vec2 uv){if(tiptapPreviewCubeFace==0)return normalize(vec3(1.0,-uv.y,-uv.x));if(tiptapPreviewCubeFace==1)return normalize(vec3(-1.0,-uv.y,uv.x));if(tiptapPreviewCubeFace==2)return normalize(vec3(uv.x,1.0,uv.y));if(tiptapPreviewCubeFace==3)return normalize(vec3(uv.x,-1.0,-uv.y));if(tiptapPreviewCubeFace==4)return normalize(vec3(uv.x,-uv.y,1.0));return normalize(vec3(-uv.x,-uv.y,-1.0));} void main(){vec2 uv=(gl_FragCoord.xy/iResolution.xy)*2.0-1.0;mainCubemap(tiptapPreviewFragmentColor,gl_FragCoord.xy,vec3(0.0),tiptapPreviewCubeRay(uv));}';
  }
  return compileSource(prefix, program.sources.common, body, footer, stage);
}

function soundSource(program: ShaderProgramDocument): { source: string; map: ShaderCompileSourceMap } {
  const prefix = `#version 300 es\n${COMMON_UNIFORMS}${channelUniforms(program.channels.sound ?? [])}\nuniform int tiptapPreviewSampleOffset;\nout vec4 tiptapPreviewFragmentColor;\n`;
  const body = stripVersion(program.sources.sound);
  const footer =
    '\nvoid main(){int samp=tiptapPreviewSampleOffset+int(gl_FragCoord.x);float time=float(samp)/iSampleRate;vec2 stereo=mainSound(samp,time);tiptapPreviewFragmentColor=vec4(stereo,0.0,1.0);}';
  return compileSource(prefix, program.sources.common, body, footer, 'sound');
}

function vertexSource(
  program: ShaderProgramDocument,
  channels: readonly ShaderChannel[],
): { source: string; map: ShaderCompileSourceMap } {
  const prefix = `#version 300 es\n${COMMON_UNIFORMS}${channelUniforms(channels)}\n`;
  return compileSource(prefix, program.sources.common, stripVersion(program.sources.vertex), '', 'vertex');
}

function compile(
  context: WebGL2RenderingContext,
  type: number,
  source: string,
  stage: ShaderStage,
  map: ShaderCompileSourceMap,
): WebGLShader | null {
  const shader = context.createShader(type);
  if (!shader) {
    report({ kind: 'resource', stage, message: 'The browser could not allocate a shader.' });
    return null;
  }
  context.shaderSource(shader, source);
  context.compileShader(shader);
  if (context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    return shader;
  }
  const error = mapShaderCompileError(context.getShaderInfoLog(shader) ?? 'Shader compilation failed.', map);
  context.deleteShader(shader);
  report(error);
  return null;
}

function linkPass(
  context: WebGL2RenderingContext,
  program: ShaderProgramDocument,
  stage: ShaderVisualStage,
): WebGLProgram | null {
  const vertex = vertexSource(program, program.channels[stage] ?? []);
  const fragment = fragmentSource(program, stage);
  const vertexShader = compile(context, context.VERTEX_SHADER, vertex.source, 'vertex', vertex.map);
  const fragmentShader = compile(context, context.FRAGMENT_SHADER, fragment.source, stage, fragment.map);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      context.deleteShader(vertexShader);
    }
    if (fragmentShader) {
      context.deleteShader(fragmentShader);
    }
    return null;
  }
  const result = context.createProgram();
  if (!result) {
    context.deleteShader(vertexShader);
    context.deleteShader(fragmentShader);
    report({ kind: 'resource', stage: 'link', message: 'The browser could not allocate a shader program.' });
    return null;
  }
  context.attachShader(result, vertexShader);
  context.attachShader(result, fragmentShader);
  context.linkProgram(result);
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);
  if (!context.getProgramParameter(result, context.LINK_STATUS)) {
    const error = normalizeShaderError(context.getProgramInfoLog(result) ?? 'Shader link failed.', 'link');
    context.deleteProgram(result);
    report({ ...error, stage: 'link' });
    return null;
  }
  return result;
}

function linkSound(context: WebGL2RenderingContext, program: ShaderProgramDocument): WebGLProgram | null {
  const vertex = vertexSource(program, program.channels.sound ?? []);
  const fragment = soundSource(program);
  const vertexShader = compile(context, context.VERTEX_SHADER, vertex.source, 'vertex', vertex.map);
  const fragmentShader = compile(context, context.FRAGMENT_SHADER, fragment.source, 'sound', fragment.map);
  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      context.deleteShader(vertexShader);
    }
    if (fragmentShader) {
      context.deleteShader(fragmentShader);
    }
    return null;
  }
  const result = context.createProgram();
  if (!result) {
    return null;
  }
  context.attachShader(result, vertexShader);
  context.attachShader(result, fragmentShader);
  context.linkProgram(result);
  context.deleteShader(vertexShader);
  context.deleteShader(fragmentShader);
  if (context.getProgramParameter(result, context.LINK_STATUS)) {
    return result;
  }
  report({
    ...normalizeShaderError(context.getProgramInfoLog(result) ?? 'Sound shader link failed.', 'link'),
    stage: 'link',
  });
  context.deleteProgram(result);
  return null;
}

function makeTexture(context: WebGL2RenderingContext, width: number, height: number): WebGLTexture | null {
  const texture = context.createTexture();
  if (!texture) {
    return null;
  }
  context.bindTexture(context.TEXTURE_2D, texture);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA8, width, height, 0, context.RGBA, context.UNSIGNED_BYTE, null);
  return texture;
}

function makeBlackCube(context: WebGL2RenderingContext): WebGLTexture | null {
  const texture = context.createTexture();
  if (!texture) {
    return null;
  }
  context.bindTexture(context.TEXTURE_CUBE_MAP, texture);
  const black = new Uint8Array([0, 0, 0, 255]);
  for (let face = 0; face < 6; face += 1) {
    context.texImage2D(
      context.TEXTURE_CUBE_MAP_POSITIVE_X + face,
      0,
      context.RGBA,
      1,
      1,
      0,
      context.RGBA,
      context.UNSIGNED_BYTE,
      black,
    );
  }
  return texture;
}

export function makeTarget(context: WebGL2RenderingContext, width: number, height: number): RenderTarget | null {
  const textures = [makeTexture(context, width, height), makeTexture(context, width, height)] as const;
  if (!textures[0] || !textures[1]) {
    textures.forEach((texture) => texture && context.deleteTexture(texture));
    return null;
  }
  const framebuffers = [context.createFramebuffer(), context.createFramebuffer()] as const;
  if (!framebuffers[0] || !framebuffers[1]) {
    textures.forEach((texture) => context.deleteTexture(texture));
    framebuffers.forEach((framebuffer) => framebuffer && context.deleteFramebuffer(framebuffer));
    return null;
  }
  let complete = true;
  framebuffers.forEach((framebuffer, index) => {
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.framebufferTexture2D(
      context.FRAMEBUFFER,
      context.COLOR_ATTACHMENT0,
      context.TEXTURE_2D,
      textures[index],
      0,
    );
    complete &&= context.checkFramebufferStatus(context.FRAMEBUFFER) === context.FRAMEBUFFER_COMPLETE;
  });
  if (!complete) {
    textures.forEach((texture) => context.deleteTexture(texture));
    framebuffers.forEach((framebuffer) => context.deleteFramebuffer(framebuffer));
    context.bindFramebuffer(context.FRAMEBUFFER, null);
    return null;
  }
  context.bindFramebuffer(context.FRAMEBUFFER, null);
  framebuffers.forEach((framebuffer) => {
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
  });
  context.bindFramebuffer(context.FRAMEBUFFER, null);
  return { textures: [textures[0], textures[1]], framebuffers: [framebuffers[0], framebuffers[1]], write: 0 };
}

export function makeSoundTarget(context: WebGL2RenderingContext): RenderTarget | null {
  if (!context.getExtension('EXT_color_buffer_float')) {
    return null;
  }
  const textures: WebGLTexture[] = [];
  const framebuffers: WebGLFramebuffer[] = [];
  for (let index = 0; index < 2; index += 1) {
    const texture = context.createTexture();
    const framebuffer = context.createFramebuffer();
    if (!texture || !framebuffer) {
      if (texture) {
        context.deleteTexture(texture);
      }
      if (framebuffer) {
        context.deleteFramebuffer(framebuffer);
      }
      textures.forEach((allocated) => context.deleteTexture(allocated));
      framebuffers.forEach((allocated) => context.deleteFramebuffer(allocated));
      return null;
    }
    context.bindTexture(context.TEXTURE_2D, texture);
    context.texImage2D(
      context.TEXTURE_2D,
      0,
      context.RGBA32F,
      SHADER_SOUND_CHUNK_SAMPLES,
      1,
      0,
      context.RGBA,
      context.FLOAT,
      null,
    );
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.framebufferTexture2D(context.FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, texture, 0);
    if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
      context.deleteTexture(texture);
      context.deleteFramebuffer(framebuffer);
      textures.forEach((allocated) => context.deleteTexture(allocated));
      framebuffers.forEach((allocated) => context.deleteFramebuffer(allocated));
      context.bindFramebuffer(context.FRAMEBUFFER, null);
      return null;
    }
    textures.push(texture);
    framebuffers.push(framebuffer);
  }
  return {
    textures: textures as [WebGLTexture, WebGLTexture],
    framebuffers: framebuffers as [WebGLFramebuffer, WebGLFramebuffer],
    write: 0,
  };
}

export function makeCubeTarget(context: WebGL2RenderingContext, size: number) {
  const textures: WebGLTexture[] = [];
  const framebufferSets: WebGLFramebuffer[][] = [];
  for (let buffer = 0; buffer < 2; buffer += 1) {
    const texture = context.createTexture();
    if (!texture) {
      textures.forEach((allocated) => context.deleteTexture(allocated));
      framebufferSets.flat().forEach((allocated) => context.deleteFramebuffer(allocated));
      return null;
    }
    textures.push(texture);
    context.bindTexture(context.TEXTURE_CUBE_MAP, texture);
    const framebuffers: WebGLFramebuffer[] = [];
    for (let face = 0; face < 6; face += 1) {
      context.texImage2D(
        context.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        0,
        context.RGBA8,
        size,
        size,
        0,
        context.RGBA,
        context.UNSIGNED_BYTE,
        null,
      );
      const framebuffer = context.createFramebuffer();
      if (!framebuffer) {
        textures.forEach((allocated) => context.deleteTexture(allocated));
        framebufferSets.flat().forEach((allocated) => context.deleteFramebuffer(allocated));
        framebuffers.forEach((allocated) => context.deleteFramebuffer(allocated));
        return null;
      }
      context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
      context.framebufferTexture2D(
        context.FRAMEBUFFER,
        context.COLOR_ATTACHMENT0,
        context.TEXTURE_CUBE_MAP_POSITIVE_X + face,
        texture,
        0,
      );
      if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
        textures.forEach((allocated) => context.deleteTexture(allocated));
        framebufferSets.flat().forEach((allocated) => context.deleteFramebuffer(allocated));
        framebuffers.forEach((allocated) => context.deleteFramebuffer(allocated));
        context.deleteFramebuffer(framebuffer);
        context.bindFramebuffer(context.FRAMEBUFFER, null);
        return null;
      }
      framebuffers.push(framebuffer);
    }
    framebufferSets.push(framebuffers);
    context.texParameteri(context.TEXTURE_CUBE_MAP, context.TEXTURE_MIN_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_CUBE_MAP, context.TEXTURE_MAG_FILTER, context.LINEAR);
    context.texParameteri(context.TEXTURE_CUBE_MAP, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE);
    context.texParameteri(context.TEXTURE_CUBE_MAP, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE);
  }
  context.bindFramebuffer(context.FRAMEBUFFER, null);
  framebufferSets.flat().forEach((framebuffer) => {
    context.bindFramebuffer(context.FRAMEBUFFER, framebuffer);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
  });
  context.bindFramebuffer(context.FRAMEBUFFER, null);
  return {
    textures: textures as [WebGLTexture, WebGLTexture],
    framebuffers: framebufferSets as [WebGLFramebuffer[], WebGLFramebuffer[]],
    write: 0 as 0 | 1,
  };
}

function upload2D(message: Asset2DMessage | AssetVideoMessage): void {
  if (!gl) {
    message.bitmap.close();
    return;
  }
  const previous = externalTextures.get(message.key);
  const texture = previous?.texture ?? gl.createTexture();
  if (!texture) {
    message.bitmap.close();
    return;
  }
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, message.bitmap);
  externalTextures.set(message.key, {
    texture,
    target: gl.TEXTURE_2D,
    width: message.bitmap.width,
    height: message.bitmap.height,
    time: message.type === 'assetVideo' ? message.time : 0,
  });
  message.bitmap.close();
}

function uploadCube(message: AssetCubeMessage): void {
  if (!gl || message.faces.length !== 6) {
    message.faces.forEach((face) => face.close());
    return;
  }
  const texture = gl.createTexture();
  if (!texture) {
    return;
  }
  gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
  message.faces.forEach((face, index) => {
    gl?.texImage2D(
      (gl?.TEXTURE_CUBE_MAP_POSITIVE_X ?? 0) + index,
      0,
      gl?.RGBA ?? 0,
      gl?.RGBA ?? 0,
      gl?.UNSIGNED_BYTE ?? 0,
      face,
    );
    face.close();
  });
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  externalTextures.set(message.key, {
    texture,
    target: gl.TEXTURE_CUBE_MAP,
    width: message.faces[0]?.width ?? 1,
    height: message.faces[0]?.height ?? 1,
    time: 0,
  });
}

function location(context: WebGL2RenderingContext, pass: CompiledPass, name: string): WebGLUniformLocation | null {
  return context.getUniformLocation(pass.program, name);
}

function bindChannels(context: WebGL2RenderingContext, pass: CompiledPass): void {
  const resolution = new Float32Array(12);
  const times = new Float32Array(4);
  for (let index = 0; index < 4; index += 1) {
    const channel = pass.channels[index] ?? { kind: 'none' };
    let target: number = isCube(channel) ? context.TEXTURE_CUBE_MAP : context.TEXTURE_2D;
    let texture = isCube(channel) ? blackCubeTexture : blackTexture;
    let asset: ExternalTexture | undefined;
    if (channel.kind === 'buffer') {
      const dependency = passes.find((candidate) => candidate.stage === BUFFER_STAGE[channel.buffer]);
      if (dependency?.target) {
        const self = dependency === pass;
        const textureIndex = self ? shaderFeedbackReadIndex(dependency.target.write) : dependency.target.write;
        texture = dependency.target.textures[textureIndex];
        resolution.set([canvas?.width ?? 1, canvas?.height ?? 1, 1], index * 3);
      }
    } else if (channel.kind === 'textureFile') {
      asset = externalTextures.get(shaderAssetKey(channel));
    } else if (channel.kind === 'videoFile') {
      asset = externalTextures.get(shaderAssetKey(channel));
    } else if (channel.kind === 'cubemapFiles') {
      asset = externalTextures.get(shaderAssetKey(channel));
    } else if (channel.kind === 'cubemapPass') {
      const cubePass = passes.find((candidate) => candidate.stage === 'cubemap');
      if (cubePass?.cubeTarget) {
        const read = shaderPassReadIndex(cubePass.cubeTarget.write, cubePass === pass);
        asset = {
          texture: cubePass.cubeTarget.textures[read],
          target: context.TEXTURE_CUBE_MAP,
          width: canvas?.height ?? 1,
          height: canvas?.height ?? 1,
          time: 0,
        };
      }
    } else {
      resolution.set([1, 1, 1], index * 3);
    }
    if (asset) {
      texture = asset.texture;
      target = asset.target;
      times[index] = asset.time;
      resolution.set([asset.width, asset.height, 1], index * 3);
    }
    context.activeTexture(context.TEXTURE0 + index);
    context.bindTexture(target, texture);
    if ('sampler' in channel) {
      const key = `${channel.sampler.filter}:${channel.sampler.wrap}`;
      let sampler = samplerObjects.get(key);
      if (!sampler) {
        sampler = context.createSampler() ?? undefined;
        if (sampler) {
          context.samplerParameteri(
            sampler,
            context.TEXTURE_MIN_FILTER,
            channel.sampler.filter === 'linear' ? context.LINEAR : context.NEAREST,
          );
          context.samplerParameteri(
            sampler,
            context.TEXTURE_MAG_FILTER,
            channel.sampler.filter === 'linear' ? context.LINEAR : context.NEAREST,
          );
          context.samplerParameteri(
            sampler,
            context.TEXTURE_WRAP_S,
            channel.sampler.wrap === 'repeat' ? context.REPEAT : context.CLAMP_TO_EDGE,
          );
          context.samplerParameteri(
            sampler,
            context.TEXTURE_WRAP_T,
            channel.sampler.wrap === 'repeat' ? context.REPEAT : context.CLAMP_TO_EDGE,
          );
          if (isCube(channel)) {
            context.samplerParameteri(
              sampler,
              context.TEXTURE_WRAP_R,
              channel.sampler.wrap === 'repeat' ? context.REPEAT : context.CLAMP_TO_EDGE,
            );
          }
          samplerObjects.set(key, sampler);
        }
      }
      context.bindSampler(index, sampler ?? null);
    }
    context.uniform1i(location(context, pass, `iChannel${index}`), index);
  }
  context.uniform1fv(location(context, pass, 'iChannelTime[0]'), times);
  context.uniform3fv(location(context, pass, 'iChannelResolution[0]'), resolution);
}

function render(now: number): void {
  if (!gl || !canvas || !documentProgram) {
    return;
  }
  try {
    const elapsed = Math.max(0, (now - startedAt) / 1_000);
    const delta = frame === 0 ? 0 : Math.max(0, (now - previousFrameAt) / 1_000);
    previousFrameAt = now;
    for (const pass of passes) {
      gl.useProgram(pass.program);
      if (pass.target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.target.framebuffers[pass.target.write]);
      } else if (pass.cubeTarget) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, pass.cubeTarget.framebuffers[pass.cubeTarget.write][0] ?? null);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.viewport(0, 0, pass.cubeTarget ? canvas.height : canvas.width, canvas.height);
      bindChannels(gl, pass);
      gl.uniform3f(location(gl, pass, 'iResolution'), pass.cubeTarget ? canvas.height : canvas.width, canvas.height, 1);
      gl.uniform1f(location(gl, pass, 'iTime'), elapsed);
      gl.uniform1f(location(gl, pass, 'iTimeDelta'), delta);
      gl.uniform1f(location(gl, pass, 'iFrameRate'), delta > 0 ? 1 / delta : 0);
      gl.uniform1i(location(gl, pass, 'iFrame'), frame);
      gl.uniform4f(location(gl, pass, 'iMouse'), ...mouse);
      const date = new Date();
      const seconds =
        date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds() + date.getMilliseconds() / 1000;
      gl.uniform4f(location(gl, pass, 'iDate'), date.getFullYear(), date.getMonth() + 1, date.getDate(), seconds);
      gl.uniform1f(location(gl, pass, 'iSampleRate'), 44_100);
      if (pass.cubeTarget) {
        pass.cubeTarget.framebuffers[pass.cubeTarget.write].forEach((framebuffer, face) => {
          gl?.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
          gl?.uniform1i(gl.getUniformLocation(pass.program, 'tiptapPreviewCubeFace'), face);
          gl?.drawArrays(gl.TRIANGLES, 0, 3);
        });
      } else {
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }
    passes.forEach((pass) => {
      if (pass.target) {
        pass.target.write = pass.target.write === 0 ? 1 : 0;
      }
      if (pass.cubeTarget) {
        pass.cubeTarget.write = pass.cubeTarget.write === 0 ? 1 : 0;
      }
    });
    if (soundEnabled && soundProgram && soundTarget && shaderShouldRenderSoundChunk(soundSample, 44_100, elapsed)) {
      const soundPass: CompiledPass = { stage: 'image', program: soundProgram, channels: soundChannels };
      gl.useProgram(soundProgram);
      gl.bindFramebuffer(gl.FRAMEBUFFER, soundTarget.framebuffers[0]);
      gl.viewport(0, 0, SHADER_SOUND_CHUNK_SAMPLES, 1);
      bindChannels(gl, soundPass);
      gl.uniform3f(gl.getUniformLocation(soundProgram, 'iResolution'), SHADER_SOUND_CHUNK_SAMPLES, 1, 1);
      gl.uniform1f(gl.getUniformLocation(soundProgram, 'iTime'), elapsed);
      gl.uniform1f(gl.getUniformLocation(soundProgram, 'iTimeDelta'), delta);
      gl.uniform1i(gl.getUniformLocation(soundProgram, 'iFrame'), frame);
      const soundDate = new Date();
      const soundSeconds =
        soundDate.getHours() * 3600 +
        soundDate.getMinutes() * 60 +
        soundDate.getSeconds() +
        soundDate.getMilliseconds() / 1000;
      gl.uniform4f(
        gl.getUniformLocation(soundProgram, 'iDate'),
        soundDate.getFullYear(),
        soundDate.getMonth() + 1,
        soundDate.getDate(),
        soundSeconds,
      );
      gl.uniform1i(gl.getUniformLocation(soundProgram, 'tiptapPreviewSampleOffset'), soundSample);
      gl.uniform1f(gl.getUniformLocation(soundProgram, 'iSampleRate'), 44_100);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const rgba = new Float32Array(SHADER_SOUND_CHUNK_SAMPLES * 4);
      gl.readPixels(0, 0, SHADER_SOUND_CHUNK_SAMPLES, 1, gl.RGBA, gl.FLOAT, rgba);
      const samples = new Float32Array(SHADER_SOUND_CHUNK_SAMPLES * 2);
      for (let index = 0; index < SHADER_SOUND_CHUNK_SAMPLES; index += 1) {
        samples[index * 2] = rgba[index * 4] ?? 0;
        samples[index * 2 + 1] = rgba[index * 4 + 1] ?? 0;
      }
      soundSample += SHADER_SOUND_CHUNK_SAMPLES;
      worker.postMessage({ type: 'audio', samples, sampleRate: 44_100 }, [samples.buffer]);
    }
    frame += 1;
    if (now - lastHeartbeat >= 250) {
      worker.postMessage({ type: 'heartbeat' });
      lastHeartbeat = now;
    }
    frameTimer = setTimeout(() => render(performance.now()), 16);
  } catch (error) {
    cleanup();
    report(normalizeShaderError(error, 'runtime'));
  }
}

function start(message: StartMessage): void {
  cleanup();
  canvas = message.canvas;
  documentProgram = message.program;
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    if (!gl || intentionallyLosingContext) {
      return;
    }
    report({ kind: 'resource', message: 'The WebGL2 context was lost.' });
    cleanup();
  });
  const context = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    preserveDrawingBuffer: false,
  }) as WebGL2RenderingContext | null;
  if (!context) {
    report({ kind: 'resource', message: 'WebGL2 is required to run this shader.' });
    cleanup();
    return;
  }
  gl = context;
  const targetPlan = shaderRenderTargetPlan(canvas.width, canvas.height);
  blackTexture = makeTexture(context, 1, 1);
  blackCubeTexture = makeBlackCube(context);
  if (!blackTexture || !blackCubeTexture) {
    report({ kind: 'resource', message: 'The browser could not allocate fallback channel textures.' });
    cleanup();
    return;
  }
  const ordered = shaderPassOrder(message.program);
  for (const stage of ordered) {
    const linked = linkPass(context, message.program, stage);
    if (!linked) {
      cleanup();
      return;
    }
    const cubeTarget =
      stage === 'cubemap' ? (makeCubeTarget(context, targetPlan.cubemap.size) ?? undefined) : undefined;
    const target =
      stage === 'image' || stage === 'cubemap'
        ? undefined
        : (makeTarget(context, targetPlan.buffer.width, targetPlan.buffer.height) ?? undefined);
    if (stage !== 'image' && !target && !cubeTarget) {
      report({ kind: 'resource', stage, message: 'The browser could not allocate a pass render target.' });
      cleanup();
      return;
    }
    passes.push({ stage, program: linked, channels: message.program.channels[stage] ?? [], target, cubeTarget });
  }
  if (message.program.sources.sound.trim()) {
    soundProgram = linkSound(context, message.program);
    soundTarget = makeSoundTarget(context);
    soundChannels = message.program.channels.sound ?? [];
    soundEnabled = message.audioEnabled;
    if (!soundProgram || !soundTarget) {
      report({ kind: 'resource', stage: 'sound', message: 'The browser could not allocate the sound pass.' });
      cleanup();
      return;
    }
  }
  frame = 0;
  startedAt = performance.now();
  previousFrameAt = startedAt;
  lastHeartbeat = 0;
  worker.postMessage({ type: 'ready' });
  render(startedAt);
}

function resizeTargets(width: number, height: number): void {
  if (!gl || !canvas) {
    return;
  }
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const targetPlan = shaderRenderTargetPlan(canvas.width, canvas.height);
  for (const pass of passes) {
    if (pass.target) {
      deleteTarget(gl, pass.target);
      pass.target = makeTarget(gl, targetPlan.buffer.width, targetPlan.buffer.height) ?? undefined;
    }
    if (pass.cubeTarget) {
      pass.cubeTarget.textures.forEach((texture) => gl?.deleteTexture(texture));
      pass.cubeTarget.framebuffers.flat().forEach((framebuffer) => gl?.deleteFramebuffer(framebuffer));
      pass.cubeTarget = makeCubeTarget(gl, targetPlan.cubemap.size) ?? undefined;
    }
  }
  frame = 0;
}

worker.onmessage = (event) => {
  const action = shaderWorkerMessageAction(event.data.type);
  if (action === 'start' && event.data.type === 'start') {
    start(event.data);
  } else if (action === 'pointer' && event.data.type === 'pointer') {
    const next = event.data;
    const originX = next.pressed && !pointerPressed ? next.x : Math.abs(mouse[2]);
    const originY = next.pressed && !pointerPressed ? next.y : Math.abs(mouse[3]);
    mouse = [next.x, next.y, next.pressed ? originX : -originX, next.pressed ? originY : -originY];
    pointerPressed = next.pressed;
  } else if (action === 'resize' && event.data.type === 'resize') {
    resizeTargets(event.data.width, event.data.height);
  } else if (
    (action === 'asset2d' && event.data.type === 'asset2d') ||
    (action === 'assetVideo' && event.data.type === 'assetVideo')
  ) {
    upload2D(event.data);
  } else if (action === 'assetCube' && event.data.type === 'assetCube') {
    uploadCube(event.data);
  } else if (action === 'enableAudio' && event.data.type === 'enableAudio') {
    soundEnabled = true;
  } else {
    cleanup();
    worker.postMessage({ type: 'stopped' });
  }
};
