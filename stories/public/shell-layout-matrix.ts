import type { DocumentLayoutViewModel } from '@/features/document-layout/ui/types';

export const SHELL_LAYOUT_CONTENT_SHAPES = [
  'single-autoplay-scene',
  'single-scroll-scene',
  'autoplay-scene-with-blocks',
  'scroll-scene-with-blocks',
  'short-no-scene',
  'long-no-scene',
] as const;

export type ShellLayoutContentShape = (typeof SHELL_LAYOUT_CONTENT_SHAPES)[number];

export interface ShellLayoutMatrixInput extends DocumentLayoutViewModel {
  contentShape: ShellLayoutContentShape;
}

export interface ShellLayoutMatrixExpectation {
  documentScrolls: boolean;
  footerPinned: boolean;
  hasScene: boolean;
  lastSectionId: 'scene' | 'short' | 'after';
  nestedScrollOwner: false;
}

export interface ShellLayoutMatrixCase {
  id: string;
  input: ShellLayoutMatrixInput;
  expectation: ShellLayoutMatrixExpectation;
}

const SCROLLING_VIEWPORT_SHAPES = new Set<ShellLayoutContentShape>([
  'single-scroll-scene',
  'scroll-scene-with-blocks',
  'long-no-scene',
]);

function contentModeScrolls(contentShape: ShellLayoutContentShape) {
  return contentShape !== 'short-no-scene';
}

export function resolveShellLayoutMatrixExpectation({
  contentShape,
  contentHeight,
  footer,
}: ShellLayoutMatrixInput): ShellLayoutMatrixExpectation {
  const documentScrolls =
    footer === 'pinned'
      ? SCROLLING_VIEWPORT_SHAPES.has(contentShape)
      : contentHeight === 'content'
        ? contentModeScrolls(contentShape)
        : true;

  return {
    documentScrolls,
    footerPinned: footer === 'pinned',
    hasScene: !contentShape.endsWith('no-scene'),
    lastSectionId:
      contentShape === 'single-autoplay-scene' || contentShape === 'single-scroll-scene'
        ? 'scene'
        : contentShape === 'short-no-scene'
          ? 'short'
          : 'after',
    nestedScrollOwner: false,
  };
}

export function toDocumentLayoutViewModel({
  contentHeight,
  pageChrome,
  footer,
}: ShellLayoutMatrixInput): DocumentLayoutViewModel {
  return { contentHeight, pageChrome, footer };
}

export function createShellLayoutMatrix(): ShellLayoutMatrixCase[] {
  return SHELL_LAYOUT_CONTENT_SHAPES.flatMap((contentShape) =>
    (['content', 'viewport'] as const).flatMap((contentHeight) =>
      (['flow', 'pinned'] as const).flatMap((pageChrome) =>
        (['flow', 'pinned'] as const).map((footer) => {
          const input = { contentShape, contentHeight, pageChrome, footer };
          return {
            id: [contentShape, contentHeight, pageChrome, footer].join('/'),
            input,
            expectation: resolveShellLayoutMatrixExpectation(input),
          };
        }),
      ),
    ),
  );
}
