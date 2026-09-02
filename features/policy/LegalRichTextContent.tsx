'use client';

import { useMemo } from 'react';
import { Box } from '@mantine/core';
import type { LocalizedRichTextBlock } from '@/features/editor/contract/localized-rich-text';
import { GeneratedRichTextBlockView } from '@/features/page/PageView/blocks/GeneratedRichTextBlockView';
import { TableOfContents } from '@/features/navigation/TableOfContents';
import { buildGeneratedBlockTocItems } from '@/lib/toc-items';

export function LegalRichTextContent({
  blocks,
  className,
  requestedLocale,
}: {
  blocks: readonly LocalizedRichTextBlock[];
  className: string;
  requestedLocale?: string;
}) {
  const tocItems = useMemo(() => buildGeneratedBlockTocItems(blocks), [blocks]);
  return (
    <>
      <Box className={className}>
        {blocks.map((block) => (
          <GeneratedRichTextBlockView key={block.id} block={block} requestedLocale={requestedLocale} />
        ))}
      </Box>
      <TableOfContents items={tocItems} />
    </>
  );
}
