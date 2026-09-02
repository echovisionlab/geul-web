// @vitest-environment jsdom

import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent, useEditor } from '@tiptap/react';
import { Editor, type NodeType, type TextType } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { MantineProvider } from '@mantine/core';
import { redo, undo } from 'y-prosemirror';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { createThreeSceneExtension, KOREAN_THREE_SCENE_LABELS } from './ThreeSceneNode';
import { createThreePreviewWorkerRuntime, type ThreePreviewRuntimeFactory } from './three-preview-runtime';
import {
  DEFAULT_THREE_SCENE_SOURCE,
  normalizeThreeSceneError,
  stripThreeSceneRuntimeImport,
  validateThreeSceneSource,
} from './three-source';
import { transpileThreeSceneSource } from './three-transpile';

vi.mock('y-prosemirror', async (importOriginal) => {
  const actual = await importOriginal<typeof import('y-prosemirror')>();
  return { ...actual, undo: vi.fn(actual.undo), redo: vi.fn(actual.redo) };
});

vi.mock('../code-editor', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../code-editor')>()),
  MonacoSourceEditor: ({
    value,
    onChange,
    ariaLabel,
    onEscape,
    onUndo,
    onRedo,
    readOnly,
  }: {
    value: string;
    onChange?: (value: string) => void;
    ariaLabel: string;
    onEscape?: () => void;
    onUndo?: () => void;
    onRedo?: () => void;
    readOnly?: boolean;
  }) => (
    <div data-source-editor="monaco">
      <textarea
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onEscape?.();
          } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
            if (event.shiftKey) {
              onRedo?.();
            } else {
              onUndo?.();
            }
          }
        }}
      />
    </div>
  ),
}));

const FULL_AUTHORING_MODE: EditorAuthoringMode = {
  allowNeutralBlockEdits: true,
  allowLocalizedBlockEdits: true,
};

const TARGET_LOCALE_AUTHORING_MODE: EditorAuthoringMode = {
  allowNeutralBlockEdits: false,
  allowLocalizedBlockEdits: true,
};

function documentWithScene(source = DEFAULT_THREE_SCENE_SOURCE, previewWidth = '64') {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          {
            type: 'blockContainer',
            attrs: { id: 'three-scene' },
            content: [
              {
                type: 'threeScene',
                attrs: {
                  language: 'typescript',
                  mode: 'preview',
                  previewHeight: 320,
                  previewWidth,
                  textAlignment: 'left',
                },
                content: [{ type: 'text', text: source }],
              },
            ],
          },
        ],
      },
    ],
  };
}

function firstChildNode(node: NodeType): NodeType | undefined {
  const child: NodeType | TextType | undefined = node.content?.[0];
  return child && !('text' in child) ? child : undefined;
}

function sceneNode(editor: Editor): NodeType | undefined {
  const blockGroup = firstChildNode(editor.getJSON());
  const blockContainer = blockGroup ? firstChildNode(blockGroup) : undefined;
  return blockContainer ? firstChildNode(blockContainer) : undefined;
}

