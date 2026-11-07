// @vitest-environment jsdom

import { act, createRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LayoutContainer,
  LayoutGrid,
  LayoutGridItem,
  LayoutInline,
  LayoutInset,
  LayoutSpacer,
  LayoutStack,
} from './Layout';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
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

  it('keeps draft state, native events and refs when the layout contract changes', () => {
    const ref = createRef<HTMLElement>();
    function Example() {
      const [gap, setGap] = useState<'sm' | 'lg'>('sm');
      const [draft, setDraft] = useState('draft');
      return (
        <LayoutStack ref={ref} as="section" gap={gap} aria-label="Content">
          <input aria-label="Draft" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} />
          <LayoutInline onClick={() => setGap('lg')}>
            <button type="button">Change spacing</button>
          </LayoutInline>
        </LayoutStack>
      );
    }
    act(() => root.render(<Example />));
    const input = container.querySelector('input');
    act(() => container.querySelector('button')?.click());
    expect(ref.current?.tagName).toBe('SECTION');
    expect(ref.current?.style.getPropertyValue('--_layout-gap-base')).toBe('var(--geul-spacing-lg)');
    expect(container.querySelector('input')).toBe(input);
    expect(input?.value).toBe('draft');
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

  it('separates inset axes, uses the approved container width authority and hides structural spacers', () => {
    act(() =>
      root.render(
        <LayoutContainer size="compact" inset="none" hidden>
          <LayoutInset space="sm" inline={{ md: 'lg' }}>
            <LayoutSpacer axis="inline" size="xxs" flexible />
          </LayoutInset>
        </LayoutContainer>,
      ),
    );
    const frame = container.querySelector<HTMLElement>('[data-geul-layout="container"]');
    const inset = container.querySelector<HTMLElement>('[data-geul-layout="inset"]');
    const spacer = container.querySelector<HTMLElement>('[data-geul-layout="spacer"]');
    expect(frame?.hidden).toBe(true);
    expect(frame?.style.getPropertyValue('--_layout-container-width')).toBe(primitiveTokens.contentWidth.compact);
    expect(inset?.style.getPropertyValue('--_layout-inset-block-start-md')).toBe('var(--geul-spacing-sm)');
    expect(inset?.style.getPropertyValue('--_layout-inset-inline-md')).toBe('var(--geul-spacing-lg)');
    expect(spacer?.getAttribute('aria-hidden')).toBe('true');
    expect(spacer?.getAttribute('data-geul-layout-flexible')).toBe('true');
  });
  it('keeps a one-edge inset from adding implicit padding to other edges', () => {
    act(() => root.render(<LayoutInset blockEnd="md" />));
    const inset = container.querySelector<HTMLElement>('[data-geul-layout="inset"]')!;
    expect(inset.style.getPropertyValue('--_layout-inset-block-start-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-inline-start-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-inline-end-base')).toBe('0');
    expect(inset.style.getPropertyValue('--_layout-inset-block-end-base')).toBe('var(--geul-spacing-md)');
  });
  it('projects responsive orientation, wrap and alignment independently of viewport state', () => {
    act(() =>
      root.render(
        <LayoutInline
          direction={{ base: 'column', sm: 'row' }}
          wrap={{ base: 'wrap', md: 'nowrap' }}
          justify={{ base: 'start', sm: 'between' }}
          printFlow="stack"
        />,
      ),
    );
    const inline = container.querySelector<HTMLElement>('[data-geul-layout="inline"]')!;
    expect(inline.style.getPropertyValue('--_layout-direction-xs')).toBe('column');
    expect(inline.style.getPropertyValue('--_layout-direction-sm')).toBe('row');
    expect(inline.style.getPropertyValue('--_layout-wrap-md')).toBe('nowrap');
    expect(inline.style.getPropertyValue('--_layout-justify-sm')).toBe('space-between');
    expect(inline.dataset.geulLayoutPrintFlow).toBe('stack');
  });
  it('validates new structural state at runtime and admits actual 5/6-column content', () => {
    const markup = renderToStaticMarkup(
      <LayoutGrid columns={{ base: 5, sm: 6 }} rows="stretch" fill="both" flexible clip />,
    );
    expect(markup).toContain('--_layout-columns-base:5');
    expect(markup).toContain('data-geul-layout-rows="stretch"');
    expect(markup).toContain('data-geul-layout-clip="true"');
    expect(() =>
      renderToStaticMarkup(<LayoutStack {...({ clip: 'hidden' } as unknown as LayoutStackProps)} />),
    ).toThrow('clip');
    expect(() => renderToStaticMarkup(<LayoutStack {...({ order: 7 } as unknown as LayoutStackProps)} />)).toThrow(
      'order',
    );
  });
});
