'use client';

import { useCallback } from 'react';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import {
  SHADER_STAGE_DEFINITIONS,
  validateShaderPassGraph,
  type ShaderChannel,
  type ShaderProgramDocument,
  type ShaderSamplerOptions,
} from '@/features/editor/tiptap/shader/shader-program';
import type { ShaderAssetResolver } from '@/features/editor/tiptap/shader/shader-preview-runtime';
import { PublicExecutableBlockView } from './PublicExecutableBlockView';
import { getContainerStyle, resolveShaderMediaAsset } from './DefaultBlockView.utils';
import { normalizeP5Capabilities } from '@/features/editor/tiptap/p5/p5-capabilities';
import { getBlockPropString } from '@/lib/media/shared';
import type { Block } from '@/lib/types/page-content';

function executableLanguage(block: Block): 'glsl' | 'javascript' | 'typescript' {
  if (block.type === 'shader') {
    return 'glsl';
  }
  if (block.type === 'threeScene') {
    return block.props.language === 'javascript' ? 'javascript' : 'typescript';
  }
  return 'javascript';
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index]);
}

function shaderSampler(value: unknown): ShaderSamplerOptions | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  return exactKeys(candidate, ['filter', 'vflip', 'wrap']) &&
    (candidate.filter === 'nearest' || candidate.filter === 'linear') &&
    (candidate.wrap === 'clamp' || candidate.wrap === 'repeat') &&
    typeof candidate.vflip === 'boolean'
    ? (candidate as unknown as ShaderSamplerOptions)
    : null;
}

function shaderChannel(value: unknown): ShaderChannel | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'none' && exactKeys(candidate, ['kind'])) {
    return { kind: 'none' };
  }
  if (
    candidate.kind === 'buffer' &&
    exactKeys(candidate, ['buffer', 'kind']) &&
    ['A', 'B', 'C', 'D'].includes(String(candidate.buffer))
  ) {
    return { kind: 'buffer', buffer: candidate.buffer as 'A' | 'B' | 'C' | 'D' };
  }
  const sampler = shaderSampler(candidate.sampler);
  if (!sampler) {
    return null;
  }
  if (
    (candidate.kind === 'textureFile' || candidate.kind === 'videoFile') &&
    exactKeys(candidate, ['fileId', 'kind', 'sampler']) &&
    typeof candidate.fileId === 'string' &&
    candidate.fileId
  ) {
    return { kind: candidate.kind, fileId: candidate.fileId, sampler };
  }
  if (
    candidate.kind === 'cubemapFiles' &&
    exactKeys(candidate, ['fileIds', 'kind', 'sampler']) &&
    Array.isArray(candidate.fileIds) &&
    candidate.fileIds.length === 6 &&
    candidate.fileIds.every((fileId) => typeof fileId === 'string' && fileId)
  ) {
    return {
      kind: 'cubemapFiles',
      fileIds: candidate.fileIds as [string, string, string, string, string, string],
      sampler,
    };
  }
  if (candidate.kind === 'cubemapPass' && exactKeys(candidate, ['kind', 'sampler'])) {
    return { kind: 'cubemapPass', sampler };
  }
  return null;
}

function shaderProgramFromBlock(block: Block): ShaderProgramDocument | null {
  const stages = block.content ?? [];
  if (stages.length !== SHADER_STAGE_DEFINITIONS.length) {
    return null;
  }
  const sources = {} as ShaderProgramDocument['sources'];
  const channels: ShaderProgramDocument['channels'] = {};
  for (const [index, [stage, nodeName]] of SHADER_STAGE_DEFINITIONS.entries()) {
    const rawStage = stages[index] as unknown;
    if (!rawStage || typeof rawStage !== 'object' || Array.isArray(rawStage)) {
      return null;
    }
    const candidate = rawStage as Record<string, unknown>;
    if (candidate.type !== nodeName || !Array.isArray(candidate.content)) {
      return null;
    }
    const sourceParts: string[] = [];
    for (const rawText of candidate.content) {
      if (!rawText || typeof rawText !== 'object' || Array.isArray(rawText)) {
        return null;
      }
      const text = rawText as Record<string, unknown>;
      const styles = text.styles;
      if (
        text.type !== 'text' ||
        typeof text.text !== 'string' ||
        (styles !== undefined && (!styles || typeof styles !== 'object' || Object.keys(styles).length > 0))
      ) {
        return null;
      }
      sourceParts.push(text.text);
    }
    sources[stage] = sourceParts.join('');
    if (index >= 2) {
      const props = candidate.props;
      if (
        !props ||
        typeof props !== 'object' ||
        Array.isArray(props) ||
        !exactKeys(props as Record<string, unknown>, ['channels'])
      ) {
        return null;
      }
      const rawChannels = (props as Record<string, unknown>).channels;
      if (!Array.isArray(rawChannels) || rawChannels.length !== 4) {
        return null;
      }
      const parsed = rawChannels.map(shaderChannel);
      if (parsed.some((channel) => channel === null)) {
        return null;
      }
      channels[stage as keyof typeof channels] = parsed as ShaderChannel[];
    } else if (
      candidate.props !== undefined &&
      (!candidate.props || typeof candidate.props !== 'object' || Object.keys(candidate.props).length > 0)
    ) {
      return null;
    }
  }
  const program = { sources, channels };
  return validateShaderPassGraph(program) ? null : program;
}

export function DefaultExecutableBlockView({ block, source }: { block: Block; source: string }) {
  const mediaDelivery = useContentMediaDelivery();
  const resolveShaderAsset = useCallback<ShaderAssetResolver>(
    (fileId, kind) => resolveShaderMediaAsset(mediaDelivery, fileId, kind),
    [mediaDelivery],
  );
  const language = executableLanguage(block);
  const commonProps = {
    blockId: block.id,
    title: getBlockPropString(block.props, 'title'),
    previewHeight: Number(getBlockPropString(block.props, 'previewHeight', '360')),
    style: getContainerStyle(block),
  };
  if (block.type === 'shader') {
    const program = shaderProgramFromBlock(block);
    return program ? (
      <PublicExecutableBlockView
        {...commonProps}
        type="shader"
        language="glsl"
        program={program}
        resolveAsset={resolveShaderAsset}
      />
    ) : (
      <div data-invalid-executable-block="shader" />
    );
  }
  return (
    <PublicExecutableBlockView
      {...commonProps}
      type={block.type as 'p5Sketch' | 'threeScene'}
      source={source}
      language={language}
      {...(block.type === 'p5Sketch'
        ? {
            capabilities: normalizeP5Capabilities(block.props.capabilities),
          }
        : {})}
    />
  );
}
