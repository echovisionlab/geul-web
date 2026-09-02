// @vitest-environment node

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const RUNTIME_LABEL_KEYS = [
  'title',
  'edit',
  'source',
  'preview',
  'run',
  'stop',
  'restart',
  'copy',
  'sourceInput',
  'copied',
  'running',
  'stopped',
  'error',
  'resizeLeft',
  'resizeRight',
  'availableInputs',
  'apiHint',
  'sharedStage',
] as const;

interface ShaderMessageDocument {
  editorCommon: {
    editor: {
      embeds: { shader: string };
      resize: { shader: string };
      runtimeLabels: { shader: Record<string, string> };
      slashMenu: {
        groups: { embeds: string };
        items: { shader: { aliases: string; group: string; subtext: string; title: string } };
      };
    };
  };
}

function messageLeaves(value: unknown, prefix = ''): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) => messageLeaves(child, prefix ? `${prefix}.${key}` : key));
}

describe('Shader message parity', () => {
  it('keeps the complete Shader contract and full message shape in all 20 locales', () => {
    const messageDirectory = resolve(process.cwd(), 'messages');
    const files = readdirSync(messageDirectory)
      .filter((file) => file.endsWith('.json'))
      .sort();
    const messages = files.map((file) => ({
      file,
      value: JSON.parse(readFileSync(resolve(messageDirectory, file), 'utf8')) as ShaderMessageDocument,
    }));
    const referenceLeaves = messageLeaves(messages.find(({ file }) => file === 'en.json')?.value).sort();

    expect(files).toHaveLength(20);
    for (const { file, value } of messages) {
      expect(messageLeaves(value).sort(), file).toEqual(referenceLeaves);
      expect(Object.keys(value.editorCommon.editor.runtimeLabels.shader).sort(), file).toEqual(
        [...RUNTIME_LABEL_KEYS].sort(),
      );
      expect(value.editorCommon.editor.slashMenu.items.shader, file).toMatchObject({
        title: expect.any(String),
        subtext: expect.any(String),
        aliases: expect.stringContaining('glsl'),
        group: value.editorCommon.editor.slashMenu.groups.embeds,
      });
      expect(value.editorCommon.editor.resize.shader, file).toEqual(expect.any(String));
      expect(value.editorCommon.editor.embeds.shader, file).toEqual(expect.any(String));
    }
  });
});
