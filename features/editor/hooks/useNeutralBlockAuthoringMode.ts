'use client';

import { useCallback, useMemo } from 'react';
import type { EditorAuthoringMode } from '../EditorAuthoringMode';

interface NeutralAuthorableBlock {
  id: string;
}

interface NeutralAuthorableEditor<TBlock extends NeutralAuthorableBlock = NeutralAuthorableBlock> {
  getBlock: (blockId: string) => TBlock | null | undefined;
  updateBlock: (block: TBlock, update: { props: Record<string, unknown> }) => void;
  replaceBlocks: (...args: any[]) => void;
  document?: Array<{ id: string }>;
}

interface UseNeutralBlockAuthoringModeOptions<TBlock extends NeutralAuthorableBlock = NeutralAuthorableBlock> {
  neutralEditor: NeutralAuthorableEditor<TBlock>;
  hasRoutedNeutralAuthority: boolean;
  allowNeutralBlockEdits: boolean;
  allowLocalizedBlockEdits: boolean;
}

export function useNeutralBlockAuthoringMode<TBlock extends NeutralAuthorableBlock = NeutralAuthorableBlock>({
  neutralEditor,
  hasRoutedNeutralAuthority,
  allowNeutralBlockEdits,
  allowLocalizedBlockEdits,
}: UseNeutralBlockAuthoringModeOptions<TBlock>): EditorAuthoringMode {
  const applyNeutralBlockProps = useCallback(
    (blockId: string, props: Record<string, unknown>) => {
      const neutralBlock = neutralEditor.getBlock(blockId);
      if (!neutralBlock) {
        return;
      }
      neutralEditor.updateBlock(neutralBlock, { props });
    },
    [hasRoutedNeutralAuthority, neutralEditor],
  );

  const deleteNeutralBlock = useCallback(
    (blockId: string) => {
      const neutralBlock = neutralEditor.getBlock(blockId);
      if (!neutralBlock) {
        return;
      }
      neutralEditor.replaceBlocks([blockId], []);
    },
    [neutralEditor],
  );

  return useMemo(
    () => ({
      allowNeutralBlockEdits,
      allowLocalizedBlockEdits,
      applyNeutralBlockProps: hasRoutedNeutralAuthority ? applyNeutralBlockProps : undefined,
      deleteNeutralBlock: hasRoutedNeutralAuthority ? deleteNeutralBlock : undefined,
    }),
    [
      allowLocalizedBlockEdits,
      allowNeutralBlockEdits,
      applyNeutralBlockProps,
      deleteNeutralBlock,
      hasRoutedNeutralAuthority,
    ],
  );
}
