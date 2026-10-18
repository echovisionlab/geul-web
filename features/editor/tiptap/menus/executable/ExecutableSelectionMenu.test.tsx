// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

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

  it('cancels the target mouse press before React Aria can bypass the toolbar selection guard', async () => {
    const editorElement = document.createElement('div');
    const element = document.createElement('div');
    document.body.append(element);
    const root = createRoot(element);
    const shader = binding();
    shader.snapshot.blockType = 'shader';
    shader.snapshot.mode = 'preview';
    try {
      await act(async () => {
        root.render(
          <DesignSystemProvider forceColorScheme="light">
            <ExecutableSelectionMenu binding={shader} editorElement={editorElement} onEscape={() => {}} />
          </DesignSystemProvider>,
        );
      });
      const source = element.querySelector<HTMLButtonElement>('[data-testid="tiptap-executable-align-center"]')!;
      const pointerDown = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
      await act(async () => {
        source.dispatchEvent(pointerDown);
      });
      expect(pointerDown.defaultPrevented).toBe(true);
      const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true, button: 0 });
      await act(async () => {
        source.dispatchEvent(mouseDown);
      });
      expect(mouseDown.defaultPrevented).toBe(true);
      await act(async () => {
        source.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
        source.click();
      });
      expect(shader.commands.setAlignment).toHaveBeenCalledExactlyOnceWith('center');
    } finally {
      await act(async () => root.unmount());
      element.remove();
    }
  });
});
