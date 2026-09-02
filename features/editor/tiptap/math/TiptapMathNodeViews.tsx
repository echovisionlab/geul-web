'use client';

import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useId,
  useMemo,
} from 'react';
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type NodeViewProps,
} from '@tiptap/react';
import { TextSelection, Plugin, PluginKey, type EditorState, type Selection, type Transaction } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { WireMath, WireMathInline } from '../wire-schema';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { renderMath } from './math-render';
import classes from './TiptapMathNodeViews.module.css';

function selectNode({ editor, getPos }: Pick<NodeViewProps, 'editor' | 'getPos'>) {
  const position = getPos();
  if (typeof position === 'number') {
    editor.commands.setNodeSelection(position);
  }
}

function MathPreview({ latex, displayMode }: { latex: string; displayMode: boolean }) {
  const rendered = useMemo(() => renderMath(latex, displayMode), [displayMode, latex]);
  return (
    <>
      <span className={classes.rendered} dangerouslySetInnerHTML={{ __html: rendered.html }} />
      {rendered.error ? <span className={classes.error}>{rendered.error}</span> : null}
    </>
  );
}

function inlineMathSource(node: NodeViewProps['node']): string {
  return node.textContent || String(node.attrs.latex ?? '');
}

function selectionTouchesInlineMath(selection: Selection, position: number, contentSize: number): boolean {
  const contentFrom = position + 1;
  const contentTo = contentFrom + contentSize;
  if (contentSize === 0) {
    return selection.from === contentFrom || selection.to === contentFrom;
  }
  return (
    (selection.from < contentTo && selection.to > contentFrom) ||
    (selection.empty && selection.from >= contentFrom && selection.from <= contentTo)
  );
}

function legacyInlineMathMigration(state: EditorState): Transaction | null {
  const legacy: Array<{ position: number; source: string }> = [];
  state.doc.descendants((node, position) => {
    const source = String(node.attrs.latex ?? '');
    if (node.type.name === 'mathInline' && source) {
      legacy.push({ position, source });
    }
  });
  if (!legacy.length) {
    return null;
  }
  let transaction = state.tr;
  for (const entry of legacy.reverse()) {
    const node = transaction.doc.nodeAt(entry.position);
    if (!node || node.type.name !== 'mathInline' || !node.attrs.latex) {
      continue;
    }
    const content = node.content.size > 0 ? node.content : state.schema.text(entry.source);
    transaction = transaction.replaceWith(
      entry.position,
      entry.position + node.nodeSize,
      node.type.create({ ...node.attrs, latex: '' }, content, node.marks),
    );
  }
  return transaction.docChanged ? transaction.setMeta('addToHistory', false) : null;
}

function enterInlineMathSource(view: EditorView, event: KeyboardEvent): boolean {
  if ((event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || event.altKey || event.ctrlKey || event.metaKey) {
    return false;
  }
  const { selection } = view.state;
  if (!selection.empty && !event.shiftKey) {
    return false;
  }
  const forward = event.key === 'ArrowRight';
  const adjacent = forward ? selection.$head.nodeAfter : selection.$head.nodeBefore;
  if (adjacent?.type.name !== 'mathInline') {
    return false;
  }
  const nodePosition = forward ? selection.head : selection.head - adjacent.nodeSize;
  const contentFrom = nodePosition + 1;
  const contentTo = contentFrom + adjacent.content.size;
  const target = event.shiftKey
    ? forward
      ? Math.min(contentTo, contentFrom + 1)
      : Math.max(contentFrom, contentTo - 1)
    : forward
      ? contentFrom
      : contentTo;
  const anchor = event.shiftKey ? selection.anchor : target;
  view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, anchor, target)).scrollIntoView());
  return true;
}

function createInlineMathEditingPlugin(): Plugin {
  return new Plugin({
    key: new PluginKey('tiptapInlineMathEditing'),
    props: {
      handleKeyDown: enterInlineMathSource,
    },
    view(view) {
      let migrationScheduled = false;
      const scheduleMigration = () => {
        if (migrationScheduled) {
          return;
        }
        migrationScheduled = true;
        queueMicrotask(() => {
          migrationScheduled = false;
          if (!view.isDestroyed) {
            const transaction = legacyInlineMathMigration(view.state);
            if (transaction) {
              view.dispatch(transaction);
            }
          }
        });
      };
      scheduleMigration();
      return {
        update(_view, previousState) {
          if (!previousState.doc.eq(view.state.doc)) {
            scheduleMigration();
          }
        },
      };
    },
  });
}

