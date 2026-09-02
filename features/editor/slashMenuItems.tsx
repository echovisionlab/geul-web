/**
 * Tiptap slash-menu policy boundary.
 *
 * The editor runtime owns insertion through `TiptapAuthoringControls`; this
 * module only keeps the content-profile filter available to feature callers.
 */
import type { TiptapSlashItem } from './tiptap/TiptapAuthoringControls';

const hiddenContentSlashItemKeys = new Set([
  'heading_4',
  'heading_5',
  'heading_6',
  'toggle_heading',
  'toggle_heading_2',
  'toggle_heading_3',
  'toggle_list',
]);

/** Removes commands the durable content schema cannot represent. */
export function filterContentTiptapSlashItems(items: readonly TiptapSlashItem[]): TiptapSlashItem[] {
  return items.filter((item) => !hiddenContentSlashItemKeys.has(item.key));
}
