'use client';

import { MermaidEditor } from '@/features/mermaid/MermaidEditor';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { BlockEditorProps, BlockSettingsEditorProps } from '../types';
import { parseMermaidProps, type MermaidProps } from './schema';

type MermaidSettingsProps = Pick<
  BlockSettingsEditorProps<MermaidProps>,
  'sectionId' | 'props' | 'updateSharedProps' | 'updateLocalizedProps' | 'allowSharedEdits'
>;

export function MermaidSettingsEditor({
  sectionId,
  props,
  updateSharedProps,
  updateLocalizedProps,
  allowSharedEdits = false,
}: MermaidSettingsProps) {
  const parsed = parseMermaidProps(props);
  return (
    <MermaidEditor
      source={parsed.source}
      title={parsed.title}
      modelPath={`page/mermaid/${sectionId}.mmd`}
      onChange={allowSharedEdits ? (source) => updateSharedProps({ source }) : undefined}
      onTitleChange={(title) => updateLocalizedProps({ title })}
    />
  );
}

export function MermaidBlockEditor({ sectionId, props }: BlockEditorProps<MermaidProps>) {
  const { updateSection, updateLocalizedSectionProps, editable, allowStructuralEdits } = usePageEditor();
  return (
    <MermaidSettingsEditor
      sectionId={sectionId}
      props={props}
      allowSharedEdits={editable && allowStructuralEdits}
      updateSharedProps={(next) => updateSection(sectionId, { props: next })}
      updateLocalizedProps={(next) => updateLocalizedSectionProps(sectionId, next)}
    />
  );
}
