import type { ShaderChannel, ShaderProgramDocument, ShaderVisualStage } from './shader-program';

const BUFFER_STAGE = { A: 'bufferA', B: 'bufferB', C: 'bufferC', D: 'bufferD' } as const;
export const SHADER_SOUND_CHUNK_SAMPLES = 1024;
export type ShaderWorkerMessageType =
  'start' | 'stop' | 'pointer' | 'resize' | 'enableAudio' | 'asset2d' | 'assetVideo' | 'assetCube';

export function shaderWorkerMessageAction(type: string): ShaderWorkerMessageType | 'stopUnknown' {
  if (
    type === 'start' ||
    type === 'stop' ||
    type === 'pointer' ||
    type === 'resize' ||
    type === 'enableAudio' ||
    type === 'asset2d' ||
    type === 'assetVideo' ||
    type === 'assetCube'
  ) {
    return type;
  }
  return 'stopUnknown';
}

export function shaderRenderTargetPlan(width: number, height: number) {
  const normalizedWidth = Math.max(1, Math.round(width));
  const normalizedHeight = Math.max(1, Math.round(height));
  return {
    buffer: { width: normalizedWidth, height: normalizedHeight, textures: 2, framebuffers: 2 },
    cubemap: { size: normalizedHeight, textures: 2, facesPerTexture: 6, framebuffers: 12 },
    sound: { width: SHADER_SOUND_CHUNK_SAMPLES, height: 1, format: 'RGBA32F' as const },
  };
}

export function shaderAssetKey(
  channel: Extract<ShaderChannel, { kind: 'textureFile' | 'videoFile' | 'cubemapFiles' }>,
): string {
  if (channel.kind === 'cubemapFiles') {
    return `cube:${channel.fileIds.join(':')}:${channel.sampler.vflip}`;
  }
  return `${channel.kind === 'textureFile' ? 'texture' : 'video'}:${channel.fileId}:${channel.sampler.vflip}`;
}

export function shaderPassOrder(program: ShaderProgramDocument): ShaderVisualStage[] {
  const order: readonly ShaderVisualStage[] = ['bufferA', 'bufferB', 'bufferC', 'bufferD', 'cubemap', 'image'];
  const result: ShaderVisualStage[] = [];
  const visited = new Set<ShaderVisualStage>();
  const visit = (stage: ShaderVisualStage) => {
    if (visited.has(stage)) {
      return;
    }
    const currentBuffer = stage.startsWith('buffer') ? stage.at(-1) : null;
    (program.channels[stage] ?? []).forEach((channel) => {
      if (channel.kind === 'buffer' && channel.buffer !== currentBuffer) {
        visit(BUFFER_STAGE[channel.buffer]);
      }
    });
    visited.add(stage);
    if (program.sources[stage].trim() || stage === 'image') {
      result.push(stage);
    }
  };
  order.forEach(visit);
  return result;
}

export function shaderFeedbackReadIndex(write: 0 | 1): 0 | 1 {
  return write === 0 ? 1 : 0;
}

export function shaderPassReadIndex(write: 0 | 1, selfFeedback: boolean): 0 | 1 {
  return selfFeedback ? shaderFeedbackReadIndex(write) : write;
}

export function shaderShouldRenderSoundChunk(
  sample: number,
  sampleRate: number,
  elapsed: number,
  horizon = 0.08,
): boolean {
  return sample / sampleRate < elapsed + horizon;
}

export const SHADER_CUBE_FACE_ORDER = ['+X', '-X', '+Y', '-Y', '+Z', '-Z'] as const;
