// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor, type NodeType, type TextType } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import type { MonacoSourceEditorProps } from '../code-editor';

import { createTiptapWireExtensions } from '../wire-schema';
import { executableBlockIdForPosition } from '../executable-source';
import {
  createShaderExtension,
  KOREAN_SHADER_LABELS,
  replaceShaderStageChannels,
  replaceShaderStageSource,
  selectShaderNode,
  setShaderNodeTitle,
} from './ShaderNode';
import { ShaderPublicPreview } from './ShaderPublicPreview';
import { DEFAULT_SHADER_PROGRAM, SHADER_STAGE_DEFINITIONS } from './shader-program';
import type { ShaderPreviewRuntimeFactory } from './shader-preview-runtime';
import { DEFAULT_SHADER_FRAGMENT_SOURCE, DEFAULT_SHADER_VERTEX_SOURCE } from './shader-source';

// NodeView/preview ownership is exercised below with the real editor. Monaco's
// engine, workers and model lifecycle are covered by code-editor tests and the
// browser stories; loading that engine adds no coverage to this DOM boundary.
vi.mock('../code-editor/MonacoSourceEditorRuntime', () => ({
  MonacoSourceEditorRuntime: ({ ariaLabel, value }: MonacoSourceEditorProps) => (
    <textarea aria-label={ariaLabel} value={value} readOnly />
  ),
}));

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => vi.useRealTimers());
afterAll(() => vi.unstubAllGlobals());

function documentWithShader(fragmentSource = DEFAULT_SHADER_FRAGMENT_SOURCE, mode = 'edit') {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          {
            type: 'blockContainer',
            attrs: { id: 'shader-one' },
            content: [
              {
                type: 'shader',
                attrs: { mode, previewHeight: 320, previewWidth: '64', textAlignment: 'center' },
                content: SHADER_STAGE_DEFINITIONS.map(([stage, nodeName]) => {
                  const source = stage === 'image' ? fragmentSource : DEFAULT_SHADER_PROGRAM.sources[stage];
                  return { type: nodeName, ...(source ? { content: [{ type: 'text', text: source }] } : {}) };
                }),
              },
            ],
          },
        ],
      },
    ],
  };
}

function programWithImage(fragmentSource = DEFAULT_SHADER_FRAGMENT_SOURCE) {
  return {
    ...DEFAULT_SHADER_PROGRAM,
    sources: { ...DEFAULT_SHADER_PROGRAM.sources, image: fragmentSource },
    channels: Object.fromEntries(
      ['bufferA', 'bufferB', 'bufferC', 'bufferD', 'cubemap', 'sound', 'image'].map((stage) => [
        stage,
        [{ kind: 'none' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
      ]),
    ),
  } as typeof DEFAULT_SHADER_PROGRAM;
}

function child(node: NodeType): NodeType | undefined {
  const candidate: NodeType | TextType | undefined = node.content?.[0];
  return candidate && !('text' in candidate) ? candidate : undefined;
}

function shader(editor: Editor): NodeType | undefined {
  const group = child(editor.getJSON());
  const block = group ? child(group) : undefined;
  return block ? child(block) : undefined;
}

describe('Shader source and wire contract', () => {
  it('stores source as text content and only layout/runtime mode as attributes', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createShaderExtension({
          authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
        }),
      ],
      content: documentWithShader(),
    });
    expect(shader(editor)).toMatchObject({
      type: 'shader',
      attrs: { mode: 'edit', previewHeight: 320, previewWidth: '64', textAlignment: 'center' },
    });
    expect(shader(editor)?.attrs).not.toHaveProperty('source');
    expect(shader(editor)?.content?.[1]).toEqual({
      type: 'shaderVertex',
      content: [{ type: 'text', text: DEFAULT_SHADER_VERTEX_SOURCE }],
    });
    expect(shader(editor)?.content?.[8]).toMatchObject({
      type: 'shaderImage',
      content: [{ type: 'text', text: DEFAULT_SHADER_FRAGMENT_SOURCE }],
    });
    expect(editor.getHTML()).toContain('data-shader-stage="vertex"');
    expect(editor.getHTML()).toContain('data-content-type="shader"');
    editor.destroy();
  });

  it('inserts a text-content shader and refuses document mutation in read-only mode', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createShaderExtension({
          authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
        }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', attrs: { id: 'p' }, content: [{ type: 'paragraph' }] }],
          },
        ],
      },
    });
    expect(
      editor.commands.insertShader({
        title: 'Water shader',
        fragmentSource: 'void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }',
        previewWidth: '72',
        textAlignment: 'right',
      }),
    ).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('mainImage');
    expect(JSON.stringify(editor.getJSON())).toContain('Water shader');
    expect(JSON.stringify(editor.getJSON())).not.toContain('"source"');
    editor.setEditable(false);
    expect(editor.commands.insertShader()).toBe(false);
    editor.destroy();
  });

  it('fails closed without neutral authoring authority', () => {
    const editor = new Editor({
      extensions: [...createTiptapWireExtensions(), createShaderExtension()],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [{ type: 'blockContainer', attrs: { id: 'p' }, content: [{ type: 'paragraph' }] }],
          },
        ],
      },
    });
    expect(editor.commands.insertShader()).toBe(false);
    editor.destroy();
  });
});

