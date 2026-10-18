// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

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
        <DesignSystemProvider locale="en" forceColorScheme="light">
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
        </DesignSystemProvider>
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
  it('names the p5 preview as a group without hiding its runtime-generated controls', async () => {
    const { factories, runtimes } = createFactories();
    factories.p5Sketch = vi.fn((mount) => {
      const action = document.createElement('button');
      action.textContent = 'Sketch action';
      mount.append(action);
      return runtimes.p5Sketch;
    });
    const mounted = await mountPublicExecutable({ type: 'p5Sketch', factories });
    const preview = mounted.host.querySelector('[data-runtime-surface="p5Sketch"] [role="group"]');

    expect(preview?.getAttribute('aria-label')).toBe('Preview');
    expect(preview?.hasAttribute('aria-hidden')).toBe(false);
    expect(preview?.querySelector('button')?.textContent).toBe('Sketch action');
    expect(preview?.closest('[role="img"]')).toBeNull();

    await mounted.destroy();
  });

  it('connects public shader stage tabs to their real source panel and updates its name on keyboard selection', async () => {
    const { factories } = createFactories();
    const mounted = await mountPublicExecutable({ type: 'shader', factories });
    await act(async () => buttonByText(mounted.host, 'Source').click());
    const panel = mounted.host.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const tabs = [...mounted.host.querySelectorAll<HTMLElement>('[role="tab"]')];
    const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')!;

    expect(panel).not.toBeNull();
    expect(tabs).toHaveLength(9);
    expect(tabs.every((tab) => document.getElementById(tab.getAttribute('aria-controls')!) === panel)).toBe(true);
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)).toBe(selected);
    expect(selected.textContent).toBe('frag.glsl');
    expect(panel.querySelector('textarea')?.getAttribute('aria-label')).toBe('GLSL shader — Source — frag.glsl');

    await act(async () => selected.focus());
    await act(async () =>
      selected.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })),
    );
    const common = tabs.find((tab) => tab.textContent === 'common.glsl')!;
    expect(document.activeElement).toBe(common);
    expect(common.getAttribute('aria-selected')).toBe('true');
    expect(mounted.host.querySelector('[role="tabpanel"]')).toBe(panel);
    expect(document.getElementById(panel.getAttribute('aria-labelledby')!)).toBe(common);
    expect(panel.querySelector('textarea')?.getAttribute('aria-label')).toBe('GLSL shader — Source — common.glsl');

    await mounted.destroy();
  });

  it('keeps shader panel relationships scoped to each mounted instance of the same public block', async () => {
    const first = await mountPublicExecutable({ type: 'shader', factories: createFactories().factories });
    const second = await mountPublicExecutable({ type: 'shader', factories: createFactories().factories });
    await act(async () => {
      buttonByText(first.host, 'Source').click();
      buttonByText(second.host, 'Source').click();
    });
    const firstPanel = first.host.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const secondPanel = second.host.querySelector<HTMLElement>('[role="tabpanel"]')!;
    expect(firstPanel.id).not.toBe(secondPanel.id);
    for (const host of [first.host, second.host]) {
      const panel = host.querySelector<HTMLElement>('[role="tabpanel"]')!;
      const selected = host.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
      expect(document.getElementById(selected.getAttribute('aria-controls')!)).toBe(panel);
      expect(document.getElementById(panel.getAttribute('aria-labelledby')!)).toBe(selected);
    }

    await first.destroy();
    await second.destroy();
  });

  it.each(['p5Sketch', 'threeScene', 'shader'] as const)(
    'keeps the running public %s runtime through Source and scroll, reading preview, controls, then editor',
    async (type) => {
      const { factories } = createFactories();
      const mounted = await mountPublicExecutable({ type, factories });

      const preview = mounted.host.querySelector<HTMLElement>(`[data-runtime-surface="${type}"]`);
      await act(async () => buttonByText(mounted.host, 'Source').click());
      await act(async () => {
        mounted.host.scrollTop = 120;
        mounted.host.dispatchEvent(new Event('scroll', { bubbles: true }));
      });

      expect(factories[type]).toHaveBeenCalledOnce();
      expect(mounted.host.querySelector(`[data-runtime-surface="${type}"]`)).toBe(preview);
      const runtimeControl = buttonByText(mounted.host, 'Stop');
      const editor = mounted.host.querySelector<HTMLElement>('textarea');
      if (!preview || !editor) {
        throw new Error('Public temporary editor layout did not mount');
      }
      expect(preview.compareDocumentPosition(runtimeControl) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
      expect(runtimeControl.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);

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