describe('Three.js scene source policy', () => {
  it('rejects network and dynamic import while preserving source location', () => {
    expect(validateThreeSceneSource('const ok = 1;\nfetch("https://example.com")')).toMatchObject({
      kind: 'policy',
      line: 2,
      column: 1,
    });
    expect(validateThreeSceneSource('import("https://example.com/mod.js")')).toMatchObject({ kind: 'policy' });
    expect(validateThreeSceneSource('export const sceneValue = 1')).toMatchObject({ kind: 'policy' });
    expect(validateThreeSceneSource(DEFAULT_THREE_SCENE_SOURCE)).toBeNull();
    expect(DEFAULT_THREE_SCENE_SOURCE.startsWith("import * as THREE from 'three';\n")).toBe(true);
    expect(stripThreeSceneRuntimeImport(DEFAULT_THREE_SCENE_SOURCE)).not.toContain("from 'three'");
    expect(validateThreeSceneSource("import * as Other from 'other';\nconst ok = 1;")).toMatchObject({
      kind: 'policy',
    });
  });

  it('emits executable JavaScript from TypeScript without module wrappers or deprecation diagnostics', () => {
    const result = transpileThreeSceneSource(
      "import * as THREE from 'three';\nfunction frame(time: number): number { return Math.round(time); }",
    );
    expect(result.type).toBe('compiled');
    if (result.type !== 'compiled') {
      return;
    }
    expect(result.source).not.toContain(': number');
    expect(result.source).not.toContain('exports.');
    expect(result.source).not.toContain('require(');
    expect(result.source).not.toContain("from 'three'");
    const program = new Function(`${result.source}\nreturn { frame };`)() as { frame: (time: number) => number };
    expect(program.frame(4.6)).toBe(5);
  });

  it('sanitizes runtime resource URLs and keeps line and column', () => {
    const error = new Error('failed at https://private.example/scene');
    error.stack = 'Error\n at three-scene.js:7:9';
    expect(normalizeThreeSceneError(error, 'runtime', 2)).toEqual({
      kind: 'runtime',
      message: 'failed at [resource]',
      line: 5,
      column: 9,
    });
  });

  it('transpiles durable TypeScript before starting the isolated preview worker', () => {
    const workers: Array<{
      name: string;
      onmessage: ((event: MessageEvent) => void) | null;
      postMessage: ReturnType<typeof vi.fn>;
      terminate: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeWorker {
      name: string;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: (() => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor(_url: URL, options?: WorkerOptions) {
        this.name = options?.name ?? '';
        workers.push(this);
      }
    }
    vi.stubGlobal('Worker', FakeWorker);
    const canvas = document.createElement('canvas');
    const offscreen = {} as OffscreenCanvas;
    Object.defineProperty(canvas, 'transferControlToOffscreen', { value: () => offscreen });
    const onReady = vi.fn();
    const runtime = createThreePreviewWorkerRuntime(canvas, {
      onReady,
      onStopped: vi.fn(),
      onError: vi.fn(),
    });
    const typescriptSource = 'function frame(time: number) { camera.position.z = time; }';

    runtime.run(typescriptSource);
    const transpiler = workers.find((worker) => worker.name === 'three-scene-transpile');
    expect(transpiler?.postMessage).toHaveBeenCalledWith({ type: 'transpile', source: typescriptSource });
    transpiler?.onmessage?.(
      new MessageEvent('message', {
        data: { type: 'compiled', source: 'function frame(time) { camera.position.z = time; }' },
      }),
    );
    const preview = workers.find((worker) => worker.name === 'three-scene-preview');
    expect(preview?.postMessage).toHaveBeenCalledWith(
      {
        type: 'start',
        source: 'function frame(time) { camera.position.z = time; }',
        canvas: offscreen,
      },
      [offscreen],
    );
    preview?.onmessage?.(new MessageEvent('message', { data: { type: 'ready' } }));
    expect(onReady).toHaveBeenCalledOnce();

    runtime.dispose();
    vi.unstubAllGlobals();
  });
});

describe('Three.js Tiptap node', () => {
  it('persists source, view mode and preview settings in the wire document', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createThreeSceneExtension({
          labels: KOREAN_THREE_SCENE_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
        }),
      ],
      content: documentWithScene('scene.add(new THREE.Group())'),
    });
    expect(sceneNode(editor)).toMatchObject({
      type: 'threeScene',
      attrs: { language: 'typescript', mode: 'preview', previewHeight: 320, previewWidth: '64' },
      content: [{ type: 'text', text: 'scene.add(new THREE.Group())' }],
    });
    expect(editor.getHTML()).toContain('data-preview-width="64"');
    editor.destroy();
  });

  it('parses and normalizes durable preview width from HTML', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createThreeSceneExtension({
          labels: KOREAN_THREE_SCENE_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
        }),
      ],
      content: [
        '<div data-node-type="blockGroup">',
        '<div data-node-type="blockContainer" data-id="three-html">',
        '<div data-content-type="threeScene" data-mode="preview" data-preview-width="9"></div>',
        '</div>',
        '</div>',
      ].join(''),
    });
    expect(sceneNode(editor)?.attrs?.previewWidth).toBe('10');
    expect(editor.getHTML()).toContain('data-preview-width="10"');
    editor.destroy();
  });

  it('inserts a schema-valid block and refuses the command when read-only', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createThreeSceneExtension({
          labels: KOREAN_THREE_SCENE_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
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
      editor.commands.insertThreeScene({
        blockId: 'inserted',
        title: 'Night scene',
        source: 'camera.position.z = 2;',
        previewWidth: '72',
      }),
    ).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('camera.position.z = 2;');
    expect(JSON.stringify(editor.getJSON())).toContain('Night scene');
    expect(JSON.stringify(editor.getJSON())).toContain('"previewWidth":"72"');
    editor.setEditable(false);
    expect(editor.commands.insertThreeScene()).toBe(false);
    editor.destroy();
  });
});

