'use client';

import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { EmbedFrame } from './EmbedFrame';
import { EmbedSettingsForm } from './SettingsForm';
import { parseEmbedProps, type EmbedProps } from './schema';

export function EmbedEditor({ sectionId, props }: BlockEditorProps<EmbedProps>) {
  const { updateSection, updateLocalizedSectionProps, allowStructuralEdits } = usePageEditor();
  return (
    <EmbedSettingsForm
      props={props}
      allowSharedEdits={allowStructuralEdits}
      updateSharedProps={(next) => updateSection(sectionId, { props: next })}
      updateLocalizedProps={(next) => updateLocalizedSectionProps(sectionId, next)}
    />
  );
}

export function EmbedSettingsEditor({
  props,
  allowSharedEdits,
  updateSharedProps,
  updateLocalizedProps,
}: BlockSettingsEditorProps<EmbedProps>) {
  return (
    <EmbedSettingsForm
      props={props}
      allowSharedEdits={allowSharedEdits}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateLocalizedProps}
    />
  );
}

export function EmbedCanvasPreview({ props }: BlockCanvasPreviewProps<EmbedProps>) {
  return <EmbedFrame props={parseEmbedProps(props)} preview />;
}
