'use client';

import { usePageEditor } from './PageEditorContext';
import { getBlockDefinition } from '../blocks/registry';
import { SectionContent } from './SectionContent';
import { SectionItemView } from './SectionItemView';
import type { SectionMeta } from './types';

interface SectionItemProps {
  section: SectionMeta;
  onDelete: () => void;
  editable?: boolean;
  positionDescription?: string;
}

export function SectionItem({ section, onDelete, editable = true, positionDescription }: SectionItemProps) {
  const { updateLocalizedSectionProps, updateSection, allowStructuralEdits } = usePageEditor();
  return (
    <SectionItemView
      initialExpanded={section.type === 'rich-text' || section.type === 'columns' ? true : undefined}
      section={section}
      positionDescription={positionDescription}
      onDelete={onDelete}
      editable={editable}
      allowStructuralEdits={allowStructuralEdits}
      definition={getBlockDefinition(section.type)}
      updateSection={updateSection}
      updateLocalizedSectionProps={updateLocalizedSectionProps}
      content={<SectionContent section={section} isExpanded={editable} />}
    />
  );
}
