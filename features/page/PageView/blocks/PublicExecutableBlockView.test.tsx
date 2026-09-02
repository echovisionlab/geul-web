// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MantineProvider } from '@mantine/core';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import type { ShaderProgramDocument } from '@/features/editor/tiptap/shader/shader-program';
import type { ShaderAssetResolver } from '@/features/editor/tiptap/shader/shader-preview-runtime';
import type { P5Capability } from '@/features/editor/tiptap/p5/p5-capabilities';
import {
  PublicExecutableBlockView,
  type PublicExecutableBlockType,
  type PublicExecutableRuntimeFactories,
} from './PublicExecutableBlockView';

vi.mock('@/features/editor/tiptap/code-editor', () => ({
  MonacoSourceEditor: ({
    ariaLabel,
    language,
    onChange,
    value,
  }: {
    ariaLabel: string;
    language: string;
    onChange?: (value: string) => void;
    value: string;
  }) => (
    <textarea
      aria-label={ariaLabel}
      data-language={language}
      value={value}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  ),
}));

vi.mock('@/features/editor/tiptap/code/PrintCodeSource', () => ({
  PrintCodeSource: ({ language, source }: { language: string; source: string }) => (
    <pre data-print-code-source="" data-language={language}>
      <code>{source}</code>
    </pre>
  ),
}));

function createRuntime() {
  return {
    run: vi.fn(),
    stop: vi.fn(),
    dispose: vi.fn(),
    pointer: vi.fn(),
    resize: vi.fn(),
    enableAudio: vi.fn(),
  };
}

function createFactories() {
  const runtimes = {
    p5Sketch: createRuntime(),
    threeScene: createRuntime(),
    shader: createRuntime(),
  };
  const factories = {
    p5Sketch: vi.fn(() => runtimes.p5Sketch),
    threeScene: vi.fn(() => runtimes.threeScene),
    shader: vi.fn(() => runtimes.shader),
  } as unknown as PublicExecutableRuntimeFactories;
  return { factories, runtimes };
}

