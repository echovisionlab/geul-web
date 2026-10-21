import { expect, it, vi } from 'vitest';
import {
  createExecutableSelectionMenuRegistry,
  type ExecutableSelectionMenuBinding,
} from './ExecutableSelectionMenuRegistry';
import { DEFAULT_DISPLAY_SIZE_LABELS } from '../map-external/DisplaySizeMenuActions';

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
  ...DEFAULT_DISPLAY_SIZE_LABELS,
};

function binding(): ExecutableSelectionMenuBinding {
  return {
    snapshot: { blockType: 'p5Sketch', mode: 'edit', running: false, textAlignment: 'left', displaySize: 100, labels },
    commands: {
      setMode: vi.fn(),
      run: vi.fn(),
      stop: vi.fn(),
      restart: vi.fn(),
      setAlignment: vi.fn(),
      setDisplaySize: vi.fn(),
      deleteBlock: vi.fn(),
    },
  };
}

it('keeps registry bindings editor-instance local and cleans the exact binding only', () => {
  const registry = createExecutableSelectionMenuRegistry();
  const first = binding();
  const second = binding();
  const unregisterFirst = registry.register('block', first);
  registry.register('block', second);
  unregisterFirst();
  expect(registry.get('block')).toBe(second);
});
