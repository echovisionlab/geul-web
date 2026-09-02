'use client';

import { createTiptapMapNode } from '@/features/editor/tiptap/map';

/**
 * Compatibility export for callers that still import the historical map block
 * path. The editor runtime is exclusively the native Tiptap map extension.
 */
export const MapBlock = createTiptapMapNode();

export { createTiptapMapNode, TiptapMapNodeView, type TiptapMapNodeOptions } from '@/features/editor/tiptap/map';
