'use client';

import { useCallback, useMemo } from 'react';
import { resolveEditorAuthoringMode, useEditorAuthoringMode } from '../EditorAuthoringMode';

interface AuthorableBlock {
  id: string;
}

interface AuthorableEditor<TBlock extends AuthorableBlock> {
  updateBlock: (block: TBlock, update: { props: Record<string, unknown> }) => void;
}

export function useBlockAuthoringUpdates<TBlock extends AuthorableBlock>(
  block: TBlock,
  editor: AuthorableEditor<TBlock>,
) {
  const contextMode = useEditorAuthoringMode();
  const { allowNeutralBlockEdits, allowLocalizedBlockEdits, applyNeutralBlockProps } = useMemo(() => {
    const registeredMode = resolveEditorAuthoringMode(editor as object);
    if (registeredMode !== undefined && registeredMode !== null) {
      if (
        registeredMode.applyNeutralBlockProps !== undefined ||
        registeredMode.allowNeutralBlockEdits !== true ||
        registeredMode.allowLocalizedBlockEdits !== true
      ) {
        return registeredMode;
      }
    }
    return contextMode;
  }, [contextMode, editor]);

  const updateLocalizedProps = useCallback(
    (props: Record<string, unknown>) => {
      editor.updateBlock(block, { props });
    },
    [block, editor],
  );

  const updateCurrentAndNeutralProps = useCallback(
    (currentProps: Record<string, unknown>, neutralProps: Record<string, unknown> = currentProps) => {
      updateLocalizedProps(currentProps);
      applyNeutralBlockProps?.(block.id, neutralProps);
    },
    [allowNeutralBlockEdits, applyNeutralBlockProps, block.id, updateLocalizedProps],
  );

  const updateNeutralProps = useCallback(
    (neutralProps: Record<string, unknown>) => {
      updateCurrentAndNeutralProps(neutralProps);
    },
    [updateCurrentAndNeutralProps],
  );

  return {
    allowLocalizedBlockEdits,
    allowNeutralBlockEdits,
    updateLocalizedProps,
    updateCurrentAndNeutralProps,
    updateNeutralProps,
  };
}
