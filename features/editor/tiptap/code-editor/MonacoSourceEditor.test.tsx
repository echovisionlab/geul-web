// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';

const fakes = vi.hoisted(() => ({
  addCommand: vi.fn(),
  currentProps: null as Record<string, unknown> | null,
  markerCalls: vi.fn(),
  modelSetValue: vi.fn(),
  modelUndo: vi.fn(),
  pushStackElement: vi.fn(),
  mountCleanup: vi.fn(),
  onKeyDown: vi.fn(),
  modelValue: 'const value = 1;',
  editorDom: null as HTMLDivElement | null,
  undoStack: [] as string[],
  undoGroupStart: null as string | null,
}));

vi.mock('./monaco-local', () => ({}));
vi.mock('./glsl-language', () => ({ registerGlslLanguage: vi.fn() }));
vi.mock('@monaco-editor/react', async () => {
  const React = await import('react');
  const monaco = {
    KeyCode: { Enter: 3, Escape: 9, KeyY: 56, KeyZ: 57 },
    KeyMod: { CtrlCmd: 2048, Shift: 1024 },
    editor: { setModelMarkers: fakes.markerCalls },
  };
  const model = {
    getValue: () => fakes.modelValue,
    isDisposed: () => false,
    setValue: (value: string) => {
      fakes.modelValue = value;
      fakes.modelSetValue(value);
      const props = fakes.currentProps as { onChange?: (value: string, event: unknown) => void };
      props.onChange?.(value, {
        changes: [{ rangeOffset: 0, rangeLength: 999, text: value }],
        isUndoing: false,
        isRedoing: false,
        versionId: 3,
      });
    },
    pushStackElement: () => {
      fakes.pushStackElement();
      if (fakes.undoGroupStart !== null) {
        fakes.undoStack.push(fakes.undoGroupStart);
        fakes.undoGroupStart = null;
      }
    },
    undo: () => {
      fakes.modelUndo();
      const undoValue = fakes.undoGroupStart ?? fakes.undoStack.pop();
      if (undoValue === undefined) {
        return;
      }
      fakes.undoGroupStart = null;
      fakes.modelValue = undoValue;
      const props = fakes.currentProps as { onChange?: (value: string, event: unknown) => void };
      props.onChange?.(undoValue, {
        changes: [{ rangeOffset: undoValue.length, rangeLength: 1, text: '' }],
        isUndoing: true,
        isRedoing: false,
        versionId: 4,
      });
    },
  };
  const editor = {
    addCommand: fakes.addCommand,
    getDomNode: () => fakes.editorDom,
    getModel: () => model,
    onDidDispose: () => ({ dispose: vi.fn() }),
    onKeyDown: (handler: (event: unknown) => void) => {
      fakes.onKeyDown(handler);
      return { dispose: vi.fn() };
    },
  };

  return {
    default: function FakeMonacoEditor(props: Record<string, unknown>) {
      fakes.currentProps = props;
      React.useEffect(() => {
        fakes.modelValue = props.value as string;
        fakes.undoGroupStart = null;
        (props.beforeMount as ((instance: unknown) => void) | undefined)?.(monaco);
        const cleanupMount = (props.onMount as ((instance: unknown, api: unknown) => void) | undefined)?.(
          editor,
          monaco,
        );
        return typeof cleanupMount === 'function' ? cleanupMount : undefined;
      }, []);
      return React.createElement('textarea', {
        'aria-label': (props.options as { ariaLabel: string }).ariaLabel,
        readOnly: (props.options as { readOnly: boolean }).readOnly,
        value: props.value as string,
        onChange: (event: { currentTarget: { value: string } }) => {
          fakes.undoGroupStart ??= fakes.modelValue;
          fakes.modelValue = event.currentTarget.value;
          (props.onChange as (value: string, change: unknown) => void)(event.currentTarget.value, {
            changes: [{ rangeOffset: 6, rangeLength: 5, text: 'answer' }],
            isUndoing: false,
            isRedoing: false,
            versionId: 2,
          });
        },
      });
    },
  };
});

import { MonacoSourceEditor, type MonacoSourceEditorProps } from './MonacoSourceEditor';

async function mountEditor(props: MonacoSourceEditorProps) {
  const host = document.createElement('div');
  document.body.append(host);
  const root: Root = createRoot(host);
  await act(async () => {
    root.render(
      <MantineProvider>
        <MonacoSourceEditor {...props} />
      </MantineProvider>,
    );
  });
  for (let attempt = 0; attempt < 50 && !host.querySelector('textarea'); attempt += 1) {
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 10));
    });
  }
  const input = host.querySelector('textarea');
  if (!input) {
    await act(async () => root.unmount());
    host.remove();
    throw new Error('Fake Monaco textarea was not mounted');
  }
  return {
    input,
    async unmount() {
      await act(async () => root.unmount());
      host.remove();
    },
  };
}

async function changeInput(input: HTMLTextAreaElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  fakes.addCommand.mockReset();
  fakes.markerCalls.mockReset();
  fakes.modelSetValue.mockReset();
  fakes.modelUndo.mockReset();
  fakes.pushStackElement.mockReset();
  fakes.mountCleanup.mockReset();
  fakes.onKeyDown.mockReset();
  fakes.modelValue = 'const value = 1;';
  fakes.editorDom = document.createElement('div');
  fakes.undoStack = [];
  fakes.undoGroupStart = null;
});

