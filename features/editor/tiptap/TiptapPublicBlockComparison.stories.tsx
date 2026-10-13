import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, waitFor, userEvent } from 'storybook/test';
import { DOCUMENT_COLOR_VALUES } from '@/components/core/DocumentColorPreview';
import { EditorAuthoringModeProvider } from '@/features/editor/EditorAuthoringMode';
import { materializeLocalizedRichTextTree } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import { MapPlaceActionProvider } from '@/lib/contexts/MapPlaceActionContext';
import { semanticThemes } from '@/components/core/design-tokens';
import { getThemeTokens } from '@/lib/theme/themes';
import { TiptapEditor } from './TiptapEditor';
import { createTiptapPlaygroundRoom } from './TiptapPlayground.story-fixtures';
import { createPublicBlockComparisonDocument } from './public-block-comparison-fixtures';
import { colorBlockId, createDocumentColorComparisonDocument } from './document-color-comparison-fixtures';
import classes from './TiptapPublicBlockComparison.module.css';

const unavailableMapPlaceAction = async () => null;
const authoringMode = { allowNeutralBlockEdits: true, allowLocalizedBlockEdits: true };
const localUser = { name: 'Comparison', color: semanticThemes.light['action-primary'] };

function Comparison({ includeRuntimes = false, colors = false }: { includeRuntimes?: boolean; colors?: boolean }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false } } }));
  const [room, setRoom] = useState<ReturnType<typeof createTiptapPlaygroundRoom> | null>(null);
  const [blocks, setBlocks] = useState<ReturnType<typeof materializeLocalizedRichTextTree>>([]);
  useEffect(() => {
    const current = createTiptapPlaygroundRoom(
      colors ? createDocumentColorComparisonDocument() : createPublicBlockComparisonDocument(includeRuntimes),
    );
    setRoom(current);
    const update = () => setBlocks(materializeLocalizedRichTextTree(current.controller.getLocalizedDocumentSnapshot()));
    update();
    const unobserve = current.bridge.observe(update);
    return () => {
      unobserve();
      current.awareness.destroy();
      current.document.destroy();
      queryClient.clear();
    };
  }, [includeRuntimes, colors, queryClient]);
  if (!room) {
    return null;
  }
  return (
    <QueryClientProvider client={queryClient}>
      <ContentBlockMediaRuntimeProvider items={[]}>
        <MapPlaceActionProvider createMapPlaceForBlock={unavailableMapPlaceAction}>
          <EditorAuthoringModeProvider value={authoringMode}>
            <div className={classes.root}>
              <div className={classes.grid}>
                <section className={classes.panel} data-comparison="editor">
                  <div className={classes.heading}>Tiptap</div>
                  <div className={classes.surface}>
                    <TiptapEditor
                      blockRoomController={room.controller}
                      awareness={room.awareness}
                      localUser={localUser}
                      ai={false}
                      authoringCapabilities={{ ai: false, file: false, map: false }}
                    />
                  </div>
                </section>
                <section className={classes.panel} data-comparison="public">
                  <div className={classes.heading}>Post / Page</div>
                  <article className={`prose ${classes.surface} ${classes.publicSurface}`}>
                    {blocks.map((block) => (
                      <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale="ko" />
                    ))}
                  </article>
                </section>
              </div>
            </div>
          </EditorAuthoringModeProvider>
        </MapPlaceActionProvider>
      </ContentBlockMediaRuntimeProvider>
    </QueryClientProvider>
  );
}

