import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';

export const PAGINATION_PAGE_GAP_PX = 12;

export const PAGINATION_PAGE_SIZES = {
  A3: {
    label: 'A3',
    width: 1123,
    height: 1587,
    marginTop: 95,
    marginRight: 76,
    marginBottom: 95,
    marginLeft: 76,
  },
  A4: {
    label: 'A4',
    width: 794,
    height: 1123,
    marginTop: 95,
    marginRight: 76,
    marginBottom: 95,
    marginLeft: 76,
  },
  A5: {
    label: 'A5',
    width: 559,
    height: 794,
    marginTop: 76,
    marginRight: 57,
    marginBottom: 76,
    marginLeft: 57,
  },
  LETTER: {
    label: 'Letter',
    width: 816,
    height: 1056,
    marginTop: 96,
    marginRight: 96,
    marginBottom: 96,
    marginLeft: 96,
  },
  LEGAL: {
    label: 'Legal',
    width: 816,
    height: 1344,
    marginTop: 96,
    marginRight: 96,
    marginBottom: 96,
    marginLeft: 96,
  },
  TABLOID: {
    label: 'Tabloid',
    width: 1056,
    height: 1632,
    marginTop: 96,
    marginRight: 96,
    marginBottom: 96,
    marginLeft: 96,
  },
} as const;

export type PaginationPageSize = keyof typeof PAGINATION_PAGE_SIZES;
export type PaginationOrientation = 'portrait' | 'landscape';

export interface PaginationOptions {
  readonly enabled: boolean;
  readonly pageSize?: PaginationPageSize;
  readonly orientation?: PaginationOrientation;
  readonly headerText?: string;
  readonly footerText?: string;
}

export interface PaginationLayout {
  readonly enabled: boolean;
  readonly pageSize: PaginationPageSize;
  readonly orientation: PaginationOrientation;
  readonly width: number;
  readonly height: number;
  readonly marginTop: number;
  readonly marginRight: number;
  readonly marginBottom: number;
  readonly marginLeft: number;
  readonly gap: number;
  readonly headerText: string;
  readonly footerText: string;
}

export type PaginationInput = boolean | PaginationOptions;

type PaginationState = PaginationLayout & {
  readonly breaks: readonly number[];
};

type PaginationMeta = {
  readonly layout?: PaginationLayout;
  readonly breaks?: readonly number[];
};

const paginationPluginKey = new PluginKey<PaginationState>('pagination');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pagination: {
      setPagination: (options: PaginationInput) => ReturnType;
      togglePagination: () => ReturnType;
    };
  }
}

function sameBreaks(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((position, index) => position === right[index]);
}

function sameLayout(left: PaginationLayout, right: PaginationLayout): boolean {
  return (
    left.enabled === right.enabled &&
    left.pageSize === right.pageSize &&
    left.orientation === right.orientation &&
    left.headerText === right.headerText &&
    left.footerText === right.footerText
  );
}

export function resolvePaginationLayout(input: PaginationInput, previous?: PaginationLayout): PaginationLayout {
  const enabled = typeof input === 'boolean' ? input : input.enabled;
  const pageSize =
    typeof input === 'boolean' ? (previous?.pageSize ?? 'A4') : (input.pageSize ?? previous?.pageSize ?? 'A4');
  const orientation =
    typeof input === 'boolean'
      ? (previous?.orientation ?? 'portrait')
      : (input.orientation ?? previous?.orientation ?? 'portrait');
  const headerText = typeof input === 'boolean' ? (previous?.headerText ?? '') : (input.headerText ?? '');
  const footerText = typeof input === 'boolean' ? (previous?.footerText ?? '') : (input.footerText ?? '');
  const preset = PAGINATION_PAGE_SIZES[pageSize];
  const landscape = orientation === 'landscape';

  return {
    enabled,
    pageSize,
    orientation,
    width: landscape ? preset.height : preset.width,
    height: landscape ? preset.width : preset.height,
    marginTop: preset.marginTop,
    marginRight: preset.marginRight,
    marginBottom: preset.marginBottom,
    marginLeft: preset.marginLeft,
    gap: PAGINATION_PAGE_GAP_PX,
    headerText,
    footerText,
  };
}

function paginationMeta(layout?: PaginationLayout, breaks?: readonly number[]): PaginationMeta {
  return {
    ...(layout === undefined ? {} : { layout }),
    ...(breaks === undefined ? {} : { breaks }),
  };
}

function topLevelBlocks(view: EditorView): HTMLElement[] {
  return Array.from(view.dom.querySelectorAll<HTMLElement>('[data-node-type="blockContainer"]')).filter(
    (element) => element.parentElement?.parentElement?.parentElement === view.dom,
  );
}

function naturalTop(block: HTMLElement, rootTop: number, existingBreaks: readonly HTMLElement[]): number {
  const blockTop = block.getBoundingClientRect().top;
  const insertedHeight = existingBreaks.reduce((height, pageBreak) => {
    const rect = pageBreak.getBoundingClientRect();
    return rect.bottom <= blockTop ? height + rect.height : height;
  }, 0);
  return blockTop - rootTop - insertedHeight;
}

