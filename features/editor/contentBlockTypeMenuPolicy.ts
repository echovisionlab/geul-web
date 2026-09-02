/**
 * Content authoring policy for the native Tiptap command menu.
 *
 * The wire schema has regular headings H1-H3 only. Toggle headings and list
 * toggles were retired UI affordances and must never be exposed again.
 */
import type { TiptapSlashItem } from './tiptap/TiptapAuthoringControls';

const supportedContentBlockTypeKeys = new Set([
  'paragraph',
  'heading',
  'heading_2',
  'heading_3',
  'bullet_list',
  'numbered_list',
  'check_list',
  'quote',
  'callout',
  'code_block',
  'divider',
]);

export function filterContentBlockTypeMenuItems(items: readonly TiptapSlashItem[]): TiptapSlashItem[] {
  return items.filter((item) => supportedContentBlockTypeKeys.has(item.key));
}