const meta = {
  title: 'Feature/Editor/Public Block Comparison',
  component: Comparison,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Comparison>;
export default meta;
type Story = StoryObj<typeof meta>;
/** Resolves a spacing role to pixels in the rendered document. */
function spacing(element: Element, role: 'xs' | 'md' | 'xl') {
  const probe = element.ownerDocument.createElement('div');
  probe.style.marginTop = `var(--geul-spacing-${role})`;
  element.append(probe);
  const value = Number.parseFloat(getComputedStyle(probe).marginTop);
  probe.remove();
  return value;
}

/**
 * The gap above each block that follows a visible sibling, keyed by block id, with the previous block's id
 * and kind. An empty published draft (zero height) is skipped together with the block after it.
 */
function gapsAbove(blocks: Element[], idOf: (block: Element) => string | null, kindOf: (block: Element) => string) {
  const visible = (block: Element) => block.getBoundingClientRect().height > 0;
  return new Map(
    blocks.slice(1).flatMap((block, index) => {
      const previous = blocks[index]!;
      if (!visible(block) || !visible(previous)) {
        return [];
      }
      return [
        [
          idOf(block),
          {
            previous: idOf(previous),
            kinds: [kindOf(previous), kindOf(block)] as const,
            gap: block.getBoundingClientRect().top - previous.getBoundingClientRect().bottom,
          },
        ] as const,
      ];
    }),
  );
}

/**
 * One block rhythm in the editor and the published view: `md` between blocks, `xs` between items of one
 * list and below a heading, `xl` above a heading that follows content. Gaps are compared by block id.
 */
async function checkBlockRhythm(canvasElement: HTMLElement) {
  const published = canvasElement.querySelector<HTMLElement>('[data-comparison="public"] .prose')!;
  const editorGroup = canvasElement.querySelector<HTMLElement>('[data-comparison="editor"] .editor-block-group')!;
  const [xs, md, xl] = (['xs', 'md', 'xl'] as const).map((role) => spacing(published, role));
  const publishedGaps = gapsAbove(
    [...published.querySelectorAll(':scope > [data-document-block]')],
    (block) => block.getAttribute('data-id'),
    (block) => block.getAttribute('data-document-block') ?? '',
  );
  const editorGaps = gapsAbove(
    [...editorGroup.children],
    (block) => block.firstElementChild?.getAttribute('data-id') ?? null,
    (block) => block.firstElementChild?.getAttribute('data-container-kind') ?? '',
  );
  let compared = 0;
  for (const [id, { previous, kinds, gap }] of publishedGaps) {
    const [before, current] = kinds;
    const expected =
      current === 'heading'
        ? xl
        : before === 'heading' || (before === current && before.endsWith('list-item'))
          ? xs
          : md;
    expect(Math.abs(gap - expected), `${before} → ${current}`).toBeLessThan(0.5);
    const editor = editorGaps.get(id);
    // Blank drafts are not published, so a block can follow a different neighbour in each view.
    if (editor && editor.previous === previous) {
      expect(Math.abs(editor.gap - gap), `editor ${before} → ${current}`).toBeLessThan(0.5);
      compared += 1;
    }
  }
  expect(compared).toBeGreaterThan(15);
}

const checkAuthoredComparison: NonNullable<Story['play']> = async ({ canvasElement }) => {
  for (const side of ['editor', 'public']) {
    const tables = await waitFor(() => {
      const rendered = canvasElement.querySelectorAll<HTMLTableElement>(`[data-comparison='${side}'] table`);
      expect(rendered).toHaveLength(2);
      return rendered;
    });
    for (const table of tables) {
      expect(Array.from(table.querySelectorAll('th'), (cell) => cell.textContent?.trim())).toEqual(['열 1', '열 2']);
    }
    expect(Array.from(tables[0]!.querySelectorAll('td')).every((cell) => cell.textContent?.trim())).toBe(true);
    const emptyCells = tables[1]!.querySelectorAll('td');
    expect(emptyCells).toHaveLength(4);
    expect(Array.from(emptyCells).every((cell) => cell.textContent?.trim() === '')).toBe(true);
  }
  const published = canvasElement.querySelector<HTMLElement>('[data-comparison="public"]')!;
  const headings = published.querySelectorAll('[data-document-block="heading"] > :is(h1, h2, h3)');
  expect(headings).toHaveLength(3);
  expect(Array.from(headings).every((heading) => heading.textContent?.trim())).toBe(true);
  const tasks = published.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
  expect(tasks).toHaveLength(1);
  expect(tasks[0]).toHaveAccessibleName('완료한 항목');
  expect(tasks[0]).toHaveAttribute('aria-readonly', 'true');
  expect(published.querySelector('[data-document-block="heading"]')).not.toBeNull();
  for (const side of ['editor', 'public']) {
    const mathScrolls = await waitFor(() => {
      const viewports = canvasElement.querySelectorAll<HTMLElement>(`[data-comparison="${side}"] [data-math-scroll]`);
      expect(viewports).toHaveLength(2);
      return viewports;
    });
    for (const mathScroll of mathScrolls) {
      expect(mathScroll).toHaveAttribute('tabindex', '0');
      mathScroll.focus();
      expect(mathScroll).toHaveFocus();
      expect(mathScroll.querySelector('math mfrac')).not.toBeNull();
      expect(mathScroll.querySelector('math')!.closest('button, [role="button"], [aria-hidden="true"]')).toBeNull();
    }
    expect(mathScrolls[1]!.scrollWidth).toBeGreaterThan(mathScrolls[1]!.clientWidth);
    // Scan the successful authored diagram after its real SVG image has loaded.
    await waitFor(
      () => {
        const diagram = canvasElement.querySelector<HTMLElement>(
          `[data-comparison="${side}"] div[role="img"][data-mermaid-status="ready"]`,
        );
        expect(diagram).not.toBeNull();
        const image = diagram!.querySelector<HTMLImageElement>('img');
        expect(image).not.toBeNull();
        expect(image!.complete).toBe(true);
        expect(image!.naturalWidth).toBeGreaterThan(0);
      },
      { timeout: 10_000 },
    );
  }
  await checkBlockRhythm(canvasElement);
};
export const TypographyAndSpacing: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Compares actual editor and public typography, including authored table headings with populated and empty body cells, blank text drafts, and keyboard-reachable math overflow. Blank header drafts are not published comparison fixtures.',
      },
    },
  },
  play: checkAuthoredComparison,
};
export const AllBlocks: Story = {
  args: { includeRuntimes: true },
  play: async (context) => {
    await checkAuthoredComparison(context);
    // Await the actual lazy public adapters before the accessibility pass.
    await waitFor(() => {
      for (const type of ['p5Sketch', 'threeScene', 'shader']) {
        expect(
          context.canvasElement.querySelector(
            `[data-comparison="public"] [data-editor-mode="public"][data-content-type="${type}"]`,
          ),
        ).not.toBeNull();
      }
    });
  },
};

