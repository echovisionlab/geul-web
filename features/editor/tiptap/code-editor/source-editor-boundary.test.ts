// @vitest-environment jsdom

import { isMonacoSourceEditorEvent, isMonacoSourceEditorTarget } from './source-editor-boundary';

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
});