describe('Shader Monaco authoring boundary', () => {
  it.each([1, 2])(
    'retains selection at %s while a localized title changes and leaves the program intact',
    (selectedPosition) => {
      const editor = new Editor({
        extensions: [
          ...createTiptapWireExtensions(),
          createShaderExtension({
            labels: KOREAN_SHADER_LABELS,
            authoringMode: { allowNeutralBlockEdits: false, allowLocalizedBlockEdits: true },
          }),
        ],
        content: documentWithShader(DEFAULT_SHADER_FRAGMENT_SOURCE, 'preview'),
      });
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, selectedPosition)));
      const source = shader(editor)?.content;
      const attributes = shader(editor)?.attrs;
      for (const title of ['Edited executable title', '', '밤하늘 Shader']) {
        expect(setShaderNodeTitle(editor, () => 2, title)).toBe(true);
        expect(shader(editor)?.attrs).toEqual({ ...attributes, title });
        expect(shader(editor)?.content).toEqual(source);
        expect(editor.state.selection).toBeInstanceOf(NodeSelection);
        expect(editor.state.selection.from).toBe(selectedPosition);
      }
      editor.setEditable(false);
      expect(setShaderNodeTitle(editor, () => 2, 'Unavailable')).toBe(false);
      expect(shader(editor)?.attrs.title).toBe('밤하늘 Shader');
      editor.destroy();
    },
  );

  it('applies only the changed text range and preserves attrs', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createShaderExtension({
          labels: KOREAN_SHADER_LABELS,
          authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
        }),
      ],
      content: documentWithShader('void mainImage(out vec4 c, in vec2 p) { c = vec4(1.0); }'),
    });
    const position = 2;
    const dispatch = vi.spyOn(editor.view, 'dispatch');
    const next = 'void mainImage(out vec4 c, in vec2 p) { c = vec4(0.0); }';
    expect(replaceShaderStageSource({ editor, getPos: () => position, stage: 'image', value: next })).toBe(true);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(shader(editor)?.content?.[8]).toMatchObject({
      type: 'shaderImage',
      content: [{ type: 'text', text: next }],
    });
    expect(shader(editor)?.attrs).not.toHaveProperty('source');
    expect(shader(editor)?.attrs.mode).toBe('edit');

    const blockId = executableBlockIdForPosition({ editor, getPos: () => position });
    expect(blockId).toBe('shader-one');
    editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, position)));
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('shader');
    expect(shader(editor)?.content?.[8]).toMatchObject({
      type: 'shaderImage',
      content: [{ type: 'text', text: next }],
    });

    editor.setEditable(false);
    expect(replaceShaderStageSource({ editor, getPos: () => position, stage: 'image', value: 'changed' })).toBe(false);
    expect(shader(editor)?.content?.[8]).toMatchObject({
      type: 'shaderImage',
      content: [{ type: 'text', text: next }],
    });
    editor.destroy();
  });

  it('allows target-locale Escape to select the shader without neutral mutation authority', () => {
    const editor = new Editor({
      editable: true,
      extensions: [
        ...createTiptapWireExtensions(),
        createShaderExtension({
          labels: KOREAN_SHADER_LABELS,
          authoringMode: { allowNeutralBlockEdits: false, allowLocalizedBlockEdits: true },
        }),
      ],
      content: documentWithShader(DEFAULT_SHADER_FRAGMENT_SOURCE, 'edit'),
    });
    const focus = vi.spyOn(editor.view, 'focus');
    expect(selectShaderNode(editor, () => 2)).toBe(true);
    expect(editor.state.selection).toBeInstanceOf(NodeSelection);
    expect((editor.state.selection as NodeSelection).node.type.name).toBe('shader');
    expect(focus).toHaveBeenCalledOnce();
    expect(shader(editor)?.attrs.mode).toBe('edit');
    editor.destroy();
  });

  it('shows live source and preview together in edit mode without feeding preview chrome into ProseMirror', async ({
    onTestFinished,
  }) => {
    const run = vi.fn();
    const runtimeFactory: ShaderPreviewRuntimeFactory = (_canvas, events) => ({
      run: (source) => {
        run(source);
        events.onReady();
      },
      stop: events.onStopped,
      enableAudio: () => undefined,
      dispose: () => undefined,
      pointer: () => undefined,
      resize: () => undefined,
    });
    let transactionCount = 0;
    const editorInstance = new Editor({
      editable: true,
      extensions: [
        ...createTiptapWireExtensions(),
        createShaderExtension({
          runtimeFactory,
          authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
        }),
      ],
      content: documentWithShader(DEFAULT_SHADER_FRAGMENT_SOURCE, 'edit'),
      onTransaction: () => {
        transactionCount += 1;
      },
    });
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    onTestFinished(async () => {
      try {
        await act(async () => root.unmount());
      } finally {
        editorInstance.destroy();
        element.remove();
      }
    });
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <EditorContent editor={editorInstance} />
        </DesignSystemProvider>,
      );
    });
    expect(run).toHaveBeenCalledOnce();
    expect(element.querySelector('[data-testid="tiptap-monaco-source-editor"]')).not.toBeNull();
    expect(element.querySelector('[data-testid="shader-preview"]')?.getAttribute('data-status')).toBe('running');
    const preview = element.querySelector<HTMLElement>('[data-testid="shader-preview"]')!;
    expect(preview.dataset.previewHeight).toBe('320');
    expect(preview.style.height).toBe('320px');
    expect(element.querySelector('[data-testid="shader-result-pane"]')).not.toBeNull();
    const availableInputs = element.querySelector<HTMLElement>('[data-testid="shader-available-inputs"]');
    const referenceTrigger = availableInputs?.querySelector<HTMLButtonElement>('[data-accordion-control]');
    expect(referenceTrigger?.getAttribute('aria-expanded')).toBe('false');
    expect(referenceTrigger?.textContent).toContain('Available inputs');
    expect(availableInputs?.textContent).toContain('mainImage');
    expect(availableInputs?.textContent).toContain('iResolution');
    const referenceMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
    await act(async () => {
      referenceTrigger?.dispatchEvent(referenceMouseDown);
    });
    expect(editorInstance.state.selection).not.toBeInstanceOf(NodeSelection);
    await act(async () => referenceTrigger?.click());
    expect(referenceTrigger?.getAttribute('aria-expanded')).toBe('true');
    expect(
      availableInputs?.querySelector(`#${referenceTrigger?.getAttribute('aria-controls')}`)?.hasAttribute('hidden'),
    ).toBe(false);
    const canvas = element.querySelector<HTMLCanvasElement>('[data-testid="shader-preview"] canvas');
    expect((canvas?.width ?? 0) / (canvas?.height ?? 1)).toBeCloseTo(16 / 9, 5);
    const resultPane = element.querySelector<HTMLElement>('[data-testid="shader-result-pane"]')!;
    const sourceEditor = element.querySelector<HTMLElement>('[data-testid="tiptap-monaco-source-editor"]')!;
    const sourcePanel = element.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const stageTabs = [...element.querySelectorAll<HTMLElement>('[role="tab"]')];
    const selectedStage = stageTabs.find((tab) => tab.getAttribute('aria-selected') === 'true')!;
    expect(stageTabs).toHaveLength(9);
    expect(stageTabs.every((tab) => document.getElementById(tab.getAttribute('aria-controls')!) === sourcePanel)).toBe(
      true,
    );
    expect(document.getElementById(sourcePanel.getAttribute('aria-labelledby')!)).toBe(selectedStage);
    expect(selectedStage.textContent).toBe('frag.glsl');
    expect(sourcePanel.contains(sourceEditor)).toBe(true);
    expect(sourceEditor.querySelector('textarea')?.value).toBe(DEFAULT_SHADER_FRAGMENT_SOURCE);
    expect(sourcePanel.contains(availableInputs)).toBe(true);
    expect(resultPane.compareDocumentPosition(sourceEditor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect([...element.querySelectorAll('button')].some((button) => button.getAttribute('aria-label') === 'Stop')).toBe(
      true,
    );
    expect(
      [...element.querySelectorAll('button')].some((button) => button.getAttribute('aria-label') === 'Restart'),
    ).toBe(true);
    expect(transactionCount).toBe(0);
    const sourceBeforeChannelChange = run.mock.calls[0]?.[0].sources.image;
    await act(async () => {
      expect(
        replaceShaderStageChannels({
          editor: editorInstance,
          getPos: () => 2,
          stage: 'image',
          channels: [{ kind: 'buffer', buffer: 'A' }, { kind: 'none' }, { kind: 'none' }, { kind: 'none' }],
          canEditNeutral: true,
        }),
      ).toBe(true);
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[1]?.[0].sources.image).toBe(sourceBeforeChannelChange);
    expect(run.mock.calls[1]?.[0].channels.image?.[0]).toEqual({ kind: 'buffer', buffer: 'A' });
    expect(shader(editorInstance)?.content?.[8]).toMatchObject({
      type: 'shaderImage',
      content: [{ type: 'text', text: sourceBeforeChannelChange }],
    });
    const canvasAfterChannelChange = element.querySelector<HTMLCanvasElement>('[data-testid="shader-preview"] canvas');
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
      document.dispatchEvent(new Event('scroll'));
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(element.querySelector<HTMLCanvasElement>('[data-testid="shader-preview"] canvas')).toBe(
      canvasAfterChannelChange,
    );
    const sourceButton = [...element.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === 'Source',
    );
    await act(async () => sourceButton?.click());
    expect(element.querySelector('[data-testid="tiptap-monaco-source-editor"]')).toBeNull();
    expect(element.querySelector('[role="tabpanel"]')).toBeNull();
    expect(element.querySelector('[data-testid="shader-preview"]')).not.toBeNull();
    await act(async () => {
      sourceButton?.click();
    });
    expect(element.querySelector('[data-testid="tiptap-monaco-source-editor"]')).not.toBeNull();
    const restoredPanel = element.querySelector<HTMLElement>('[role="tabpanel"]')!;
    const restoredSelected = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')!;
    expect(restoredPanel.id).toBe(sourcePanel.id);
    expect(document.getElementById(restoredSelected.getAttribute('aria-controls')!)).toBe(restoredPanel);
    expect(document.getElementById(restoredPanel.getAttribute('aria-labelledby')!)).toBe(restoredSelected);
    expect(element.querySelector('[data-testid="shader-preview"]')?.getAttribute('data-status')).toBe('running');
  });

  it('debounces an edit-mode source correction and recovers a terminal preview error', async () => {
    vi.useFakeTimers();
    const invalidSource = DEFAULT_SHADER_FRAGMENT_SOURCE.replace('fragColor =', 'fragColor = missing +');
    const correctedSource = DEFAULT_SHADER_FRAGMENT_SOURCE.replace('0.15', '0.45');
    const run = vi.fn();
    const runtimeFactory: ShaderPreviewRuntimeFactory = (_canvas, events) => ({
      run: (source) => {
        run(source);
        if (source.sources.image === invalidSource) {
          events.onError({ kind: 'compile', message: 'missing is not defined', line: 4, column: 15 });
        } else {
          events.onReady();
        }
      },
      stop: events.onStopped,
      enableAudio: () => undefined,
      dispose: () => undefined,
      pointer: () => undefined,
      resize: () => undefined,
    });
    let editorInstance: Editor | null = null;
    function RecoveringAuthoringShader() {
      const editor = useEditor({
        immediatelyRender: false,
        editable: true,
        extensions: [
          ...createTiptapWireExtensions(),
          createShaderExtension({
            runtimeFactory,
            authoringMode: { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true },
          }),
        ],
        content: documentWithShader(invalidSource, 'edit'),
      });
      useEffect(() => {
        editorInstance = editor;
        return () => editor?.destroy();
      }, [editor]);
      return editor ? <EditorContent editor={editor} /> : null;
    }
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <RecoveringAuthoringShader />
        </DesignSystemProvider>,
      );
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(element.querySelector('[data-testid="shader-error"]')).not.toBeNull();
    const position = 2;
    await act(async () => {
      expect(
        replaceShaderStageSource({
          editor: editorInstance!,
          getPos: () => position,
          stage: 'image',
          value: correctedSource,
        }),
      ).toBe(true);
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(programWithImage(correctedSource));
    expect(element.querySelector('[data-testid="shader-preview"]')?.getAttribute('data-status')).toBe('running');
    expect(element.querySelector('[data-testid="shader-error"]')).toBeNull();
    await act(async () => root.unmount());
    element.remove();
  });
});