function measureBreaks(view: EditorView, layout: PaginationLayout): number[] {
  const blocks = topLevelBlocks(view);
  if (blocks.length < 2) {
    return [];
  }
  const rootTop = view.dom.getBoundingClientRect().top;
  const existingBreaks = Array.from(view.dom.querySelectorAll<HTMLElement>('[data-page-break]'));
  const firstTop = naturalTop(blocks[0]!, rootTop, existingBreaks);
  const leadHeight =
    view.dom
      .closest<HTMLElement>('[data-pagination-enabled="true"]')
      ?.querySelector<HTMLElement>('[data-pagination-lead]')
      ?.getBoundingClientRect().height ?? 0;
  const contentHeight = layout.height - layout.marginTop - layout.marginBottom;
  const firstPageContentHeight = Math.max(0, contentHeight - leadHeight - (leadHeight > 0 ? 16 : 0));
  let pageStart = firstTop;
  let availableHeight = firstPageContentHeight;
  const positions: number[] = [];

  for (const block of blocks) {
    const top = naturalTop(block, rootTop, existingBreaks);
    const height = block.getBoundingClientRect().height;
    if (top > pageStart && top + height - pageStart > availableHeight) {
      const inside = view.posAtDOM(block, 0);
      positions.push(Math.max(0, inside - 1));
      pageStart = top;
      availableHeight = contentHeight;
    }
  }
  return positions;
}

export function formatPaginationFooter(footerText: string, current: number, total: number): string {
  const pageNumber = `${current} / ${total}`;
  return footerText.trim() === '' ? pageNumber : `${footerText} · ${pageNumber}`;
}

function pageBreakDecoration(position: number, index: number, total: number, layout: PaginationLayout): Decoration {
  return Decoration.widget(
    position,
    () => {
      const element = document.createElement('div');
      element.className = 'tiptap-page-break';
      element.dataset.pageBreak = String(index + 1);
      element.contentEditable = 'false';
      element.setAttribute('aria-hidden', 'true');
      const previousFooter = document.createElement('span');
      previousFooter.className = 'tiptap-page-footer';
      previousFooter.textContent = formatPaginationFooter(layout.footerText, index + 1, total);
      element.append(previousFooter);
      const nextHeader = document.createElement('span');
      nextHeader.className = 'tiptap-page-header tiptap-page-header--next';
      nextHeader.textContent = layout.headerText;
      element.append(nextHeader);
      return element;
    },
    { side: -1, key: `page-${index + 1}-${position}` },
  );
}

export function createTiptapPaginationExtension() {
  return Extension.create({
    name: 'pagination',
    addCommands() {
      return {
        setPagination:
          (input: PaginationInput) =>
          ({ state, dispatch }) => {
            const previous = paginationPluginKey.getState(state) ?? {
              ...resolvePaginationLayout(false),
              breaks: [],
            };
            const layout = resolvePaginationLayout(input, previous);
            if (sameLayout(previous, layout)) {
              return true;
            }
            if (dispatch) {
              dispatch(
                state.tr
                  .setMeta(paginationPluginKey, paginationMeta(layout, layout.enabled ? undefined : []))
                  .setMeta('addToHistory', false),
              );
            }
            return true;
          },
        togglePagination:
          () =>
          ({ state, dispatch }) => {
            const previous = paginationPluginKey.getState(state) ?? {
              ...resolvePaginationLayout(false),
              breaks: [],
            };
            const layout = resolvePaginationLayout(!previous.enabled, previous);
            if (dispatch) {
              dispatch(
                state.tr
                  .setMeta(paginationPluginKey, paginationMeta(layout, layout.enabled ? undefined : []))
                  .setMeta('addToHistory', false),
              );
            }
            return true;
          },
      };
    },
    addProseMirrorPlugins() {
      return [
        new Plugin<PaginationState>({
          key: paginationPluginKey,
          state: {
            init: () => ({ ...resolvePaginationLayout(false), breaks: [] }),
            apply(transaction, previous) {
              const meta = transaction.getMeta(paginationPluginKey) as PaginationMeta | undefined;
              if (!meta) {
                return previous;
              }
              return {
                ...(meta.layout ?? previous),
                breaks: meta.breaks ?? previous.breaks,
              };
            },
          },
          props: {
            decorations(state) {
              const pagination = paginationPluginKey.getState(state);
              if (!pagination?.enabled || pagination.breaks.length === 0) {
                return DecorationSet.empty;
              }
              const total = pagination.breaks.length + 1;
              return DecorationSet.create(
                state.doc,
                pagination.breaks.map((position, index) => pageBreakDecoration(position, index, total, pagination)),
              );
            },
          },
          view(view) {
            let frame: number | null = null;
            const schedule = () => {
              if (frame !== null) {
                cancelAnimationFrame(frame);
              }
              frame = requestAnimationFrame(() => {
                frame = null;
                const state = paginationPluginKey.getState(view.state);
                if (!state?.enabled) {
                  return;
                }
                const breaks = measureBreaks(view, state);
                const root = view.dom.closest<HTMLElement>('[data-pagination-enabled="true"]');
                if (root) {
                  const total = breaks.length + 1;
                  root.dataset.paginationPageTotal = String(total);
                  root.style.setProperty(
                    '--pages-height',
                    `${total * state.height + Math.max(0, total - 1) * state.gap}px`,
                  );
                  const finalFooter = root.querySelector<HTMLElement>('[data-pagination-final-footer]');
                  if (finalFooter) {
                    finalFooter.textContent = formatPaginationFooter(state.footerText, total, total);
                  }
                }
                if (sameBreaks(state.breaks, breaks)) {
                  return;
                }
                view.dispatch(
                  view.state.tr
                    .setMeta(paginationPluginKey, paginationMeta(undefined, breaks))
                    .setMeta('addToHistory', false),
                );
              });
            };
            const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
            observer?.observe(view.dom);
            schedule();
            return {
              update: schedule,
              destroy() {
                if (frame !== null) {
                  cancelAnimationFrame(frame);
                }
                observer?.disconnect();
              },
            };
          },
        }),
      ];
    },
  });
}

export function getPaginationLayout(editor: Editor): PaginationLayout {
  const state = paginationPluginKey.getState(editor.state);
  return state ?? resolvePaginationLayout(false);
}

export function isPaginationEnabled(editor: Editor): boolean {
  return getPaginationLayout(editor).enabled;
}
