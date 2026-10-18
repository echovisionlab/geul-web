// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LayoutGrid, LayoutGridItem, LayoutInset, LayoutStack } from './Layout';
import type { LayoutStackProps } from './index';
import { isSpace, projectLayoutAttributes, resolveResponsive } from './layout-contract';

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('Core Layout contract', () => {
  it('carries responsive scale choices forward without accepting local spacing or breakpoints', () => {
    expect(resolveResponsive({ base: 'xxs', md: 'lg' }, 'md', isSpace, 'gap')).toEqual({
      base: 'xxs',
      xs: 'xxs',
      sm: 'xxs',
      md: 'lg',
      lg: 'lg',
      xl: 'lg',
    });
    expect(() => renderToStaticMarkup(<LayoutStack {...({ gap: '7px' } as unknown as LayoutStackProps)} />)).toThrow(
      'supported named values',
    );
    expect(() =>
      renderToStaticMarkup(<LayoutStack {...({ gap: { handheld: 'sm' } } as unknown as LayoutStackProps)} />),
    ).toThrow('breakpoints');
  });

  it('projects safe attributes while rejecting visual and reserved marker escapes at runtime', () => {
    const onClick = vi.fn();
    expect(
      projectLayoutAttributes({
        style: {},
        className: 'alternate',
        vars: {},
        gap: 7,
        'data-geul-layout': 'inline',
        'data-geul-layout-align': 'center',
        'data-record-id': '123',
        'aria-label': 'Content',
        onClick,
        onPointerDown: 'invalid',
        id: 'content',
      }),
    ).toEqual({ 'data-record-id': '123', 'aria-label': 'Content', onClick, id: 'content' });
    const markup = renderToStaticMarkup(
      <LayoutStack
        {...({
          gap: 'sm',
          style: { background: 'var(--geul-status-danger)' },
          className: 'alternate',
          'data-geul-layout': 'inset',
          'data-geul-layout-align': 'center',
          'data-record-id': '123',
        } as unknown as LayoutStackProps)}
      />,
    );
    expect(markup).toContain('data-geul-layout="stack"');
    expect(markup).toContain('data-geul-layout-align="stretch"');
    expect(markup).toContain('var(--geul-spacing-sm)');
    expect(markup).not.toContain('background:');
    expect(markup).not.toContain('alternate');
  });

  it('preserves the actual 12-column event spans and resolves full spans against responsive parents', () => {
    act(() =>
      root.render(
        <LayoutGrid columns={12} gap="xl">
          <LayoutGridItem span={{ base: 12, md: 7 }}>Details</LayoutGridItem>
          <LayoutGridItem span={{ base: 12, md: 5 }}>Poster</LayoutGridItem>
        </LayoutGrid>,
      ),
    );
    const items = container.querySelectorAll<HTMLElement>('[data-geul-layout="grid-item"]');
    expect(items[0].style.getPropertyValue('--_layout-span-base')).toBe('12');
    expect(items[0].style.getPropertyValue('--_layout-span-md')).toBe('7');
    expect(items[1].style.getPropertyValue('--_layout-span-md')).toBe('5');
    act(() =>
      root.render(
        <LayoutGrid columns={{ base: 1, sm: 2, lg: 3 }}>
          <LayoutGridItem span="full" />
        </LayoutGrid>,
      ),
    );
    const full = container.querySelector<HTMLElement>('[data-geul-layout="grid-item"]');
    expect(full?.style.getPropertyValue('--_layout-span-base')).toBe('1');
    expect(full?.style.getPropertyValue('--_layout-span-lg')).toBe('3');
  });

  it('rejects orphan items and span/offset combinations that exceed the real parent', () => {
    expect(() => renderToStaticMarkup(<LayoutGridItem />)).toThrow('inside LayoutGrid');
    expect(() =>
      renderToStaticMarkup(
        <LayoutGrid columns={2}>
          <LayoutGridItem span={3} />
        </LayoutGrid>,
      ),
    ).toThrow('exceed');
    expect(() =>
      renderToStaticMarkup(
        <LayoutGrid columns={{ base: 1, md: 3 }}>
          <LayoutGridItem span={{ base: 1, md: 3 }} offset={{ md: 1 }} />
        </LayoutGrid>,
      ),
    ).toThrow('at md');
  });
  it('keeps a one-edge inset from adding implicit padding to other edges', () => {
    act(() => root.render(<LayoutInset blockEnd="md" />));
    const inset = container.querySelector<HTMLElement>('[data-geul-layout="inset"]')!;
    expect(inset.style.getPropertyValue('--_layout-inset-block-start-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-inline-start-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-inline-end-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-block-end-base')).toBe('var(--geul-spacing-md)');
  });
});