function AuthoringScene({
  onEditor,
  runtimeFactory,
}: {
  onEditor: (editor: Editor) => void;
  runtimeFactory?: ThreePreviewRuntimeFactory;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions: [
      ...createTiptapWireExtensions(),
      createThreeSceneExtension({
        labels: KOREAN_THREE_SCENE_LABELS,
        authoringMode: FULL_AUTHORING_MODE,
        runtimeFactory,
      }),
    ],
    content: documentWithScene(),
  });
  useEffect(() => {
    if (editor) {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, 2)));
      onEditor(editor);
    }
    return () => editor?.destroy();
  }, [editor, onEditor]);
  return <div data-editor-engine="tiptap">{editor ? <EditorContent editor={editor} /> : null}</div>;
}

describe('authoring Three.js scene resize', () => {
  it('keeps Monaco edits draft-only until Apply updates source and preview', async () => {
    const run = vi.fn();
    const runtimeFactory: ThreePreviewRuntimeFactory = (_canvas, events) => ({
      run: (source) => {
        run(source);
        events.onReady();
      },
      stop: events.onStopped,
      dispose: () => undefined,
    });
    let editor: Editor | null = null;
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <AuthoringScene
            runtimeFactory={runtimeFactory}
            onEditor={(value) => {
              editor = value;
            }}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(run).toHaveBeenCalledOnce();
    const edit = [...element.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.source,
    );
    await act(async () => edit?.click());
    const input = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="Three.js 소스"]');
    expect(input).not.toBeNull();
    expect(element.querySelector('[data-testid="three-preview"]')).not.toBeNull();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(async () => input?.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
    const nextSource = 'function frame(time: number) {\n  camera.position.z = time / 1000;\n}';
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, nextSource);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(run).not.toHaveBeenLastCalledWith(nextSource);
    expect(sceneNode(editor!)?.content?.[0]).not.toEqual({ type: 'text', text: nextSource });
    const apply = [...element.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.apply,
    );
    expect(apply?.disabled).toBe(false);
    await act(async () => {
      apply?.click();
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(run).toHaveBeenLastCalledWith(nextSource);
    expect(sceneNode(editor!)?.content?.[0]).toEqual({ type: 'text', text: nextSource });
    await act(async () => root.unmount());
    element.remove();
  });

  it('exits Monaco to the exact scene NodeSelection without changing source or mode', async () => {
    let editor: Editor | null = null;
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <AuthoringScene
            onEditor={(value) => {
              editor = value;
            }}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const edit = [...element.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.source,
    );
    await act(async () => edit?.click());
    const input = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="Three.js 소스"]');
    expect(input).not.toBeNull();
    const before = sceneNode(editor!);
    vi.mocked(undo).mockClear();
    vi.mocked(redo).mockClear();
    await act(async () => {
      editor!.view.dispatch(editor!.state.tr.setSelection(NodeSelection.create(editor!.state.doc, 1)));
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }));
      input!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(editor!.state.selection).toBeInstanceOf(NodeSelection);
    expect(editor!.state.selection.$from.nodeAfter?.type.name).toBe('threeScene');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(sceneNode(editor!)).toMatchObject({
      attrs: { language: 'typescript', mode: 'edit' },
      content: before?.content,
    });
    await act(async () => root.unmount());
    element.remove();
  });

  it('exposes accessible handles and persists keyboard resize or cancellation', async () => {
    let editor: Editor | null = null;
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <AuthoringScene
            onEditor={(value) => {
              editor = value;
            }}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const handles = element.querySelectorAll<HTMLButtonElement>('[role="slider"]');
    expect(handles).toHaveLength(2);
    const rightHandle = [...handles].find(
      (handle) => handle.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.resizeRight,
    );
    expect(rightHandle?.getAttribute('aria-valuenow')).toBe('64');

    await act(async () => {
      rightHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rightHandle?.getAttribute('aria-valuenow')).toBe('69');
    expect(JSON.stringify(editor!.getJSON())).toContain('"previewWidth":"69"');

    await act(async () => {
      rightHandle?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rightHandle?.getAttribute('aria-valuenow')).toBe('64');
    expect(JSON.stringify(editor!.getJSON())).toContain('"previewWidth":"64"');

    await act(async () => {
      editor!.setEditable(false);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.querySelectorAll('[role="slider"]')).toHaveLength(0);
    expect(element.querySelector('[data-content-type="threeScene"]')?.hasAttribute('data-selected')).toBe(false);

    await act(async () => root.unmount());
    element.remove();
  });
});

describe('Three.js neutral authoring authority', () => {
  it('fails closed for a target-locale editor', async () => {
    let editor: Editor | null = null;
    function TargetLocaleScene() {
      const instance = useEditor({
        immediatelyRender: false,
        editable: true,
        extensions: [
          ...createTiptapWireExtensions(),
          createThreeSceneExtension({
            labels: KOREAN_THREE_SCENE_LABELS,
            authoringMode: TARGET_LOCALE_AUTHORING_MODE,
          }),
        ],
        content: documentWithScene(DEFAULT_THREE_SCENE_SOURCE, '64'),
      });
      useEffect(() => {
        if (instance) {
          editor = instance;
          instance.view.dispatch(instance.state.tr.setSelection(NodeSelection.create(instance.state.doc, 2)));
        }
        return () => instance?.destroy();
      }, [instance]);
      return instance ? <EditorContent editor={instance} /> : null;
    }

    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <TargetLocaleScene />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    const before = editor!.getJSON();
    expect(element.querySelectorAll('[role="slider"]')).toHaveLength(0);
    expect(
      [...element.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.edit,
      ),
    ).toBe(false);
    expect(element.querySelector('input[aria-label="Three.js 장면"]')).not.toBeNull();
    expect(editor!.commands.insertThreeScene()).toBe(false);
    expect(editor!.getJSON()).toEqual(before);
    await act(async () => root.unmount());
    element.remove();
  });
});

function PublicScene({
  runtimeFactory,
  onEditor,
}: {
  runtimeFactory: ThreePreviewRuntimeFactory;
  onEditor: (editor: Editor) => void;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...createTiptapWireExtensions(),
      createThreeSceneExtension({ runtimeFactory, labels: KOREAN_THREE_SCENE_LABELS }),
    ],
    content: documentWithScene('camera.position.z = 4;'),
  });
  useEffect(() => {
    if (editor) {
      onEditor(editor);
    }
    return () => editor?.destroy();
  }, [editor, onEditor]);
  return <div data-editor-engine="tiptap">{editor ? <EditorContent editor={editor} /> : null}</div>;
}

