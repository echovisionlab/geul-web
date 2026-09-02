import type { Block, PageContent } from '@/lib/types/page-content';
import { findPageContentBlockById } from '@/lib/media/page-content-media';

export function findContentFileBlockById(
  content: Block[] | PageContent | null | undefined,
  blockId: string,
): Block | null {
  if (!content) {
    return null;
  }
  if (!Array.isArray(content)) {
    const block = findPageContentBlockById(content, blockId);
    return block?.type === 'file' ? block : null;
  }
  for (const block of content) {
    if (block.id === blockId) {
      return block.type === 'file' ? block : null;
    }
    const nested = findContentFileBlockById(block.children, blockId);
    if (nested) {
      return nested;
    }
  }
  return null;
}
