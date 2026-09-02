// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SocialLinks } from '@/lib/types/common/social-links';
import { useSocialLinksEditor, type UseSocialLinksEditorOptions } from './useSocialLinksEditor';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let latest!: ReturnType<typeof useSocialLinksEditor>;

function Probe(props: UseSocialLinksEditorOptions) {
  latest = useSocialLinksEditor(props);
  return null;
}

function renderProbe(props: UseSocialLinksEditorOptions) {
  act(() => {
    root.render(<Probe {...props} />);
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.clearAllMocks();
});

describe('useSocialLinksEditor', () => {
  it('normalizes added editor rows into ordered numeric URL keys', () => {
    const onChange = vi.fn();
    renderProbe({ value: {}, onChange });

    act(() => latest.addLink());
    act(() => latest.updateLink(0, 'platform', 'instagram'));
    act(() => latest.updateLink(0, 'value', '@example-studio'));
    act(() => latest.addLink());
    act(() => latest.updateLink(1, 'platform', 'facebook'));
    act(() => latest.updateLink(1, 'value', 'https://facebook.com/example-studio'));

    expect(latest.items).toEqual([
      { key: '', platform: 'instagram', value: '@example-studio' },
      { key: '', platform: 'facebook', value: 'https://facebook.com/example-studio' },
    ]);
    expect(onChange).toHaveBeenLastCalledWith({
      '0': 'https://instagram.com/example-studio',
      '1': 'https://facebook.com/example-studio',
    });
  });

  it('syncs when the parent provides a different value object', () => {
    const onChange = vi.fn();
    const first: SocialLinks = { instagram: 'https://instagram.com/first' };
    const next: SocialLinks = { '0': 'https://github.com/example-studio' };

    renderProbe({ value: first, onChange });
    expect(latest.items).toEqual([{ key: 'instagram', platform: 'instagram', value: 'https://instagram.com/first' }]);

    renderProbe({ value: next, onChange });

    expect(latest.items).toEqual([{ key: '0', platform: 'github', value: 'https://github.com/example-studio' }]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps duplicate platforms and reorders them by index', () => {
    const onChange = vi.fn();
    renderProbe({
      value: {
        '0': 'https://facebook.com/first',
        '1': 'https://facebook.com/second',
        '2': 'https://instagram.com/third',
      },
      onChange,
    });

    act(() => latest.moveLink(2, 0));

    expect(latest.items.map(({ value }) => value)).toEqual([
      'https://instagram.com/third',
      'https://facebook.com/first',
      'https://facebook.com/second',
    ]);
    expect(onChange).toHaveBeenLastCalledWith({
      '0': 'https://instagram.com/third',
      '1': 'https://facebook.com/first',
      '2': 'https://facebook.com/second',
    });
  });

  it('guards max count and invalid move indexes without emitting changes', () => {
    const onChange = vi.fn();
    renderProbe({
      value: { '0': 'https://github.com/example-studio' },
      onChange,
      maxLinks: 1,
    });

    act(() => latest.addLink());
    act(() => latest.moveLink(0, 0));
    act(() => latest.moveLink(-1, 0));
    act(() => latest.moveLink(0, 4));

    expect(latest.canAddMore).toBe(false);
    expect(latest.items).toHaveLength(1);
    expect(onChange).not.toHaveBeenCalled();
  });
});
