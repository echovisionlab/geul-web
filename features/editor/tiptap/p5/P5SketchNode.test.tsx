// @vitest-environment jsdom

import { act, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor, type NodeType, type TextType } from '@tiptap/core';
import { NodeSelection } from '@tiptap/pm/state';
import { EditorContent, useEditor } from '@tiptap/react';
import { MantineProvider } from '@mantine/core';
import { redo, undo } from 'y-prosemirror';
import type { EditorAuthoringMode } from '@/features/editor/EditorAuthoringMode';
import { createTiptapWireExtensions } from '../wire-schema';
import { createP5SketchExtension } from './p5-extension';
import { KOREAN_P5_SKETCH_LABELS } from './p5-labels.fixtures';
import { createP5PreviewRuntime, type P5PreviewRuntimeFactory } from './p5-preview-runtime';
import { buildP5SandboxDocument } from './p5-preview-document';
import type { P5Capability } from './p5-capabilities';
import { DEFAULT_P5_SKETCH_SOURCE, normalizeP5SketchError, validateP5SketchSource } from './p5-source';

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

function documentWithSketch(
  source = DEFAULT_P5_SKETCH_SOURCE,
  previewWidth = '100',
  capabilities: readonly P5Capability[] = [],
) {
  return {
    type: 'doc',
    content: [
      {
        type: 'blockGroup',
        content: [
          {
            type: 'blockContainer',
            attrs: { id: 'p5-sketch' },
            content: [
              {
                type: 'p5Sketch',
                attrs: {
                  mode: 'preview',
                  previewHeight: 320,
                  previewWidth,
                  textAlignment: 'left',
                  capabilities: capabilities.join(' '),
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

function sketchNode(editor: Editor): NodeType | undefined {
  const blockGroup = firstChildNode(editor.getJSON());
  const blockContainer = blockGroup ? firstChildNode(blockGroup) : undefined;
  return blockContainer ? firstChildNode(blockContainer) : undefined;
}

function mountReact(node: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  act(() => root.render(<MantineProvider env="test">{node}</MantineProvider>));
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe('p5.js sketch source policy', () => {
  it('rejects network, page, storage and sketch schedulers with a source location', () => {
    expect(validateP5SketchSource('const ok = 1;\nfetch("https://example.com")')).toMatchObject({
      kind: 'policy',
      line: 2,
      column: 1,
    });
    expect(validateP5SketchSource('document.body.textContent = "unsafe"')).toMatchObject({ kind: 'policy' });
    expect(validateP5SketchSource('setTimeout(() => {}, 1)')).toMatchObject({ kind: 'policy' });
    expect(validateP5SketchSource('function setup() { createCapture(AUDIO); }')).toMatchObject({
      kind: 'policy',
      message: expect.stringContaining('must be declared'),
    });
    expect(validateP5SketchSource('function setup() { createCapture(AUDIO); }', ['microphone'])).toBeNull();
    expect(validateP5SketchSource('function setup() { requestCurrentPosition(); }')).toMatchObject({
      kind: 'policy',
      message: expect.stringContaining('must be declared'),
    });
    expect(validateP5SketchSource('function setup() { requestCurrentPosition(); }', ['location'])).toBeNull();
    expect(
      validateP5SketchSource('function mousePressed() { requestBluetoothDevice({ acceptAllDevices: true }); }'),
    ).toMatchObject({
      kind: 'policy',
      message: expect.stringContaining('must be declared'),
    });
    expect(
      validateP5SketchSource('function mousePressed() { requestBluetoothDevice({ acceptAllDevices: true }); }', [
        'bluetooth',
      ]),
    ).toBeNull();
    expect(validateP5SketchSource(DEFAULT_P5_SKETCH_SOURCE)).toBeNull();
  });

  it('sanitizes resource URLs while keeping an author source location', () => {
    const error = new Error('failed at https://private.example/sketch');
    error.stack = 'Error\n at p5-sketch.js:7:9';
    expect(normalizeP5SketchError(error, 'runtime', 2)).toEqual({
      kind: 'runtime',
      message: 'failed at [resource]',
      line: 5,
      column: 9,
    });
  });

  it('creates an opaque-frame document that denies network, same-origin and nested execution', () => {
    const sandboxDocument = buildP5SandboxDocument('</script><script>parent.pwned=true</script>', 'contract', '/p5.js');
    expect(sandboxDocument).toContain("connect-src 'none'");
    expect(sandboxDocument).toContain("worker-src 'none'");
    expect(sandboxDocument).not.toContain('</script><script>parent.pwned=true</script>');
  });

  it('resolves the p5 mount after document load and reports ready only after a canvas is attached', () => {
    const sandboxDocument = buildP5SandboxDocument(DEFAULT_P5_SKETCH_SOURCE, 'mount-contract', '/p5.js');
    expect(sandboxDocument).toMatch(/new runnerWindow\.p5\(sketch, ["']sketch["']\)/u);
    expect(sandboxDocument).not.toMatch(
      /new runnerWindow\.p5\(sketch, runnerDocument\.getElementById\(["']sketch["']\)\)/u,
    );
    expect(sandboxDocument).toMatch(/runnerDocument\.querySelector\(["']#sketch canvas["']\)/u);
    expect(sandboxDocument.indexOf('await program.draw?.(...args);')).toBeLessThan(
      sandboxDocument.indexOf('signalReady();', sandboxDocument.indexOf('await program.draw?.(...args);')),
    );
  });

  it('terminates a preflight that exceeds the CPU budget before mounting a frame', () => {
    vi.useFakeTimers();
    const terminate = vi.fn();
    const pendingWorkers: PendingWorker[] = [];
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = terminate;

      constructor() {
        pendingWorkers.push(this);
      }
    }
    vi.stubGlobal('Worker', PendingWorker);
    const mount = document.createElement('div');
    const onError = vi.fn();
    const runtime = createP5PreviewRuntime(mount, {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run('while (true) {}');
    const pendingWorker = pendingWorkers[0];
    expect(pendingWorker).toBeDefined();
    pendingWorker?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    vi.advanceTimersByTime(751);
    expect(terminate).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'resource', message: expect.stringContaining('CPU budget') }),
    );
    expect(mount.querySelector('iframe')).toBeNull();
    runtime.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('does not charge worker startup time to the author setup CPU budget', () => {
    vi.useFakeTimers();
    const pendingWorkers: PendingWorker[] = [];
    class PendingWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      postMessage = vi.fn();
      terminate = vi.fn();

      constructor() {
        pendingWorkers.push(this);
      }
    }
    vi.stubGlobal('Worker', PendingWorker);
    const onError = vi.fn();
    const runtime = createP5PreviewRuntime(document.createElement('div'), {
      onReady: vi.fn(),
      onStopped: vi.fn(),
      onError,
    });
    runtime.run(DEFAULT_P5_SKETCH_SOURCE);
    const pendingWorker = pendingWorkers[0];
    expect(pendingWorker).toBeDefined();

    vi.advanceTimersByTime(751);
    expect(onError).not.toHaveBeenCalled();
    pendingWorker?.onmessage?.(new MessageEvent('message', { data: { type: 'initialized' } }));
    expect(pendingWorker?.postMessage).toHaveBeenCalledWith({
      type: 'preflight',
      source: DEFAULT_P5_SKETCH_SOURCE,
    });
    vi.advanceTimersByTime(751);
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('CPU budget') }));

    runtime.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('p5.js Tiptap node', () => {
  it('persists source, view mode and preview settings in the wire document', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createP5SketchExtension({
          labels: KOREAN_P5_SKETCH_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
        }),
      ],
      content: documentWithSketch('function draw() { circle(10, 10, 8); }'),
    });
    expect(sketchNode(editor)).toMatchObject({
      type: 'p5Sketch',
      attrs: {
        capabilities: '',
        mode: 'preview',
        previewHeight: 320,
        previewWidth: '100',
      },
      content: [{ type: 'text', text: 'function draw() { circle(10, 10, 8); }' }],
    });
    expect(editor.getHTML()).toContain('data-preview-width="100"');
    editor.destroy();
  });

  it('parses and normalizes durable preview width from HTML', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createP5SketchExtension({
          labels: KOREAN_P5_SKETCH_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
        }),
      ],
      content: [
        '<div data-node-type="blockGroup">',
        '<div data-node-type="blockContainer" data-id="p5-html">',
        '<div data-content-type="p5Sketch" data-mode="preview" data-preview-width="43"></div>',
        '</div>',
        '</div>',
      ].join(''),
    });
    expect(sketchNode(editor)?.attrs?.previewWidth).toBe('43');
    editor.destroy();
  });

  it('inserts a schema-valid block and refuses the command when read-only', () => {
    const editor = new Editor({
      extensions: [
        ...createTiptapWireExtensions(),
        createP5SketchExtension({
          labels: KOREAN_P5_SKETCH_LABELS,
          authoringMode: FULL_AUTHORING_MODE,
        }),
      ],
      content: {
        type: 'doc',
        content: [
          {
            type: 'blockGroup',
            content: [
              {
                type: 'blockContainer',
                attrs: { id: 'p' },
                content: [{ type: 'paragraph' }],
              },
            ],
          },
        ],
      },
    });
    expect(
      editor.commands.insertP5Sketch({
        blockId: 'inserted',
        title: 'Particle study',
        source: 'function setup() { createCanvas(100, 100); }',
        previewWidth: 62,
      }),
    ).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('createCanvas');
    expect(JSON.stringify(editor.getJSON())).toContain('Particle study');
    expect(JSON.stringify(editor.getJSON())).toContain('"previewWidth":"62"');
    editor.setEditable(false);
    expect(editor.commands.insertP5Sketch()).toBe(false);
    editor.destroy();
  });
});

function PublicSketch({
  runtimeFactory,
  onEditor,
  capabilities,
}: {
  runtimeFactory: P5PreviewRuntimeFactory;
  onEditor: (editor: Editor) => void;
  capabilities?: readonly P5Capability[];
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: [
      ...createTiptapWireExtensions(),
      createP5SketchExtension({
        runtimeFactory,
        labels: KOREAN_P5_SKETCH_LABELS,
      }),
    ],
    content: documentWithSketch('function draw() { circle(4, 4, 4); }', '100', capabilities),
  });
  useEffect(() => {
    if (editor) {
      onEditor(editor);
    }
    return () => editor?.destroy();
  }, [editor, onEditor]);
  return <div data-editor-engine="tiptap">{editor ? <EditorContent editor={editor} /> : null}</div>;
}

function AuthoringSketch({
  previewWidth,
  onEditor,
  runtimeFactory,
  capabilities,
}: {
  previewWidth: string;
  onEditor: (editor: Editor) => void;
  runtimeFactory?: P5PreviewRuntimeFactory;
  capabilities?: readonly P5Capability[];
}) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: true,
    extensions: [
      ...createTiptapWireExtensions(),
      createP5SketchExtension({
        labels: KOREAN_P5_SKETCH_LABELS,
        authoringMode: FULL_AUTHORING_MODE,
        runtimeFactory,
      }),
    ],
    content: documentWithSketch(DEFAULT_P5_SKETCH_SOURCE, previewWidth, capabilities),
  });
  useEffect(() => {
    if (editor) {
      onEditor(editor);
    }
    return () => editor?.destroy();
  }, [editor, onEditor]);
  return <div data-editor-engine="tiptap">{editor ? <EditorContent editor={editor} /> : null}</div>;
}

describe('authoring p5.js sketch resize', () => {
  it('persists device capabilities and waits for an explicit run', async () => {
    const run = vi.fn();
    const runtimeFactory: P5PreviewRuntimeFactory = (_mount, events) => ({
      run: (source, options) => {
        run(source, options);
        events.onReady();
      },
      stop: events.onStopped,
      dispose: () => undefined,
    });
    let editor: Editor | null = null;
    const mounted = mountReact(
      <AuthoringSketch
        previewWidth="60"
        capabilities={['microphone']}
        runtimeFactory={runtimeFactory}
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );

    await vi.waitFor(() => expect(editor).not.toBeNull());
    expect(run).not.toHaveBeenCalled();
    expect(sketchNode(editor!)?.attrs).toMatchObject({ capabilities: 'microphone' });
    const capabilityTrigger = [...mounted.container.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
      button.hasAttribute('data-p5-capability-trigger'),
    );
    act(() => capabilityTrigger?.click());
    const microphone = document.querySelector<HTMLInputElement>(
      `input[aria-label="${KOREAN_P5_SKETCH_LABELS.capabilityLabels.microphone}"]`,
    );
    expect(microphone?.checked).toBe(true);
    expect(
      document.querySelector<HTMLInputElement>(
        `input[aria-label="${KOREAN_P5_SKETCH_LABELS.capabilityLabels.location}"]`,
      ),
    ).not.toBeNull();
    expect(
      document.querySelector<HTMLInputElement>(
        `input[aria-label="${KOREAN_P5_SKETCH_LABELS.capabilityLabels.bluetooth}"]`,
      ),
    ).not.toBeNull();
    const runButton = [...mounted.container.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.run,
    );
    act(() => runButton?.click());
    await vi.waitFor(() =>
      expect(run).toHaveBeenCalledWith(DEFAULT_P5_SKETCH_SOURCE, { capabilities: ['microphone'] }),
    );
    act(() => microphone?.click());
    await vi.waitFor(() => expect(sketchNode(editor!)?.attrs?.capabilities).toBe(''));
    mounted.unmount();
  });

  it('keeps Monaco edits draft-only until Apply updates source and preview', async () => {
    const run = vi.fn();
    const runtimeFactory: P5PreviewRuntimeFactory = (_mount, events) => ({
      run: (source) => {
        run(source);
        events.onReady();
      },
      stop: events.onStopped,
      dispose: () => undefined,
    });
    let editor: Editor | null = null;
    const mounted = mountReact(
      <AuthoringSketch
        previewWidth="60"
        runtimeFactory={runtimeFactory}
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );
    await vi.waitFor(() => expect(run).toHaveBeenCalledOnce());
    const edit = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.source,
    );
    act(() => edit?.click());
    const input = await vi.waitFor(() => {
      const element = mounted.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="p5.js 소스"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(mounted.container.querySelector('[data-testid="p5-preview"]')).not.toBeNull();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    act(() => input.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
    const nextSource = 'function setup() {\n  createCanvas(200, 120);\n}';
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, nextSource);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(run).not.toHaveBeenLastCalledWith(nextSource);
    expect(sketchNode(editor!)?.content?.[0]).not.toEqual({ type: 'text', text: nextSource });
    const apply = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.apply,
    );
    expect(apply?.disabled).toBe(false);
    act(() => apply?.click());
    await vi.waitFor(() => expect(run).toHaveBeenLastCalledWith(nextSource), { timeout: 1_000 });
    expect(sketchNode(editor!)?.content?.[0]).toEqual({ type: 'text', text: nextSource });
    mounted.unmount();
  });

  it('exits Monaco to the exact sketch NodeSelection without changing source or mode', async () => {
    let editor: Editor | null = null;
    const mounted = mountReact(
      <AuthoringSketch
        previewWidth="60"
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );

    await vi.waitFor(() => expect(editor).not.toBeNull());
    const edit = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.source,
    );
    act(() => edit?.click());
    const input = await vi.waitFor(() => {
      const element = mounted.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="p5.js 소스"]');
      expect(element).not.toBeNull();
      return element!;
    });
    const before = sketchNode(editor!);
    vi.mocked(undo).mockClear();
    vi.mocked(redo).mockClear();
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(NodeSelection.create(editor!.state.doc, 1)));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    await vi.waitFor(() => {
      expect(editor!.state.selection).toBeInstanceOf(NodeSelection);
      expect(editor!.state.selection.$from.nodeAfter?.type.name).toBe('p5Sketch');
    });
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
    expect(sketchNode(editor!)).toMatchObject({
      attrs: { mode: 'edit' },
      content: before?.content,
    });
    mounted.unmount();
  });

  it('exposes accessible handles and persists keyboard width changes as strings', async () => {
    let editor: Editor | null = null;
    const mounted = mountReact(
      <AuthoringSketch
        previewWidth="60"
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );

    await vi.waitFor(() => expect(mounted.container.querySelectorAll('[role="slider"]')).toHaveLength(2));
    const handles = mounted.container.querySelectorAll<HTMLButtonElement>('[role="slider"]');
    expect(handles).toHaveLength(2);
    expect(handles[0]?.getAttribute('aria-label')).toBe(KOREAN_P5_SKETCH_LABELS.resizeLeft);
    expect(handles[0]?.getAttribute('aria-valuenow')).toBe('60');

    act(() => handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })));
    await vi.waitFor(() => {
      expect(sketchNode(editor!)?.attrs?.previewWidth).toBe('55');
    });
    act(() => handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    await vi.waitFor(() => {
      expect(sketchNode(editor!)?.attrs?.previewWidth).toBe('60');
    });

    act(() => {
      handles[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
      handles[0]?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    await vi.waitFor(() => {
      expect(sketchNode(editor!)?.attrs?.previewWidth).toBe('100');
    });
    act(() => editor!.setEditable(false));
    await vi.waitFor(() => {
      expect(mounted.container.querySelectorAll('[role="slider"]')).toHaveLength(0);
      expect(mounted.container.querySelector('[data-content-type="p5Sketch"]')?.hasAttribute('data-selected')).toBe(
        false,
      );
    });
    mounted.unmount();
  });
});

describe('p5.js neutral authoring authority', () => {
  it('fails closed for a target-locale editor', async () => {
    let editor: Editor | null = null;
    function TargetLocaleSketch() {
      const instance = useEditor({
        immediatelyRender: false,
        editable: true,
        extensions: [
          ...createTiptapWireExtensions(),
          createP5SketchExtension({
            labels: KOREAN_P5_SKETCH_LABELS,
            authoringMode: TARGET_LOCALE_AUTHORING_MODE,
          }),
        ],
        content: documentWithSketch(DEFAULT_P5_SKETCH_SOURCE, '60'),
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

    const mounted = mountReact(<TargetLocaleSketch />);
    await vi.waitFor(() => expect(editor).not.toBeNull());
    const before = editor!.getJSON();
    expect(mounted.container.querySelectorAll('[role="slider"]')).toHaveLength(0);
    expect(
      [...mounted.container.querySelectorAll('button')].some(
        (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.edit,
      ),
    ).toBe(false);
    expect(mounted.container.querySelector('input[aria-label="p5.js 스케치"]')).not.toBeNull();
    expect(editor!.commands.insertP5Sketch()).toBe(false);
    expect(editor!.getJSON()).toEqual(before);
    mounted.unmount();
  });
});

describe('public p5.js sketch interaction', () => {
  it('auto-runs and keeps temporary edits out of the durable document', async () => {
    const run = vi.fn();
    const dispose = vi.fn();
    const runtimeFactory: P5PreviewRuntimeFactory = (_mount, events) => ({
      run: (source) => {
        run(source);
        events.onReady();
      },
      stop: events.onStopped,
      dispose,
    });
    let editor: Editor | null = null;
    const mounted = mountReact(
      <PublicSketch
        runtimeFactory={runtimeFactory}
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith('function draw() { circle(4, 4, 4); }'));
    act(() => {
      editor!.view.dispatch(editor!.state.tr.setSelection(NodeSelection.create(editor!.state.doc, 2)));
    });
    await vi.waitFor(() => {
      expect(mounted.container.querySelector('[data-content-type="p5Sketch"]')?.hasAttribute('data-selected')).toBe(
        false,
      );
    });
    expect(mounted.container.querySelectorAll('[role="slider"]')).toHaveLength(0);

    const edit = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.source,
    );
    act(() => edit?.click());
    const input = mounted.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="p5.js 소스"]');
    expect(input).not.toBeNull();
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, 'function draw() { circle(9, 9, 9); }');
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const apply = [...mounted.container.querySelectorAll('button')].find(
      (candidate) => candidate.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.apply,
    );
    act(() => apply?.click());
    await vi.waitFor(() => expect(run).toHaveBeenLastCalledWith('function draw() { circle(9, 9, 9); }'), {
      timeout: 1_000,
    });
    expect(JSON.stringify(editor!.getJSON())).toContain('circle(4, 4, 4)');
    expect(JSON.stringify(editor!.getJSON())).not.toContain('circle(9, 9, 9)');

    const reset = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.resetOriginal,
    );
    act(() => reset?.click());
    expect(input?.value).toBe('function draw() { circle(4, 4, 4); }');
    mounted.unmount();
    expect(dispose).toHaveBeenCalled();
  });

  it('runs a device-capable temporary edit without changing the durable document', async () => {
    const run = vi.fn();
    const runtimeFactory: P5PreviewRuntimeFactory = (_mount, events) => ({
      run: (source, options) => {
        run(source, options);
        events.onReady();
      },
      stop: events.onStopped,
      dispose: () => undefined,
    });
    let editor: Editor | null = null;
    const mounted = mountReact(
      <PublicSketch
        capabilities={['microphone']}
        runtimeFactory={runtimeFactory}
        onEditor={(value) => {
          editor = value;
        }}
      />,
    );

    await vi.waitFor(() => expect(editor).not.toBeNull());
    expect(run).not.toHaveBeenCalled();
    const sourceButton = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.source,
    );
    act(() => sourceButton?.click());
    const input = mounted.container.querySelector<HTMLTextAreaElement>('textarea[aria-label="p5.js 소스"]');
    const temporarySource = 'function setup() { createCanvas(10, 10); createCapture(AUDIO); }';
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
      setter?.call(input, temporarySource);
      input?.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const apply = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.apply,
    );
    act(() => apply?.click());
    expect(run).not.toHaveBeenCalled();
    const runButton = [...mounted.container.querySelectorAll('button')].find(
      (button) => button.getAttribute('aria-label') === KOREAN_P5_SKETCH_LABELS.run,
    );
    act(() => runButton?.click());

    await vi.waitFor(() => expect(run).toHaveBeenCalledWith(temporarySource, { capabilities: ['microphone'] }));
    expect(JSON.stringify(editor!.getJSON())).toContain('circle(4, 4, 4)');
    expect(JSON.stringify(editor!.getJSON())).not.toContain('createCapture');
    mounted.unmount();
  });
});
