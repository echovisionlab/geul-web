'use client';

import { useCallback, useMemo, useRef } from 'react';
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Stack } from '@mantine/core';
import { ExecutableBlockTitle, ExecutableRuntimeControls } from '@/features/executable/ExecutableRuntimeControls';
import { useBlockResize } from '@/features/editor/hooks/useBlockResize';
import { EditorMediaBlockFrame } from '@/features/editor/ui/EditorMediaBlockShell';
import { MonacoSourceEditor } from '../code-editor';
import { executableBlockIdForPosition } from '../executable-source';
import { normalizeP5Capabilities } from './p5-capabilities';
import { P5CapabilityControl } from './P5CapabilityControl';
import { normalizeP5NodeAttributes } from './p5-node-attributes';
import { requireP5SketchLabels, type P5SketchOptions } from './p5-node-options';
import { P5PreviewSurface } from './P5PreviewSurface';
import { createP5PreviewRuntime } from './p5-preview-runtime';
import { useP5SelectionMenu } from './useP5SelectionMenu';
import { useExactTiptapNodeSelection } from '../useExactTiptapNodeSelection';
import { useP5SketchSession } from './useP5SketchSession';
import { detectP5Capabilities } from './p5-source';
import { useTiptapEditorEditable } from '../useTiptapEditorEditable';
import classes from './P5SketchNode.module.css';

export function P5SketchNodeView({
  editor,
  getPos,
  node,
  updateAttributes,
  labels: providedLabels,
  runtimeFactory = createP5PreviewRuntime,
  autoRunReadOnly = true,
  maxSourceLength = 100_000,
  selectionMenuRegistry,
  selectionMenuLabels,
  authoringMode,
}: NodeViewProps & P5SketchOptions) {
  const labels = useMemo(() => requireP5SketchLabels(providedLabels), [providedLabels]);
  const editable = useTiptapEditorEditable(editor);
  const canEditNeutral = editable && authoringMode?.allowNeutralBlockEdits === true;
  const exactNodeSelected = useExactTiptapNodeSelection({ editor, getPos });
  const canEditTitle = editable && authoringMode?.allowLocalizedBlockEdits === true;
  const authoringSelected = canEditNeutral && exactNodeSelected;
  const originalSource = node.textContent;
  const {
    title,
    mode: durableMode,
    previewHeight,
    previewWidth,
    textAlignment,
    capabilities: serializedCapabilities,
  } = normalizeP5NodeAttributes(node.attrs);
  const capabilities = useMemo(() => normalizeP5Capabilities(serializedCapabilities), [serializedCapabilities]);
  const hasDeviceCapabilities = capabilities.length > 0;
  const blockId = executableBlockIdForPosition({ editor, getPos });
  const frameRef = useRef<HTMLDivElement>(null);
  const session = useP5SketchSession({
    editor,
    getPos,
    node,
    updateAttributes,
    editable,
    canEditNeutral,
    durableMode,
    originalSource,
    capabilities,
    hasDeviceCapabilities,
    autoRunReadOnly,
  });
  const {
    mode,
    source,
    draftSource,
    setDraftSource,
    temporarySource,
    hasDraftChanges,
    codeVisible,
    running,
    revision,
    copied,
    setRuntime,
    markInactive,
    setMode,
    stop,
    restart,
    toggleCapability,
    resetOriginal,
    applyDraft,
    toggleSource,
    copySource,
  } = session;
  const suggestedCapabilities = useMemo(
    () => detectP5Capabilities(mode === 'edit' ? draftSource : source),
    [draftSource, mode, source],
  );
  const persistPreviewWidth = useCallback(
    (width: number) => {
      if (canEditNeutral) {
        updateAttributes({ previewWidth: String(width) });
      }
    },
    [canEditNeutral, updateAttributes],
  );
  const resize = useBlockResize({
    containerRef: frameRef,
    previewWidth,
    enabled: authoringSelected,
    onResize: persistPreviewWidth,
    keyboardSession: { owner: editor, key: `p5Sketch:${blockId}` },
  });
  const selectBlock = useP5SelectionMenu({
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
  });

  return (
    <NodeViewWrapper
      className={classes.node}
      data-content-type="p5Sketch"
      data-selected={authoringSelected || undefined}
      data-editor-mode={editable ? 'authoring' : 'public'}
      data-text-alignment={textAlignment}
      contentEditable={false}
    >
      <EditorMediaBlockFrame
        className={classes.frame}
        containerRef={frameRef}
        suppressStaticTextSelection
        widthPercent={resize.widthPercent}
        margin={resize.getMarginStyle(textAlignment)}
        allowResize={authoringSelected}
        selected={authoringSelected}
        isResizing={resize.isDragging !== null}
        onResizeLeftPointerDown={resize.startResizeLeft}
        onResizeRightPointerDown={resize.startResizeRight}
        onResizeLeftKeyDown={resize.onResizeKeyDown}
        onResizeRightKeyDown={resize.onResizeKeyDown}
        onResizeBlur={resize.onResizeBlur}
        resizeMin={resize.minWidth}
        resizeMax={resize.maxWidth}
        resizeLeftLabel={labels.resizeLeft}
        resizeRightLabel={labels.resizeRight}
      >
        <div className={classes.root} data-testid="p5-content">
          <div className={classes.header}>
            <ExecutableBlockTitle
              title={title}
              fallback={labels.title}
              editable={canEditTitle}
              onChange={(nextTitle) => updateAttributes({ title: nextTitle })}
            />
          </div>

          <Stack className={classes.body} data-view-mode={mode} gap={0}>
            <P5PreviewSurface
              key={revision}
              source={source}
              height={previewHeight}
              revision={revision}
              active={running}
              runtimeFactory={runtimeFactory}
              labels={labels}
              onRuntime={setRuntime}
              capabilities={capabilities}
              onInactive={markInactive}
            />

            <ExecutableRuntimeControls
              className={classes.controls}
              type="p5Sketch"
              labels={labels}
              running={running}
              onRun={restart}
              onStop={stop}
              onRestart={restart}
              capabilityControl={
                <P5CapabilityControl
                  capabilities={capabilities}
                  editable={canEditNeutral}
                  labels={labels}
                  suggestedCapabilities={suggestedCapabilities}
                  onToggle={toggleCapability}
                />
              }
              sourceControl={{ label: labels.source, expanded: codeVisible, onClick: toggleSource }}
              onResetOriginal={codeVisible ? resetOriginal : undefined}
              resetDisabled={!hasDraftChanges && temporarySource === originalSource}
              copyControl={
                codeVisible ? { label: copied ? labels.copied : labels.copy, onClick: copySource } : undefined
              }
              applyControl={
                mode === 'edit' ? { label: labels.apply, disabled: !hasDraftChanges, onClick: applyDraft } : undefined
              }
            />

            {codeVisible ? (
              <Stack gap={0}>
                <MonacoSourceEditor
                  className={classes.editor}
                  value={mode === 'edit' ? draftSource : source}
                  language="javascript"
                  ariaLabel={labels.sourceInput}
                  modelPath={`p5/${blockId}.js`}
                  height={previewHeight}
                  maxLength={maxSourceLength}
                  onChange={mode === 'edit' ? setDraftSource : undefined}
                  onApply={mode === 'edit' ? applyDraft : undefined}
                  onEscape={canEditNeutral ? selectBlock : undefined}
                  readOnly={mode !== 'edit'}
                />
              </Stack>
            ) : null}
          </Stack>
        </div>
      </EditorMediaBlockFrame>
      <NodeViewContent className={classes.content} aria-hidden="true" />
    </NodeViewWrapper>
  );
}
