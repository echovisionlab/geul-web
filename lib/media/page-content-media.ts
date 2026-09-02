import type { Block, PageContent, Section } from '@/lib/types/page-content';

function visitBlocks(blocks: Block[] | null | undefined, visit: (block: Block) => boolean): Block | null {
  for (const block of blocks ?? []) {
    if (visit(block)) {
      return block;
    }
    const nested = visitBlocks(block.children, visit);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function visitSections(sections: Section[], visit: (block: Block) => boolean): Block | null {
  for (const section of sections) {
    const direct = visitBlocks(section.content, visit);
    if (direct) {
      return direct;
    }
    for (const column of section.columns ?? []) {
      const nested = visitSections(column.sections, visit);
      if (nested) {
        return nested;
      }
    }
  }
  return null;
}

export function findPageContentFileBlock(content: PageContent | null, fileId: string): Block | null {
  return visitSections(content?.sections ?? [], (block) => block.props?.fileId === fileId);
}

export function findPageContentBlockById(content: PageContent | null, blockId: string): Block | null {
  return visitSections(content?.sections ?? [], (block) => block.id === blockId);
}

export function collectPageContentMedia(content: PageContent | null): Record<string, Record<string, string>> {
  const media: Record<string, Record<string, string>> = {};
  visitSections(content?.sections ?? [], (block) => {
    const fileId = typeof block.props?.fileId === 'string' ? block.props.fileId.trim() : '';
    if (fileId) {
      const prop = (key: string) => (typeof block.props?.[key] === 'string' ? (block.props[key] as string) : '');
      media[fileId] = {
        fileId,
        imageUrl: prop('url'),
        hlsUrl: prop('hlsUrl'),
        waveformUrl: prop('waveformUrl'),
        spectrogramUrl: prop('spectrogramUrl'),
        posterUrl: prop('thumbnailUrl'),
      };
    }
    return false;
  });
  return media;
}
