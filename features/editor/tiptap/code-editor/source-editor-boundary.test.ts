// @vitest-environment jsdom

import type { NodeViewRendererProps } from '@tiptap/core';
import {
  isMonacoSourceEditorEvent,
  isMonacoSourceEditorTarget,
  withMonacoSourceEditorEvents,
} from './source-editor-boundary';

describe('Monaco source editor boundary', () => {
  it.each(['Enter', 'Tab', 'ArrowDown'])('recognizes nested %s events', (key) => {
    const sourceEditor = document.createElement('div');
    sourceEditor.dataset.sourceEditor = 'monaco';
    const input = document.createElement('textarea');
    sourceEditor.append(input);

    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: input });

    expect(isMonacoSourceEditorTarget(input)).toBe(true);
    expect(isMonacoSourceEditorEvent(event)).toBe(true);
  });

  it('does not classify controls outside the source editor', () => {
    const button = document.createElement('button');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    Object.defineProperty(event, 'target', { value: button });

    expect(isMonacoSourceEditorTarget(button)).toBe(false);
    expect(isMonacoSourceEditorEvent(event)).toBe(false);
  });

  it('preserves the native control and drag boundary with its node-view receiver', () => {
    const dom = document.createElement('div');
    const input = document.createElement('input');
    dom.append(input);
    const nativeStop = vi.fn(function (this: { dom: HTMLElement }, event: Event) {
      expect(this.dom).toBe(dom);
      return event.target === input && event.type !== 'drop';
    });
    const view = withMonacoSourceEditorEvents(() => ({ dom, stopEvent: nativeStop }))({} as NodeViewRendererProps);
    for (const [type, expected] of [
      ['keydown', true],
      ['beforeinput', true],
      ['paste', true],
      ['drop', false],
    ] as const) {
      const event = new Event(type);
      Object.defineProperty(event, 'target', { value: input });
      expect(view.stopEvent?.(event)).toBe(expected);
    }
    expect(nativeStop).toHaveBeenCalledTimes(4);
  });

  it('adds Monaco and explicit domain isolation while forwarding ordinary surface events', () => {
    const dom = document.createElement('div');
    const monaco = document.createElement('div');
    monaco.dataset.sourceEditor = 'monaco';
    const source = document.createElement('textarea');
    monaco.append(source);
    const domain = document.createElement('div');
    dom.append(monaco, domain);
    const nativeStop = vi.fn(() => false);
    const view = withMonacoSourceEditorEvents(
      () => ({ dom, stopEvent: nativeStop }),
      (event) => event.target === domain,
    )({} as NodeViewRendererProps);
    for (const [target, expected] of [
      [source, true],
      [domain, true],
      [dom, false],
    ] as const) {
      const event = new Event('keydown');
      Object.defineProperty(event, 'target', { value: target });
      expect(view.stopEvent?.(event)).toBe(expected);
    }
    expect(nativeStop).toHaveBeenCalledTimes(1);
  });
});