describe('Shader preview worker lifecycle', () => {
  it('uses a fresh canvas transfer after a visible preview is hidden and resumed', async () => {
    const run = vi.fn();
    const dispose = vi.fn();
    const transferredCanvases: HTMLCanvasElement[] = [];
    const transfer = vi.fn(function (this: HTMLCanvasElement) {
      transferredCanvases.push(this);
      return {} as OffscreenCanvas;
    });
    const descriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
    Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', {
      configurable: true,
      value: transfer,
    });
    const runtimeFactory: ShaderPreviewRuntimeFactory = (canvas, events) => {
      canvas.transferControlToOffscreen();
      return {
        run: (source) => {
          run(source);
          events.onReady();
        },
        stop: events.onStopped,
        enableAudio: () => undefined,
        dispose,
        pointer: () => undefined,
        resize: () => undefined,
      };
    };
    const element = document.createElement('div');
    element.setAttribute('aria-hidden', 'true');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ShaderPublicPreview program={programWithImage()} runtimeFactory={runtimeFactory} />
        </DesignSystemProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(run).not.toHaveBeenCalled();
    await act(async () => {
      element.removeAttribute('aria-hidden');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(run).toHaveBeenCalledWith(programWithImage());
    expect(transfer).toHaveBeenCalledTimes(1);
    await act(async () => {
      element.setAttribute('aria-hidden', 'true');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    await act(async () => {
      element.removeAttribute('aria-hidden');
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(transfer).toHaveBeenCalledTimes(2);
    expect(transferredCanvases[1]).not.toBe(transferredCanvases[0]);
    await act(async () => root.unmount());
    expect(dispose).toHaveBeenCalled();
    element.remove();
    if (descriptor) {
      Object.defineProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen', descriptor);
    } else {
      Reflect.deleteProperty(HTMLCanvasElement.prototype, 'transferControlToOffscreen');
    }
  });

  it('does not automatically retry a terminal read-only shader error', async () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const dispose = vi.fn();
    const runtimeFactory: ShaderPreviewRuntimeFactory = (_canvas, events) => ({
      run: (source) => {
        run(source);
        events.onError({ kind: 'compile', message: 'invalid shader', line: 1, column: 1 });
      },
      stop: events.onStopped,
      enableAudio: () => undefined,
      dispose,
      pointer: () => undefined,
      resize: () => undefined,
    });
    function ReadOnlyShader() {
      const editor = useEditor({
        immediatelyRender: false,
        editable: false,
        extensions: [...createTiptapWireExtensions(), createShaderExtension({ runtimeFactory })],
        content: documentWithShader(DEFAULT_SHADER_FRAGMENT_SOURCE, 'preview'),
      });
      useEffect(() => () => editor?.destroy(), [editor]);
      return editor ? <EditorContent editor={editor} /> : null;
    }
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ReadOnlyShader />
        </DesignSystemProvider>,
      );
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => vi.advanceTimersByTimeAsync(100));
    expect(run).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    expect(dispose).toHaveBeenCalledTimes(1);
    element.remove();
  });

  it('does not recreate a transferred canvas when callback identities change and uses one new canvas on restart', async () => {
    const canvases: HTMLCanvasElement[] = [];
    const dispose = vi.fn();
    const runtimeFactory: ShaderPreviewRuntimeFactory = (canvas, events) => {
      canvases.push(canvas);
      return {
        run: () => events.onError({ kind: 'runtime', message: 'stopped once' }),
        stop: events.onStopped,
        enableAudio: () => undefined,
        dispose,
        pointer: () => undefined,
        resize: () => undefined,
      };
    };
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ShaderPublicPreview
            program={programWithImage()}
            active
            revision={1}
            runtimeFactory={runtimeFactory}
            onError={() => undefined}
          />
        </DesignSystemProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(canvases).toHaveLength(1);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ShaderPublicPreview
            program={programWithImage()}
            active
            revision={1}
            runtimeFactory={runtimeFactory}
            onError={() => undefined}
          />
        </DesignSystemProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(canvases).toHaveLength(1);
    await act(async () => {
      root.render(
        <DesignSystemProvider forceColorScheme="light">
          <ShaderPublicPreview
            program={programWithImage()}
            active
            revision={2}
            runtimeFactory={runtimeFactory}
            onError={() => undefined}
          />
        </DesignSystemProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(canvases).toHaveLength(2);
    expect(canvases[1]).not.toBe(canvases[0]);
    expect(dispose).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
    element.remove();
  });
});