function TiptapMathInlineNodeView(props: NodeViewProps) {
  const source = inlineMathSource(props.node);
  const rendered = useMemo(() => renderMath(source, false), [source]);
  const errorId = useId();
  const editing = useEditorState({
    editor: props.editor,
    selector: ({ editor }) => {
      const position = props.getPos();
      const node = typeof position === 'number' ? editor.state.doc.nodeAt(position) : null;
      return Boolean(
        node?.type.name === 'mathInline' &&
        selectionTouchesInlineMath(editor.state.selection, position as number, node.content.size),
      );
    },
  });
  const renderable = Boolean(source && !rendered.error);
  const editAtPointer = useCallback(
    (event: ReactMouseEvent<HTMLSpanElement>) => {
      const currentPosition = props.getPos();
      const currentNode = typeof currentPosition === 'number' ? props.editor.state.doc.nodeAt(currentPosition) : null;
      const liveEditing = Boolean(
        currentNode?.type.name === 'mathInline' &&
        selectionTouchesInlineMath(props.editor.state.selection, currentPosition as number, currentNode.content.size),
      );
      if (typeof currentPosition !== 'number' || event.button !== 0 || liveEditing || !renderable || !currentNode) {
        return;
      }
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      const ratio = bounds.width > 0 ? Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)) : 1;
      const offset = Math.round(source.length * ratio);
      let transaction = props.editor.state.tr;
      let contentSize = currentNode.content.size;
      if (!contentSize && source) {
        const replacement = currentNode.type.create(
          { ...currentNode.attrs, latex: '' },
          props.editor.state.schema.text(source),
        );
        transaction = transaction.replaceWith(currentPosition, currentPosition + currentNode.nodeSize, replacement);
        contentSize = source.length;
      }
      const target = currentPosition + 1 + Math.min(contentSize, offset);
      const anchor = event.shiftKey ? props.editor.state.selection.anchor : target;
      transaction = transaction.setSelection(TextSelection.create(transaction.doc, anchor, target));
      props.editor.view.dispatch(transaction.scrollIntoView());
      props.editor.view.focus();
    },
    [props, renderable, source],
  );

  return (
    <NodeViewWrapper
      as="span"
      className={`${classes.root} ${classes.inline}`}
      data-math-inline=""
      data-math-inline-editing={editing || undefined}
      data-renderable={renderable || undefined}
      data-empty={!source || undefined}
      title={rendered.error ?? undefined}
      onMouseDown={editAtPointer}
    >
      <NodeViewContent<'span'>
        as="span"
        className={classes.inlineSource}
        aria-hidden={(renderable && !editing) || undefined}
        aria-invalid={Boolean(rendered.error) || undefined}
        aria-describedby={rendered.error ? errorId : undefined}
      />
      {renderable ? (
        <span
          className={classes.inlinePreview}
          contentEditable={false}
          aria-hidden={editing || undefined}
          dangerouslySetInnerHTML={{ __html: rendered.html }}
        />
      ) : null}
      {rendered.error ? (
        <span id={errorId} className={classes.visuallyHidden}>
          {rendered.error}
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}

function TiptapMathBlockNodeView(props: NodeViewProps) {
  const source = String(props.node.attrs.latex ?? '');
  const exactNodeSelected = useExactTiptapNodeSelection(props);
  const select = useCallback(() => {
    selectNode(props);
  }, [props]);

  return (
    <NodeViewWrapper
      className={`${classes.root} ${classes.block}`}
      contentEditable={false}
      data-math-block=""
      data-selected={exactNodeSelected || undefined}
      onClick={(event: ReactMouseEvent<HTMLDivElement>) => {
        event.preventDefault();
        select();
      }}
      onFocus={select}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          select();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <MathPreview latex={source} displayMode />
    </NodeViewWrapper>
  );
}

export const TiptapMathInlineNode = WireMathInline.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TiptapMathInlineNodeView);
  },
  addProseMirrorPlugins() {
    return [createInlineMathEditingPlugin()];
  },
});

export const TiptapMathBlockNode = WireMath.extend({
  addNodeView() {
    return ReactNodeViewRenderer(TiptapMathBlockNodeView);
  },
});
