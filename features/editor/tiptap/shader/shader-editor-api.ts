import type { Monaco, OnMount } from '@monaco-editor/react';
import type { ShaderChannel, ShaderStage } from './shader-program';

export interface ShaderApiLabels {
  availableInputs: string;
  apiHint: string;
  sharedStage: string;
}

export interface ShaderApiItem {
  name: string;
  type: string;
  notation: string;
}

export const SHADER_AVAILABLE_INPUTS: readonly ShaderApiItem[] = [
  { name: 'iResolution', type: 'vec3', notation: '(widthPx, heightPx, 1)' },
  { name: 'iTime', type: 'float', notation: 's since Run' },
  { name: 'iTimeDelta', type: 'float', notation: 'Δs' },
  { name: 'iFrameRate', type: 'float', notation: 'fps' },
  { name: 'iFrame', type: 'int', notation: '0…' },
  { name: 'iChannelTime', type: 'float[4]', notation: 's' },
  { name: 'iChannelResolution', type: 'vec3[4]', notation: 'px' },
  { name: 'iMouse', type: 'vec4', notation: '(x, y, ±clickX, ±clickY)' },
  { name: 'iDate', type: 'vec4', notation: '(YYYY, M, D, secondsSinceMidnight)' },
  { name: 'iSampleRate', type: 'float', notation: 'Hz · 44100' },
] as const;

export function shaderStageEntryPoint(stage: ShaderStage): string | null {
  if (stage === 'common') {
    return null;
  }
  if (stage === 'vertex') {
    return 'void main()';
  }
  if (stage === 'cubemap') {
    return 'void mainCubemap(out vec4 fragColor, in vec2 fragCoord, in vec3 rayOrigin, in vec3 rayDirection)';
  }
  if (stage === 'sound') {
    return 'vec2 mainSound(int sampleIndex, float time)';
  }
  return 'void mainImage(out vec4 fragColor, in vec2 fragCoord)';
}

export function shaderStageEntryPointName(stage: ShaderStage): string | null {
  if (stage === 'common') {
    return null;
  }
  if (stage === 'vertex') {
    return 'main';
  }
  if (stage === 'cubemap') {
    return 'mainCubemap';
  }
  if (stage === 'sound') {
    return 'mainSound';
  }
  return 'mainImage';
}

export function shaderChannelApiItems(channels: readonly ShaderChannel[]): readonly ShaderApiItem[] {
  return [0, 1, 2, 3].map((index) => {
    const channel = channels[index];
    const cube = channel?.kind === 'cubemapFiles' || channel?.kind === 'cubemapPass';
    return {
      name: `iChannel${index}`,
      type: cube ? 'samplerCube' : 'sampler2D',
      notation: channel?.kind === 'none' || !channel ? '∅' : channel.kind,
    };
  });
}

const configuredMonacoInstances = new WeakSet<object>();

function isShaderModel(path: string): boolean {
  return path.includes('/geul/shader/') || path.includes('/geul/public/shader/');
}

function stageForModelPath(path: string): ShaderStage | null {
  if (path.endsWith('/common.glsl')) {
    return 'common';
  }
  if (path.endsWith('/vert.glsl')) {
    return 'vertex';
  }
  if (path.endsWith('/buffer-a.glsl')) {
    return 'bufferA';
  }
  if (path.endsWith('/buffer-b.glsl')) {
    return 'bufferB';
  }
  if (path.endsWith('/buffer-c.glsl')) {
    return 'bufferC';
  }
  if (path.endsWith('/buffer-d.glsl')) {
    return 'bufferD';
  }
  if (path.endsWith('/cubemap.glsl')) {
    return 'cubemap';
  }
  if (path.endsWith('/sound.glsl')) {
    return 'sound';
  }
  if (path.endsWith('/frag.glsl')) {
    return 'image';
  }
  return null;
}

function entryPointCompletion(monaco: Monaco, stage: ShaderStage) {
  const signature = shaderStageEntryPoint(stage);
  if (!signature) {
    return null;
  }
  const name = shaderStageEntryPointName(stage);
  if (!name) {
    return null;
  }
  return {
    label: name,
    kind: monaco.languages.CompletionItemKind.Function,
    detail: signature,
    documentation: { value: `\`${signature}\`` },
    insertText: `${signature} {\n\t\${0}\n}`,
    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
  };
}

/** Adds Shader input completion and hover only to Shader block models. */
export const installShaderInputMonacoApi: OnMount = (_editor, monaco) => {
  if (configuredMonacoInstances.has(monaco)) {
    return;
  }
  configuredMonacoInstances.add(monaco);

  monaco.languages.registerCompletionItemProvider('glsl', {
    provideCompletionItems(model, position) {
      if (!isShaderModel(model.uri.path)) {
        return { suggestions: [] };
      }
      const word = model.getWordUntilPosition(position);
      const range = new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
      const stage = stageForModelPath(model.uri.path);
      const entryPoint = stage ? entryPointCompletion(monaco, stage) : null;
      const suggestions = SHADER_AVAILABLE_INPUTS.map((item) => ({
        label: item.name,
        kind: monaco.languages.CompletionItemKind.Variable,
        detail: `${item.type} · ${item.notation}`,
        documentation: { value: `\`${item.name}\` — \`${item.type}\` · ${item.notation}` },
        insertText: item.name,
        range,
      }));
      [0, 1, 2, 3].forEach((index) => {
        suggestions.push({
          label: `iChannel${index}`,
          kind: monaco.languages.CompletionItemKind.Variable,
          detail: 'sampler2D | samplerCube',
          documentation: { value: `\`iChannel${index}\` — \`sampler2D | samplerCube\`` },
          insertText: `iChannel${index}`,
          range,
        });
      });
      return { suggestions: entryPoint ? [{ ...entryPoint, range }, ...suggestions] : suggestions };
    },
  });

  monaco.languages.registerHoverProvider('glsl', {
    provideHover(model, position) {
      if (!isShaderModel(model.uri.path)) {
        return null;
      }
      const word = model.getWordAtPosition(position)?.word;
      if (!word) {
        return null;
      }
      const input = SHADER_AVAILABLE_INPUTS.find((item) => item.name === word);
      if (input) {
        return { contents: [{ value: `**${input.name}** · \`${input.type}\`` }, { value: input.notation }] };
      }
      if (/^iChannel[0-3]$/u.test(word)) {
        return { contents: [{ value: `**${word}** · \`sampler2D | samplerCube\`` }] };
      }
      const stage = stageForModelPath(model.uri.path);
      const signature = stage ? shaderStageEntryPoint(stage) : null;
      const entryPointName = stage ? shaderStageEntryPointName(stage) : null;
      if (signature && word === entryPointName) {
        return { contents: [{ value: `\`${signature}\`` }] };
      }
      return null;
    },
  });
};
