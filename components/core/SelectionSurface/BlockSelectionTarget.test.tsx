// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { BlockSelectionTarget, type BlockSelectionTargetProps } from './BlockSelectionTarget';

function render(node: React.ReactNode) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  act(() => root.render(node));
  return {
    target: host.querySelector('button')!,
    cleanup: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

describe('BlockSelectionTarget', () => {
  it('names a non-editable selection target and forwards selection events', () => {
    const select = vi.fn();
    const { target, cleanup } = render(
      <BlockSelectionTarget label="Math block" onFocus={select} onClick={select} data-editor-block-selector="" />,
    );
    expect(target.getAttribute('aria-label')).toBe('Math block');
    expect(target.type).toBe('button');
    expect(target.getAttribute('contenteditable')).toBe('false');
    expect(target.dataset.geulBlockSelectionPointer).toBe('pass-through');
    expect(target.hasAttribute('data-editor-block-selector')).toBe(true);
    act(() => target.focus());
    act(() => target.click());
    expect(select).toHaveBeenCalledTimes(2);
    cleanup();
  });

  it('keeps presentation Core-owned and rejects unnamed targets', () => {
    const hostile = { className: 'local', style: { outline: 'red' } } as unknown as BlockSelectionTargetProps;
    const { target, cleanup } = render(
      <BlockSelectionTarget {...hostile} label="Video" pointer="capture" tabIndex={-1} />,
    );
    expect(target.classList.contains('local')).toBe(false);
    expect(target.getAttribute('style')).toBeNull();
    expect(target.tabIndex).toBe(-1);
    expect(target.dataset.geulBlockSelectionPointer).toBe('capture');
    cleanup();
    expect(() => render(<BlockSelectionTarget label=" " />)).toThrow('nonempty label');
  });
});