function shaderProgram(image = 'original source'): ShaderProgramDocument {
  return {
    sources: {
      common: '',
      vertex: 'vertex source',
      bufferA: '',
      bufferB: '',
      bufferC: '',
      bufferD: '',
      cubemap: '',
      sound: '',
      image,
    },
    channels: {
      bufferA: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      bufferB: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      bufferC: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      bufferD: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      cubemap: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      sound: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      image: [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
    },
  };
}

async function mountPublicExecutable({
  type,
  factories,
  title,
  source = 'original source',
  resolveAsset,
  program,
  capabilities,
}: {
  type: PublicExecutableBlockType;
  factories: PublicExecutableRuntimeFactories;
  title?: string;
  source?: string;
  resolveAsset?: ShaderAssetResolver;
  program?: ShaderProgramDocument;
  capabilities?: readonly P5Capability[];
}) {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  const language = type === 'shader' ? 'glsl' : type === 'threeScene' ? 'typescript' : 'javascript';
  await act(async () => {
    root.render(
      <NextIntlClientProvider locale="en" timeZone="UTC" messages={enMessages}>
        <MantineProvider>
          {type === 'shader' ? (
            <PublicExecutableBlockView
              blockId={`${type}-1`}
              title={title}
              type="shader"
              program={program ?? shaderProgram(source)}
              language="glsl"
              previewHeight={360}
              runtimeFactories={factories}
              resolveAsset={resolveAsset}
              style={{ width: '48%' }}
            />
          ) : (
            <PublicExecutableBlockView
              blockId={`${type}-1`}
              title={title}
              type={type}
              source={source}
              language={language}
              previewHeight={360}
              runtimeFactories={factories}
              {...(type === 'p5Sketch' ? { capabilities } : {})}
              style={{ width: '48%' }}
            />
          )}
        </MantineProvider>
      </NextIntlClientProvider>,
    );
    await Promise.resolve();
  });
  return {
    host,
    async destroy() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.getAttribute('aria-label') === text || candidate.textContent?.startsWith(text),
  );
  if (!button) {
    throw new Error(`Missing button: ${text}`);
  }
  return button;
}

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

describe('PublicExecutableBlockView', () => {
  it('uses one shared outer box without figure or body padding', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'features/page/PageView/blocks/PublicExecutableBlockView.module.css'),
      'utf8',
    );
    const rootRule = /\.root\s*\{([^}]*)\}/u.exec(css)?.[1];

    expect(rootRule).toBeDefined();
    expect(rootRule).toMatch(/border:\s*1px solid/u);
    expect(rootRule).toMatch(/padding:\s*0/u);
    expect(rootRule).toMatch(/margin:\s*0/u);
  });

  it('switches the executable body from flex to fragmentable block flow for print', () => {
    const css = readFileSync(
      resolve(process.cwd(), 'features/page/PageView/blocks/PublicExecutableBlockView.module.css'),
      'utf8',
    );
    const printRules = /@media print\s*\{([\s\S]*)\}\s*\.canvas/u.exec(css)?.[1];

    expect(printRules).toMatch(/\.header\s*\{[^}]*break-after:\s*avoid;/su);
    expect(printRules).toMatch(/\.body\s*\{[^}]*display:\s*block;/su);
  });

  it('shows only the localized title in the header and moves source disclosure into the runtime row', async () => {
    const { factories } = createFactories();
    const mounted = await mountPublicExecutable({ type: 'threeScene', factories, title: 'Localized scene' });

    expect(mounted.host.querySelector('figcaption')?.textContent).toBe('Localized scene');
    const titleRow = mounted.host.querySelector('[data-executable-title]');
    expect(titleRow?.parentElement?.children).toHaveLength(1);
    expect(mounted.host.querySelector('[data-executable-mode-controls]')).toBeNull();
    expect(buttonByText(mounted.host, 'Source')).toBeTruthy();

    await mounted.destroy();
  });

  it.each(['p5Sketch', 'threeScene', 'shader'] as const)(
    'orders the public %s temporary editor after preview and runtime controls without remounting on scroll',
    async (type) => {
      const { factories } = createFactories();
      const mounted = await mountPublicExecutable({ type, factories });

      await act(async () => buttonByText(mounted.host, 'Source').click());
      const preview = mounted.host.querySelector<HTMLElement>(`[data-runtime-surface="${type}"]`);
      const controls = mounted.host.querySelector<HTMLElement>(`[data-runtime-controls="${type}"]`);
      const editor = mounted.host.querySelector<HTMLElement>('textarea');
      if (!preview || !controls || !editor) {
        throw new Error('Public temporary editor layout did not mount');
      }
      expect(preview.compareDocumentPosition(controls) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(controls.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect([...controls.querySelectorAll('button')].map((button) => button.getAttribute('aria-label'))).toEqual([
        'Stop',
        'Restart',
        'Source',
        'Reset to original',
        'Copy',
        'Apply',
      ]);
      expect(
        [...controls.querySelectorAll('button')].every((button) => button.getAttribute('data-emphasis') === 'low'),
      ).toBe(true);
      expect(mounted.host.querySelector('figure')?.getAttribute('data-preview-height')).toBe('360');
      expect(mounted.host.querySelector('figure')?.getAttribute('style')).toContain('width: 48%');

      await act(async () => {
        mounted.host.scrollTop = 120;
        mounted.host.dispatchEvent(new Event('scroll', { bubbles: true }));
      });
      expect(mounted.host.querySelector(`[data-runtime-surface="${type}"]`)).toBe(preview);

      await mounted.destroy();
    },
  );

  it('waits for an explicit public Run before a device-capable p5 sketch requests access', async () => {
    const { factories, runtimes } = createFactories();
    const capabilities = ['camera', 'microphone'] as const;
    const mounted = await mountPublicExecutable({ type: 'p5Sketch', factories, capabilities });

    expect(runtimes.p5Sketch.run).not.toHaveBeenCalled();
    expect(buttonByText(mounted.host, 'Run')).toBeTruthy();
    expect(mounted.host.querySelector('[data-p5-capability-trigger]')?.getAttribute('aria-label')).toBe(
      'Inputs and devices: Camera, Microphone',
    );

    await act(async () => buttonByText(mounted.host, 'Run').click());

    expect(runtimes.p5Sketch.run).toHaveBeenCalledWith('original source', { capabilities });
    await mounted.destroy();
  });

  it.each([
    ['p5Sketch', 'javascript', ['original source']],
    ['threeScene', 'typescript', ['original source']],
    ['shader', 'glsl', ['vertex source', 'original source']],
  ] as const)('uses highlighted source instead of the %s runtime for print', async (type, language, sources) => {
    const { factories } = createFactories();
    const mounted = await mountPublicExecutable({ type, factories, title: 'Printable source' });
    const printSource = mounted.host.querySelector(`[data-executable-print-source="${type}"]`);

    expect(printSource).not.toBeNull();
    expect(printSource?.querySelector('img')).toBeNull();
    expect([...printSource!.querySelectorAll('[data-print-code-source]')]).toHaveLength(sources.length);
    expect([...printSource!.querySelectorAll('[data-print-code-source]')].map((source) => source.textContent)).toEqual(
      sources,
    );
    expect(
      [...printSource!.querySelectorAll('[data-print-code-source]')].every(
        (source) => source.getAttribute('data-language') === language,
      ),
    ).toBe(true);

    await mounted.destroy();
  });

  it.each(['p5Sketch', 'threeScene', 'shader'] as const)(
    'auto-runs and disposes the isolated %s runtime',
    async (type) => {
      const { factories, runtimes } = createFactories();
      const mounted = await mountPublicExecutable({ type, factories });

      expect(factories[type]).toHaveBeenCalledOnce();
      expect(runtimes[type].run).toHaveBeenCalledWith(type === 'shader' ? shaderProgram() : 'original source');
      expect(mounted.host.querySelector(`[data-runtime-surface="${type}"]`)).not.toBeNull();

      await mounted.destroy();
      expect(runtimes[type].dispose).toHaveBeenCalled();
    },
  );

  it.each([
    ['p5Sketch', 'p5.js sketch — Source'],
    ['shader', 'GLSL shader — Source — frag.glsl'],
  ] as const)(
    'keeps %s temporary edits in component memory, reruns them, and resets to the original source',
    async (type, sourceLabel) => {
      vi.useFakeTimers();
      const { factories, runtimes } = createFactories();
      const mounted = await mountPublicExecutable({ type, factories });

      await act(async () => buttonByText(mounted.host, 'Source').click());
      if (type === 'shader') {
        expect(mounted.host.querySelectorAll('textarea')).toHaveLength(1);
        expect(mounted.host.querySelectorAll('[role="tab"]')).toHaveLength(9);
      }
      const input = [...mounted.host.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
        (candidate) => candidate.getAttribute('aria-label') === sourceLabel,
      );
      expect(input?.value).toBe('original source');

      await act(async () => {
        if (!input) {
          throw new Error('Temporary source editor did not mount');
        }
        const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
        setter?.call(input, 'temporary source');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      expect(runtimes[type].run).not.toHaveBeenLastCalledWith(
        type === 'shader' ? shaderProgram('temporary source') : 'temporary source',
      );
      await act(async () => buttonByText(mounted.host, 'Apply').click());
      expect(runtimes[type].run).toHaveBeenLastCalledWith(
        type === 'shader' ? shaderProgram('temporary source') : 'temporary source',
      );

      expect(input?.value).toBe('temporary source');

      await act(async () => buttonByText(mounted.host, 'Reset to original').click());
      expect(input?.value).toBe('original source');

      await mounted.destroy();
    },
  );

  it('surfaces a shader runtime failure and changes the public control back to Run', async () => {
    const { factories, runtimes } = createFactories();
    let reportError: ((error: { kind: 'runtime'; message: string }) => void) | undefined;
    factories.shader = vi.fn((_canvas, events) => {
      reportError = events.onError;
      return runtimes.shader;
    });
    const mounted = await mountPublicExecutable({ type: 'shader', factories });

    await act(async () => reportError?.({ kind: 'runtime', message: 'Shader failed safely' }));

    expect(mounted.host.textContent).toContain('Shader failed safely');
    expect(buttonByText(mounted.host, 'Run')).toBeTruthy();
    expect(runtimes.shader.dispose).toHaveBeenCalled();

    await mounted.destroy();
  });

  it('keeps Shader sound disabled until the public Audio control is activated', async () => {
    const { factories, runtimes } = createFactories();
    const program = shaderProgram();
    program.sources.sound = 'vec2 mainSound(float time) { return vec2(0.0); }';
    const resolveAsset = vi.fn<ShaderAssetResolver>();
    const mounted = await mountPublicExecutable({ type: 'shader', factories, resolveAsset, program });

    expect(runtimes.shader.run).toHaveBeenLastCalledWith(program, { resolveAsset });
    await act(async () => buttonByText(mounted.host, 'Audio').click());
    expect(runtimes.shader.enableAudio).toHaveBeenCalledOnce();
    expect(runtimes.shader.run).toHaveBeenLastCalledWith(program, { resolveAsset });

    await mounted.destroy();
  });

  it('automatically reruns corrected temporary Shader source after a runtime failure', async () => {
    vi.useFakeTimers();
    const { factories, runtimes } = createFactories();
    let reportError: ((error: { kind: 'compile'; message: string }) => void) | undefined;
    factories.shader = vi.fn((_canvas, events) => {
      reportError = events.onError;
      return runtimes.shader;
    });
    const mounted = await mountPublicExecutable({ type: 'shader', factories, source: 'invalid source' });

    await act(async () => buttonByText(mounted.host, 'Source').click());
    await act(async () => reportError?.({ kind: 'compile', message: 'Compile failed' }));
    expect(buttonByText(mounted.host, 'Run')).toBeTruthy();

    const input = [...mounted.host.querySelectorAll<HTMLTextAreaElement>('textarea')].find(
      (candidate) => candidate.getAttribute('aria-label') === 'GLSL shader — Source — frag.glsl',
    );
    await act(async () => {
      if (!input) {
        throw new Error('Temporary Shader editor did not mount');
      }
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, 'corrected source');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => buttonByText(mounted.host, 'Apply').click());

    expect(factories.shader).toHaveBeenCalledTimes(2);
    expect(runtimes.shader.run).toHaveBeenLastCalledWith(shaderProgram('corrected source'));
    expect(mounted.host.textContent).not.toContain('Compile failed');
    expect(buttonByText(mounted.host, 'Stop')).toBeTruthy();

    await mounted.destroy();
  });
});
