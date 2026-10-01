'use client';

import { useCallback } from 'react';
import {
  P5SketchProps_CapabilitiesItem,
  ShaderProps_StagesItem_ChannelsItem_Buffer,
  ShaderProps_StagesItem_ChannelsItem_Kind,
  ShaderProps_StagesItem_ChannelsItem_SamplerValue_Filter,
  ShaderProps_StagesItem_ChannelsItem_SamplerValue_Wrap,
  ThreeSceneProps_Language,
  type ShaderProps_StagesItem_ChannelsItem,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { useContentMediaDelivery } from '@/features/media/ContentMediaDeliveryContext';
import { P5_CAPABILITIES, type P5Capability } from '@/features/editor/tiptap/p5/p5-capabilities';
import {
  SHADER_STAGE_DEFINITIONS,
  validateShaderPassGraph,
  type ShaderChannel,
  type ShaderProgramDocument,
  type ShaderSamplerOptions,
} from '@/features/editor/tiptap/shader/shader-program';
import type { ShaderAssetResolver } from '@/features/editor/tiptap/shader/shader-preview-runtime';
import { PublicExecutableBlockView } from './PublicExecutableBlockView';
import { containerStyle } from './GeneratedRichTextViewUtils';

function p5Capabilities(values: readonly P5SketchProps_CapabilitiesItem[]): P5Capability[] {
  return values.flatMap((value) => {
    const index = value - 1;
    return index >= 0 && index < P5_CAPABILITIES.length ? [P5_CAPABILITIES[index]!] : [];
  });
}

function activeAttachmentId(channel: ShaderProps_StagesItem_ChannelsItem): string | null {
  return channel.file?.state.case === 'activeFileId' ? channel.file.state.value : null;
}

function shaderSampler(channel: ShaderProps_StagesItem_ChannelsItem): ShaderSamplerOptions {
  return {
    filter:
      channel.sampler?.filter === ShaderProps_StagesItem_ChannelsItem_SamplerValue_Filter.LINEAR ? 'linear' : 'nearest',
    wrap: channel.sampler?.wrap === ShaderProps_StagesItem_ChannelsItem_SamplerValue_Wrap.REPEAT ? 'repeat' : 'clamp',
    vflip: channel.sampler?.vflip === true,
  };
}

function shaderChannel(channel: ShaderProps_StagesItem_ChannelsItem): ShaderChannel | null {
  const sampler = shaderSampler(channel);
  switch (channel.kind) {
    case ShaderProps_StagesItem_ChannelsItem_Kind.NONE:
      return { kind: 'none' };
    case ShaderProps_StagesItem_ChannelsItem_Kind.BUFFER: {
      const buffer =
        channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.A
          ? 'A'
          : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.B
            ? 'B'
            : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.C
              ? 'C'
              : channel.buffer === ShaderProps_StagesItem_ChannelsItem_Buffer.D
                ? 'D'
                : null;
      return buffer ? { kind: 'buffer', buffer } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.TEXTURE_FILE: {
      const fileId = activeAttachmentId(channel);
      return fileId ? { kind: 'textureFile', fileId, sampler } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.VIDEO_FILE: {
      const fileId = activeAttachmentId(channel);
      return fileId ? { kind: 'videoFile', fileId, sampler } : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.CUBEMAP_FILES: {
      const fileIds = channel.faces.map((face) => (face.state.case === 'activeFileId' ? face.state.value : null));
      return fileIds.length === 6 && fileIds.every((id): id is string => id !== null)
        ? { kind: 'cubemapFiles', fileIds: fileIds as [string, string, string, string, string, string], sampler }
        : null;
    }
    case ShaderProps_StagesItem_ChannelsItem_Kind.CUBEMAP_PASS:
      return { kind: 'cubemapPass', sampler };
    case ShaderProps_StagesItem_ChannelsItem_Kind.UNSPECIFIED:
      return null;
  }
}

function shaderProgram(block: Extract<LocalizedRichTextBlock, { kind: 'shader' }>): ShaderProgramDocument | null {
  const stages = block.base.props?.stages ?? [];
  if (stages.length !== SHADER_STAGE_DEFINITIONS.length) {
    return null;
  }
  const sources = {} as ShaderProgramDocument['sources'];
  const channels: ShaderProgramDocument['channels'] = {};
  for (const [index, [stage]] of SHADER_STAGE_DEFINITIONS.entries()) {
    const value = stages[index];
    if (!value || value.kind !== index + 1) {
      return null;
    }
    sources[stage] = value.source;
    if (index >= 2) {
      const parsed = value.channels.map(shaderChannel);
      if (parsed.length !== 4 || parsed.some((channel) => channel === null)) {
        return null;
      }
      channels[stage as keyof typeof channels] = parsed as ShaderChannel[];
    }
  }
  const program = { sources, channels };
  return validateShaderPassGraph(program) ? null : program;
}

export function GeneratedExecutableBlockView({
  block,
}: {
  block: Extract<LocalizedRichTextBlock, { kind: 'p5-sketch' | 'three-scene' | 'shader' }>;
}) {
  const mediaDelivery = useContentMediaDelivery();
  const resolveAsset = useCallback<ShaderAssetResolver>(
    async (fileId, kind) => {
      if (!mediaDelivery) {
        throw new Error('Shader media delivery is unavailable.');
      }
      const url = await mediaDelivery.resolveAsset(fileId, kind);
      return { fileId, kind, url };
    },
    [mediaDelivery],
  );
  const common = {
    blockId: block.id,
    title: block.locale.props?.title ?? '',
    previewHeight: block.base.props?.previewHeight ?? 360,
    style: containerStyle(block.base.props?.previewWidth, block.base.props?.textAlignment),
  };
  if (block.kind === 'shader') {
    const program = shaderProgram(block);
    return program ? (
      <PublicExecutableBlockView
        {...common}
        type="shader"
        language="glsl"
        program={program}
        resolveAsset={resolveAsset}
      />
    ) : (
      <div data-invalid-executable-block="shader" />
    );
  }
  if (block.kind === 'three-scene') {
    return (
      <PublicExecutableBlockView
        {...common}
        type="threeScene"
        source={block.base.props?.source ?? ''}
        language={block.base.props?.language === ThreeSceneProps_Language.JAVASCRIPT ? 'javascript' : 'typescript'}
      />
    );
  }
  return (
    <PublicExecutableBlockView
      {...common}
      type="p5Sketch"
      source={block.base.props?.source ?? ''}
      language="javascript"
      capabilities={p5Capabilities(block.base.props?.capabilities ?? [])}
    />
  );
}
