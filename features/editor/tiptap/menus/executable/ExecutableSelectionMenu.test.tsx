// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import { ExecutableSelectionMenu } from './ExecutableSelectionMenu';
import {
  createExecutableSelectionMenuRegistry,
  type ExecutableSelectionMenuBinding,
} from './ExecutableSelectionMenuRegistry';

const labels = {
  menu: 'p5.js sketch',
  edit: 'Edit',
  source: 'Source',
  preview: 'Preview',
  run: 'Run',
  stop: 'Stop',
  restart: 'Restart',
  deleteBlock: 'Delete',
  alignment: 'Alignment',
  alignLeft: 'Align left',
  alignCenter: 'Align center',
  alignRight: 'Align right',
};

function binding(): ExecutableSelectionMenuBinding {
  return {
    snapshot: { blockType: 'p5Sketch', mode: 'edit', running: false, textAlignment: 'left', labels },
    commands: {
      setMode: vi.fn(),
      run: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      setAlignment: vi.fn(),
      deleteBlock: vi.fn(),
    },
  };
}

describe('executable selection menu', () => {
  it('keeps registry bindings editor-instance local and cleans the exact binding only', () => {
    const registry = createExecutableSelectionMenuRegistry();
    const first = binding();
    const second = binding();
    const unregisterFirst = registry.register('block', first);
    registry.register('block', second);
    unregisterFirst();
    expect(registry.get('block')).toBe(second);
  });

  it('cycles every action with Tab and Escape restores the editor callback', async () => {
    const onEscape = vi.fn();
    const editorElement = document.createElement('div');
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    await act(async () => {
      root.render(
        <MantineProvider>
          <ExecutableSelectionMenu binding={binding()} editorElement={editorElement} onEscape={onEscape} />
        </MantineProvider>,
      );
    });
    const actions = [...element.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
    actions[0]!.focus();
    await act(async () => actions[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(onEscape).toHaveBeenCalledTimes(1);
    await act(async () => actions[0]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
    expect(document.activeElement).toBe(actions[1]);
    for (let index = 1; index < actions.length; index += 1) {
      await act(async () =>
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })),
      );
    }
    expect(document.activeElement).toBe(actions[0]);
    await act(async () => root.unmount());
    element.remove();
  });
});