export const DocumentColors: Story = {
  args: { colors: true },
  play: async ({ canvasElement, globals }) => {
    const palette = getThemeTokens(globals.theme);
    const rgb = (hex: string) =>
      `rgb(${[1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).join(', ')})`;
    const block = (side: 'editor' | 'public', index: number) =>
      canvasElement.querySelector<HTMLElement>(`[data-comparison='${side}'] [data-id='${colorBlockId(index)}'] p`)!;
    await waitFor(() => expect(block('public', 19)).not.toBeNull());
    await waitFor(() => expect(block('editor', 19)).not.toBeNull());
    for (const [index, color] of DOCUMENT_COLOR_VALUES.entries()) {
      const editor = block('editor', index * 2);
      const published = block('public', index * 2);
      for (const node of [editor, published]) {
        expect(getComputedStyle(node).color).toBe(rgb(palette[`document-text-${color}`]));
        expect(getComputedStyle(node).backgroundColor).toBe(
          color === 'default' ? 'rgba(0, 0, 0, 0)' : rgb(palette[`document-background-${color}`]),
        );
      }
      if (color !== 'default') {
        const inlineEditor = block('editor', index * 2 + 1);
        const inlinePublic = block('public', index * 2 + 1);
        expect(getComputedStyle(inlineEditor.querySelector('[data-style-type="textColor"]')!).color).toBe(
          getComputedStyle(inlinePublic.querySelector('[data-text-color]')!).color,
        );
        expect(
          getComputedStyle(inlineEditor.querySelector('[data-style-type="backgroundColor"]')!).backgroundColor,
        ).toBe(getComputedStyle(inlinePublic.querySelector('[data-bg-color]')!).backgroundColor);
      }
    }
    for (const side of ['editor', 'public'] as const) {
      const cells = await waitFor(() => {
        const nodes = canvasElement.querySelectorAll<HTMLElement>(
          `[data-comparison='${side}'] [data-id='${colorBlockId(20)}'] td`,
        );
        expect(nodes).toHaveLength(DOCUMENT_COLOR_VALUES.length);
        return nodes;
      });
      for (const [index, color] of DOCUMENT_COLOR_VALUES.entries()) {
        expect(getComputedStyle(cells[index]!).color).toBe(rgb(palette[`document-text-${color}`]));
        if (color !== 'default') {
          expect(getComputedStyle(cells[index]!).backgroundColor).toBe(rgb(palette[`document-background-${color}`]));
        }
      }
    }
    // Exercise the actual editor bubble menu and verify its mutation reaches the public snapshot.
    const sample = block('editor', 1);
    await userEvent.click(sample);
    const selection = canvasElement.ownerDocument.getSelection()!;
    const range = canvasElement.ownerDocument.createRange();
    range.selectNodeContents(sample);
    selection.removeAllRanges();
    selection.addRange(range);
    canvasElement.ownerDocument.dispatchEvent(new Event('selectionchange'));
    const textTrigger = await waitFor(() => {
      const trigger = canvasElement.querySelector<HTMLButtonElement>('[data-test="text-colors"]');
      expect(trigger).not.toBeNull();
      return trigger!;
    });
    await userEvent.click(textTrigger);
    await userEvent.click(
      await waitFor(() => {
        const item = canvasElement.querySelector<HTMLElement>('[data-test="text-color-blue"]');
        expect(item).not.toBeNull();
        return item!;
      }),
    );
    await waitFor(() => {
      const published = block('public', 1).querySelector('[data-text-color="blue"]');
      expect(published).not.toBeNull();
      expect(getComputedStyle(published!).color).toBe(rgb(palette['document-text-blue']));
    });
    const backgroundTrigger = canvasElement.querySelector<HTMLButtonElement>('[data-test="background-colors"]')!;
    await userEvent.click(backgroundTrigger);
    await userEvent.click(
      await waitFor(() => {
        const item = canvasElement.querySelector<HTMLElement>('[data-test="background-color-yellow"]');
        expect(item).not.toBeNull();
        return item!;
      }),
    );
    await waitFor(() => {
      const published = block('public', 1).querySelector('[data-bg-color="yellow"]');
      expect(published).not.toBeNull();
      expect(getComputedStyle(published!).backgroundColor).toBe(rgb(palette['document-background-yellow']));
    });
  },
};