describe('public Three.js scene interaction', () => {
  it('auto-runs in isolation and keeps temporary edits out of the document', async () => {
    const run = vi.fn();
    const stop = vi.fn();
    const dispose = vi.fn();
    const runtimeFactory: ThreePreviewRuntimeFactory = (_canvas, events) => ({
      run: (source) => {
        run(source);
        events.onReady();
      },
      stop: () => {
        stop();
        events.onStopped();
      },
      dispose,
    });
    let editor: Editor | null = null;
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <PublicScene
            runtimeFactory={runtimeFactory}
            onEditor={(value) => {
              editor = value;
            }}
          />
        </MantineProvider>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(run).toHaveBeenCalledWith('camera.position.z = 4;');
    expect(element.querySelectorAll('[role="slider"]')).toHaveLength(0);
    await act(async () => {
      editor!.view.dispatch(editor!.state.tr.setSelection(NodeSelection.create(editor!.state.doc, 2)));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(element.querySelector('[data-content-type="threeScene"]')?.hasAttribute('data-selected')).toBe(false);
    expect(element.querySelectorAll('[role="slider"]')).toHaveLength(0);

    const button = [...element.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.source,
    );
    await act(async () => button?.click());
    const input = element.querySelector<HTMLTextAreaElement>('textarea[aria-label="Three.js 소스"]');
    expect(input).not.toBeNull();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, 'camera.position.z = 9;');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const apply = [...element.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.apply,
    );
    await act(async () => {
      apply?.click();
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(run).toHaveBeenLastCalledWith('camera.position.z = 9;');
    expect(JSON.stringify(editor!.getJSON())).toContain('camera.position.z = 4;');
    expect(JSON.stringify(editor!.getJSON())).not.toContain('camera.position.z = 9;');

    const stopButton = [...element.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.stop,
    );
    await act(async () => stopButton?.click());
    expect(stop).toHaveBeenCalled();
    const runCountBeforeReset = run.mock.calls.length;

    const reset = [...element.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === KOREAN_THREE_SCENE_LABELS.resetOriginal,
    );
    await act(async () => {
      reset?.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(input?.value).toBe('camera.position.z = 4;');
    expect(run).toHaveBeenCalledTimes(runCountBeforeReset + 1);
    expect(run).toHaveBeenLastCalledWith('camera.position.z = 4;');
    await act(async () => root.unmount());
    element.remove();
  });
});
