// @vitest-environment jsdom

import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SectionContent } from './SectionContent';
import type { SectionMeta } from './types';

const state = vi.hoisted(() => ({ editable: true, mountedEditor: vi.fn(), getBlockDefinition: vi.fn() }));
vi.mock('./PageEditorContext', () => ({
  usePageEditor: () => ({ editable: state.editable, mergeSection: (section: SectionMeta) => section }),
}));
vi.mock('@/features/page/blocks/registry', () => ({
  getBlockDefinition: state.getBlockDefinition,
  getBlockEditor: () => () => {
    state.mountedEditor();
    return <button type="button">Create place</button>;
  },
}));

let root: Root | null = null;
let container: HTMLDivElement;
function render(element: ReactNode) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(element));
  return {
    container,
    getByText: (text: string) => [...container.querySelectorAll('*')].find((node) => node.textContent === text),
    queryByText: (text: string) =>
      [...container.querySelectorAll('*')].find((node) => node.textContent === text) ?? null,
  };
}
function cleanup() {
  act(() => root?.unmount());
  container?.remove();
  root = null;
}

beforeEach(() => {
  state.editable = true;
  state.mountedEditor.mockClear();
  state.getBlockDefinition.mockReturnValue({ CanvasPreview: () => <div>Map preview</div> });
});
afterEach(cleanup);

describe('SectionContent authority', () => {
  const section = { id: 'map-section', type: 'map', props: {} } as SectionMeta;
  it('keeps read-only nested blocks out of mutation-capable editors', () => {
    state.editable = false;
    const view = render(<SectionContent section={section} />);
    expect(view.getByText('Map preview')).toBeTruthy();
    expect(view.queryByText('Create place')).toBeNull();
    expect(state.mountedEditor).not.toHaveBeenCalled();
  });
  it('mounts the editor when the room is editable', () => {
    const view = render(<SectionContent section={section} />);
    expect(view.getByText('Create place')).toBeTruthy();
    expect(state.mountedEditor).toHaveBeenCalled();
  });
});