describe('MonacoSourceEditor', () => {
  it('emits range-based content changes and configures a stable in-memory model', async () => {
    const onChange = vi.fn();
    const mounted = await mountEditor({
      value: 'const value = 1;',
      onChange,
      language: 'typescript',
      ariaLabel: 'TypeScript source',
      modelPath: 'code/example',
    });
    await changeInput(mounted.input, 'const answer = 1;');

    expect(onChange).toHaveBeenCalledWith(
      'const answer = 1;',
      expect.objectContaining({
        changes: [{ rangeOffset: 6, rangeLength: 5, text: 'answer' }],
        versionId: 2,
      }),
    );
    expect(fakes.currentProps).toMatchObject({
      language: 'typescript',
      path: 'inmemory://model/tiptap/code/example.ts',
      keepCurrentModel: false,
      saveViewState: false,
      options: {
        wordWrap: 'on',
        wrappingIndent: 'indent',
      },
    });
    expect(mounted.input.closest('[data-source-editor="monaco"]')).not.toBeNull();
    await mounted.unmount();
  });

  it('normalizes legacy file model paths into the in-memory Monaco namespace', async () => {
    const mounted = await mountEditor({
      value: 'const value = 1;',
      language: 'typescript',
      ariaLabel: 'TypeScript source',
      modelPath: 'file:///tiptap/code/example.ts',
    });

    expect(fakes.currentProps).toMatchObject({ path: 'inmemory://model/tiptap/code/example.ts' });
    await mounted.unmount();
  });

  it('isolates accepted edits and undoes only the following over-limit edit', async () => {
    const onChange = vi.fn();
    const mounted = await mountEditor({
      value: 'ab',
      onChange,
      language: 'javascript',
      ariaLabel: 'JavaScript source',
      modelPath: 'limit.js',
      maxLength: 3,
    });
    await changeInput(mounted.input, 'abc');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith('abc', expect.any(Object));
    expect(fakes.pushStackElement).toHaveBeenCalledOnce();

    await changeInput(mounted.input, 'abcd');

    expect(fakes.modelUndo).toHaveBeenCalledOnce();
    expect(fakes.modelValue).toBe('abc');
    expect(fakes.modelSetValue).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledOnce();

    const runtimeProps = fakes.currentProps as {
      onChange?: (value: string, event: unknown) => void;
    };
    runtimeProps.onChange?.('ab', {
      changes: [{ rangeOffset: 2, rangeLength: 1, text: '' }],
      isUndoing: true,
      isRedoing: false,
      versionId: 5,
    });
    expect(fakes.pushStackElement).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledTimes(2);
    await mounted.unmount();
  });

  it('routes undo and redo to shared-history callbacks and cleans external markers', async () => {
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onEscape = vi.fn();
    const onApply = vi.fn();
    const mounted = await mountEditor({
      value: 'const value = 1;',
      language: 'javascript',
      ariaLabel: 'JavaScript source',
      modelPath: 'inmemory://tiptap/code/shared.js',
      markers: [
        {
          message: 'Example diagnostic',
          severity: 'warning',
          startLineNumber: 1,
          startColumn: 1,
        },
      ],
      onUndo,
      onRedo,
      onEscape,
      onApply,
      onMount: () => fakes.mountCleanup,
    });

    expect(fakes.addCommand).toHaveBeenCalledTimes(4);
    const commands = fakes.addCommand.mock.calls.map(([, handler]) => handler as () => void);
    commands[0]();
    commands[1]();
    commands[3]();
    const escapeEvent = { keyCode: 9, preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const escapeHandler = fakes.onKeyDown.mock.calls[0]?.[0] as (event: typeof escapeEvent) => void;
    escapeHandler(escapeEvent);
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onRedo).toHaveBeenCalledOnce();
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onApply).toHaveBeenCalledOnce();
    expect(escapeEvent.preventDefault).toHaveBeenCalledOnce();
    expect(escapeEvent.stopPropagation).toHaveBeenCalledOnce();
    const historyUndo = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'historyUndo',
    });
    fakes.editorDom?.dispatchEvent(historyUndo);
    expect(historyUndo.defaultPrevented).toBe(true);
    expect(onUndo).toHaveBeenCalledTimes(2);
    expect(fakes.markerCalls).toHaveBeenCalledWith(
      expect.any(Object),
      'tiptap-source-editor:inmemory://tiptap/code/shared.js',
      [expect.objectContaining({ message: 'Example diagnostic', severity: 4 })],
    );

    await mounted.unmount();
    expect(fakes.mountCleanup).toHaveBeenCalledOnce();
    expect(fakes.markerCalls).toHaveBeenLastCalledWith(
      expect.any(Object),
      'tiptap-source-editor:inmemory://tiptap/code/shared.js',
      [],
    );
  });

  it('does not intercept Monaco native navigation or editing keys', async () => {
    const outer = document.createElement('div');
    outer.append(fakes.editorDom!);
    const mounted = await mountEditor({
      value: 'abc',
      language: 'javascript',
      ariaLabel: 'JavaScript source',
      modelPath: 'native-keys.js',
    });
    expect(fakes.addCommand).not.toHaveBeenCalled();
    const nativeUndo = new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      inputType: 'historyUndo',
    });
    fakes.editorDom?.dispatchEvent(nativeUndo);
    expect(nativeUndo.defaultPrevented).toBe(false);
    const outerKeydown = vi.fn();
    outer.addEventListener('keydown', outerKeydown);
    const keys = [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'PageUp',
      'PageDown',
      'Tab',
      'Enter',
      'Backspace',
      'Delete',
    ];
    keys.forEach((key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      fakes.editorDom?.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });
    expect(outerKeydown).toHaveBeenCalledTimes(keys.length);
    await mounted.unmount();
    outer.remove();
  });
});
