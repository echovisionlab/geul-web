import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Selection } from '@tiptap/pm/state';
import type { NodeViewProps } from '@tiptap/react';
import type { ExecutableSelectionMenuBinding } from '../menus/executable';
import type { P5SketchOptions, P5SketchLabels, P5SketchMode } from './p5-node-options';
import type { ContextualBlockAlignment } from '../menus/map-external/AlignmentMenuActions';

interface UseP5SelectionMenuOptions {
  editor: NodeViewProps['editor'];
  getPos: NodeViewProps['getPos'];
  updateAttributes: NodeViewProps['updateAttributes'];
  canEditNeutral: boolean;
  blockId: string;
  mode: P5SketchMode;
  running: boolean;
  textAlignment: ContextualBlockAlignment;
  labels: P5SketchLabels;
  selectionMenuRegistry: P5SketchOptions['selectionMenuRegistry'];
  selectionMenuLabels: P5SketchOptions['selectionMenuLabels'];
  setMode: (mode: P5SketchMode) => void;
  restart: () => void;
  stop: () => void;
}

export function useP5SelectionMenu({
  editor,
  getPos,
  updateAttributes,
  canEditNeutral,
  blockId,
  mode,
  running,
  textAlignment,
  labels,
  selectionMenuRegistry,
  selectionMenuLabels,
  setMode,
  restart,
  stop,
}: UseP5SelectionMenuOptions) {
  const selectBlock = useCallback(() => {
    if (!canEditNeutral) {
      return;
    }
    const position = getPos();
    if (typeof position !== 'number' || editor.state.doc.nodeAt(position)?.type.name !== 'p5Sketch') {
      return;
    }
    editor.commands.setNodeSelection(position);
    editor.view.focus();
  }, [canEditNeutral, editor, getPos]);
  const deleteBlock = useCallback(() => {
    if (!canEditNeutral) {
      return;
    }
    const position = getPos();
    if (typeof position !== 'number') {
      return;
    }
    const $content = editor.state.doc.resolve(position);
    if ($content.parent.type.name !== 'blockContainer') {
      return;
    }
    const blockPosition = $content.before();
    const $block = editor.state.doc.resolve(blockPosition);
    const block = editor.state.doc.nodeAt(blockPosition);
    if (!block || $block.parent.type.name !== 'blockGroup' || ($block.parent.childCount === 1 && $block.depth <= 1)) {
      return;
    }
    const transaction = editor.state.tr;
    if ($block.parent.childCount === 1) {
      transaction.delete($block.before(), $block.after());
    } else {
      transaction.delete(blockPosition, blockPosition + block.nodeSize);
    }
    transaction.setSelection(
      Selection.near(transaction.doc.resolve(Math.min(blockPosition + 2, transaction.doc.content.size))),
    );
    editor.view.dispatch(transaction.scrollIntoView());
    editor.commands.focus();
  }, [canEditNeutral, editor, getPos]);
  const binding = useMemo<ExecutableSelectionMenuBinding>(
    () => ({
      snapshot: {
        blockType: 'p5Sketch',
        mode,
        running,
        textAlignment,
        labels: {
          menu: labels.title,
          edit: labels.edit,
          source: labels.source,
          preview: labels.preview,
          run: labels.run,
          stop: labels.stop,
          restart: labels.restart,
          deleteBlock: selectionMenuLabels?.deleteBlock ?? 'Delete',
          alignment: selectionMenuLabels?.alignment ?? 'Alignment',
          alignLeft: selectionMenuLabels?.alignLeft ?? 'Align left',
          alignCenter: selectionMenuLabels?.alignCenter ?? 'Align center',
          alignRight: selectionMenuLabels?.alignRight ?? 'Align right',
        },
      },
      commands: {
        setMode,
        run: restart,
        stop,
        restart,
        setAlignment: (alignment) => {
          if (canEditNeutral) {
            updateAttributes({ textAlignment: alignment });
          }
        },
        deleteBlock,
      },
    }),
    [
      canEditNeutral,
      deleteBlock,
      labels,
      mode,
      restart,
      running,
      selectionMenuLabels,
      setMode,
      stop,
      textAlignment,
      updateAttributes,
    ],
  );
  const bindingRef = useRef(binding);
  bindingRef.current = binding;
  const liveBinding = useMemo<ExecutableSelectionMenuBinding>(
    () => ({
      get snapshot() {
        return bindingRef.current.snapshot;
      },
      get commands() {
        return bindingRef.current.commands;
      },
    }),
    [],
  );

  useEffect(() => {
    if (!selectionMenuRegistry || !blockId || !canEditNeutral) {
      return;
    }
    return selectionMenuRegistry.register(blockId, liveBinding);
  }, [blockId, canEditNeutral, liveBinding, selectionMenuRegistry]);
  useEffect(() => {
    selectionMenuRegistry?.notify();
  }, [mode, running, selectionMenuRegistry, textAlignment]);

  return selectBlock;
}
