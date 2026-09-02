import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { DEFAULT_SHADER_FRAGMENT_SOURCE, DEFAULT_SHADER_VERTEX_SOURCE } from './shader-source';

export const SHADER_STAGE_DEFINITIONS = [
  ['common', 'shaderCommon', 'common.glsl'],
  ['vertex', 'shaderVertex', 'vert.glsl'],
  ['bufferA', 'shaderBufferA', 'buffer-a.glsl'],
  ['bufferB', 'shaderBufferB', 'buffer-b.glsl'],
  ['bufferC', 'shaderBufferC', 'buffer-c.glsl'],
  ['bufferD', 'shaderBufferD', 'buffer-d.glsl'],
  ['cubemap', 'shaderCubemap', 'cubemap.glsl'],
  ['sound', 'shaderSound', 'sound.glsl'],
  ['image', 'shaderImage', 'frag.glsl'],
] as const;

export type ShaderStage = (typeof SHADER_STAGE_DEFINITIONS)[number][0];
export type ShaderBufferName = 'A' | 'B' | 'C' | 'D';
export type ShaderChannelStage = 'bufferA' | 'bufferB' | 'bufferC' | 'bufferD' | 'cubemap' | 'sound' | 'image';
export type ShaderVisualStage = Exclude<ShaderChannelStage, 'sound'>;

export interface ShaderSamplerOptions {
  filter: 'nearest' | 'linear';
  wrap: 'clamp' | 'repeat';
  vflip: boolean;
}

export type ShaderChannel =
  | { kind: 'none' }
  | { kind: 'buffer'; buffer: ShaderBufferName }
  | { kind: 'textureFile'; fileId: string; sampler: ShaderSamplerOptions }
  | { kind: 'videoFile'; fileId: string; sampler: ShaderSamplerOptions }
  | { kind: 'cubemapFiles'; fileIds: [string, string, string, string, string, string]; sampler: ShaderSamplerOptions }
  | { kind: 'cubemapPass'; sampler: ShaderSamplerOptions };

export const EMPTY_SHADER_CHANNELS: readonly ShaderChannel[] = Object.freeze([
  { kind: 'none' },
  { kind: 'none' },
  { kind: 'none' },
  { kind: 'none' },
]);

export interface ShaderProgramDocument {
  sources: Record<ShaderStage, string>;
  channels: Partial<Record<ShaderChannelStage, readonly ShaderChannel[]>>;
}

export const DEFAULT_SHADER_PROGRAM: ShaderProgramDocument = {
  sources: {
    common: '',
    vertex: DEFAULT_SHADER_VERTEX_SOURCE,
    bufferA: '',
    bufferB: '',
    bufferC: '',
    bufferD: '',
    cubemap: '',
    sound: '',
    image: DEFAULT_SHADER_FRAGMENT_SOURCE,
  },
  channels: {},
};

export function shaderProgramKey(program: ShaderProgramDocument): string {
  return JSON.stringify({ sources: program.sources, channels: program.channels });
}

export function normalizeShaderChannels(value: unknown): readonly ShaderChannel[] {
  if (!Array.isArray(value)) {
    return EMPTY_SHADER_CHANNELS;
  }
  return [0, 1, 2, 3].map((index) => normalizeChannel(value[index]));
}

function sampler(value: unknown): ShaderSamplerOptions {
  const candidate = value && typeof value === 'object' ? (value as Partial<ShaderSamplerOptions>) : {};
  return {
    filter: candidate.filter === 'linear' ? 'linear' : 'nearest',
    wrap: candidate.wrap === 'repeat' ? 'repeat' : 'clamp',
    vflip: candidate.vflip === true,
  };
}

function normalizeChannel(value: unknown): ShaderChannel {
  if (!value || typeof value !== 'object') {
    return { kind: 'none' };
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'buffer' && ['A', 'B', 'C', 'D'].includes(String(candidate.buffer))) {
    return { kind: 'buffer', buffer: candidate.buffer as ShaderBufferName };
  }
  if (
    (candidate.kind === 'textureFile' || candidate.kind === 'videoFile') &&
    typeof candidate.fileId === 'string' &&
    candidate.fileId
  ) {
    return { kind: candidate.kind, fileId: candidate.fileId, sampler: sampler(candidate.sampler) };
  }
  if (
    candidate.kind === 'cubemapFiles' &&
    Array.isArray(candidate.fileIds) &&
    candidate.fileIds.length === 6 &&
    candidate.fileIds.every((id) => typeof id === 'string' && id)
  ) {
    return {
      kind: 'cubemapFiles',
      fileIds: candidate.fileIds as [string, string, string, string, string, string],
      sampler: sampler(candidate.sampler),
    };
  }
  if (candidate.kind === 'cubemapPass') {
    return { kind: candidate.kind, sampler: sampler(candidate.sampler) };
  }
  return { kind: 'none' };
}

export function shaderProgramDocument(node: ProseMirrorNode): ShaderProgramDocument {
  const sources = { ...DEFAULT_SHADER_PROGRAM.sources };
  const channels: ShaderProgramDocument['channels'] = {};
  SHADER_STAGE_DEFINITIONS.forEach(([stage, nodeName], index) => {
    const child = node.childCount > index ? node.child(index) : null;
    if (!child || child.type.name !== nodeName) {
      return;
    }
    sources[stage] = child.textContent;
    if (
      stage === 'bufferA' ||
      stage === 'bufferB' ||
      stage === 'bufferC' ||
      stage === 'bufferD' ||
      stage === 'cubemap' ||
      stage === 'sound' ||
      stage === 'image'
    ) {
      channels[stage] = normalizeShaderChannels(child.attrs.channels);
    }
  });
  return { sources, channels };
}

export function validateShaderPassGraph(program: ShaderProgramDocument): string | null {
  const buffers = ['A', 'B', 'C', 'D'] as const;
  const edges = new Map<ShaderBufferName, ShaderBufferName[]>();
  buffers.forEach((buffer) => {
    const stage = `buffer${buffer}` as ShaderVisualStage;
    const dependencies = (program.channels[stage] ?? [])
      .filter((channel): channel is Extract<ShaderChannel, { kind: 'buffer' }> => channel.kind === 'buffer')
      .map((channel) => channel.buffer)
      .filter((dependency) => dependency !== buffer);
    edges.set(buffer, dependencies);
  });
  const visiting = new Set<ShaderBufferName>();
  const visited = new Set<ShaderBufferName>();
  const visit = (buffer: ShaderBufferName): boolean => {
    if (visiting.has(buffer)) {
      return false;
    }
    if (visited.has(buffer)) {
      return true;
    }
    visiting.add(buffer);
    for (const dependency of edges.get(buffer) ?? []) {
      if (!visit(dependency)) {
        return false;
      }
    }
    visiting.delete(buffer);
    visited.add(buffer);
    return true;
  };
  return buffers.every(visit) ? null : 'Shader buffer channels contain a mutual dependency cycle.';
}
