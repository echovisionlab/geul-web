// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from './GeneratedRichTextBlockViewRuntime';
import { DefaultBlockView } from './DefaultBlockView';
import { DefaultMathBlockView } from './DefaultMathBlockView';
import { GeneratedMathBlockView } from './GeneratedMathBlockView';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(element: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(<TestProviders>{element}</TestProviders>));
  return host;
}

describe('Public checklist semantics', () => {
  it.each(['generated', 'materialized'] as const)(
    'keeps %s math structured inside a keyboard-reachable horizontal viewport',
    (format) => {
      const latex = '\\frac{x}{y}';
      const host = render(
        format === 'generated' ? (
          <GeneratedMathBlockView
            block={
              {
                id: 'math',
                kind: 'math',
                base: { props: { latex } },
                locale: {},
                children: [],
              } as unknown as Parameters<typeof GeneratedMathBlockView>[0]['block']
            }
          />
        ) : (
          <DefaultMathBlockView block={{ id: 'math', type: 'math', props: { latex }, content: [], children: [] }} />
        ),
      );
      const scroll = host.querySelector<HTMLElement>('[data-math-scroll]')!;
      expect(scroll).toHaveAttribute('data-scrollbars', 'x');
      expect(scroll).toHaveAttribute('tabindex', '0');
      expect(scroll.hasAttribute('aria-label')).toBe(false);
      const math = scroll.querySelector('math')!;
      expect(math.querySelector('mfrac')).not.toBeNull();
      expect(math.closest('button, [role="button"], [role="img"], [aria-hidden="true"]')).toBeNull();
      scroll.focus();
      expect(scroll).toHaveFocus();
      const arrow = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true });
      expect(scroll.dispatchEvent(arrow)).toBe(true);
      expect(arrow.defaultPrevented).toBe(false);
      expect(host.querySelector('[data-latex]')).toHaveAttribute('data-latex', latex);
    },
  );
  it.each(['generated', 'materialized'] as const)(
    'keeps blank %s drafts durable without publishing unnamed headings or task controls',
    (format) => {
      const source =
        format === 'generated'
          ? {
              id: 'blank-heading',
              kind: 'heading',
              base: { props: { level: 2 } },
              locale: { content: [{ value: { case: 'text', value: { text: ' \n ' } } }] },
              children: [],
            }
          : {
              id: 'blank-heading',
              type: 'heading',
              props: { level: 2 },
              content: [{ type: 'text', text: ' \n ', styles: {} }],
              children: [],
            };
      const task =
        format === 'generated'
          ? {
              id: 'blank-task',
              kind: 'check-list-item',
              base: { props: { checked: true } },
              locale: { content: [] },
              children: [],
            }
          : { id: 'blank-task', type: 'checkListItem', props: { checked: true }, content: [], children: [] };
      const before = JSON.stringify([source, task]);
      const host = render(
        format === 'generated' ? (
          <>
            <GeneratedRichTextBlockView block={source as unknown as LocalizedRichTextBlock} />
            <GeneratedRichTextBlockView block={task as unknown as LocalizedRichTextBlock} />
          </>
        ) : (
          <>
            <DefaultBlockView block={source as unknown as Parameters<typeof DefaultBlockView>[0]['block']} />
            <DefaultBlockView block={task as unknown as Parameters<typeof DefaultBlockView>[0]['block']} />
          </>
        ),
      );
      expect(host.querySelector('[data-id="blank-heading"]')).not.toBeNull();
      expect(host.querySelector('[data-id="blank-task"]')).not.toBeNull();
      expect(host.querySelector('h1, h2, h3, input[type="checkbox"]')).toBeNull();
      expect(host.textContent?.trim()).toBe('');
      expect(JSON.stringify([source, task])).toBe(before);
    },
  );

  it.each(['generated', 'materialized'] as const)(
    'does not discard %s nested content beneath a blank heading',
    (format) => {
      const host = render(
        format === 'generated' ? (
          <GeneratedRichTextBlockView
            block={
              {
                id: 'blank-parent',
                kind: 'heading',
                base: { props: { level: 2 } },
                locale: { content: [] },
                children: [
                  {
                    id: 'child',
                    kind: 'paragraph',
                    base: { props: {} },
                    locale: { content: [{ value: { case: 'text', value: { text: 'Nested body' } } }] },
                    children: [],
                  },
                ],
              } as unknown as LocalizedRichTextBlock
            }
          />
        ) : (
          <DefaultBlockView
            block={{
              id: 'blank-parent',
              type: 'heading',
              props: { level: 2 },
              content: [],
              children: [
                {
                  id: 'child',
                  type: 'paragraph',
                  props: {},
                  content: [{ type: 'text', text: 'Nested body', styles: {} }],
                  children: [],
                },
              ],
            }}
          />
        ),
      );
      expect(host.querySelector('h2')).toBeNull();
      expect(host.querySelector('[data-document-children] [data-id="child"]')).toHaveTextContent('Nested body');
    },
  );

  it.each(['generated', 'materialized'] as const)('keeps labelled %s link headings and task names', (format) => {
    const content =
      format === 'generated'
        ? [{ value: { case: 'link', value: { href: 'https://example.com', content: [{ text: 'Recording rights' }] } } }]
        : [
            {
              type: 'link',
              href: 'https://example.com',
              content: [{ type: 'text', text: 'Recording rights', styles: {} }],
            },
          ];
    const host = render(
      format === 'generated' ? (
        <>
          <GeneratedRichTextBlockView
            block={
              {
                id: 'link-heading',
                kind: 'heading',
                base: { props: { level: 2 } },
                locale: { content },
                children: [],
              } as unknown as LocalizedRichTextBlock
            }
          />
          <GeneratedRichTextBlockView
            block={
              {
                id: 'link-task',
                kind: 'check-list-item',
                base: { props: {} },
                locale: { content },
                children: [],
              } as unknown as LocalizedRichTextBlock
            }
          />
        </>
      ) : (
        <>
          <DefaultBlockView
            block={
              {
                id: 'link-heading',
                type: 'heading',
                props: { level: 2 },
                content,
                children: [],
              } as unknown as Parameters<typeof DefaultBlockView>[0]['block']
            }
          />
          <DefaultBlockView
            block={
              { id: 'link-task', type: 'checkListItem', props: {}, content, children: [] } as unknown as Parameters<
                typeof DefaultBlockView
              >[0]['block']
            }
          />
        </>
      ),
    );
    expect(host.querySelector('h2')).toHaveTextContent('Recording rights');
    expect(host.querySelector('input[type="checkbox"]')).toHaveAccessibleName('Recording rights');
  });

  it.each(['generated', 'materialized'] as const)(
    'names %s task state from its unchanged content and prevents public edits',
    (format) => {
      const host = render(
        format === 'generated' ? (
          <GeneratedRichTextBlockView
            block={
              {
                id: 'task',
                kind: 'check-list-item',
                base: { props: { checked: true } },
                locale: { content: [{ value: { case: 'text', value: { text: 'Check the recording rights' } } }] },
                children: [],
              } as unknown as LocalizedRichTextBlock
            }
          />
        ) : (
          <DefaultBlockView
            block={{
              id: 'task',
              type: 'checkListItem',
              props: { checked: true },
              content: [{ type: 'text', text: 'Check the recording rights', styles: {} }],
              children: [],
            }}
          />
        ),
      );
      const checkbox = host.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
      expect(checkbox).toHaveAccessibleName('Check the recording rights');
      expect(checkbox).toHaveAttribute('aria-readonly', 'true');
      expect(checkbox).toBeChecked();
      act(() => checkbox.click());
      expect(checkbox).toBeChecked();
      expect(host).toHaveTextContent('Check the recording rights');
    },
  );

  it('retains generated row and column headers, spans and current cell content', () => {
    const host = render(
      <GeneratedRichTextBlockView
        block={
          {
            id: 'table',
            kind: 'table',
            children: [],
            base: {
              props: {},
              content: {
                columnWidths: [40, 60],
                rows: [
                  {
                    cells: [
                      { header: true, props: {} },
                      { header: true, props: {} },
                    ],
                  },
                  {
                    cells: [
                      { header: true, props: {} },
                      { header: false, props: {} },
                    ],
                  },
                ],
              },
            },
            locale: {
              content: {
                rows: [
                  {
                    cells: [
                      { content: [{ value: { case: 'text', value: { text: 'Location' } } }] },
                      { content: [{ value: { case: 'text', value: { text: 'Recordings' } } }] },
                    ],
                  },
                  {
                    cells: [
                      { content: [{ value: { case: 'text', value: { text: 'Seoul' } } }] },
                      { content: [{ value: { case: 'text', value: { text: '12' } } }] },
                    ],
                  },
                ],
              },
            },
          } as unknown as LocalizedRichTextBlock
        }
      />,
    );
    expect(host.querySelectorAll('th[scope="col"]')).toHaveLength(2);
    expect(host.querySelector('th[scope="row"]')).toHaveTextContent('Seoul');
    expect(host.querySelector('td')).toHaveTextContent('12');
  });
});
