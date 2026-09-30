'use client';

import { getBlockDefinition, getBlockEditor } from '@/features/page/blocks/registry';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { SectionRendererProvider, type SectionRendererProps } from './SectionRendererContext';
import { DEFAULT_SECTION_SETTINGS } from './types';

export function SectionContent({ section, isExpanded = true }: SectionRendererProps) {
  const { mergeSection, editable } = usePageEditor();
  const mergedSection = mergeSection(section);
  const CanvasPreview = getBlockDefinition(section.type)?.CanvasPreview;
  if (!editable && CanvasPreview) {
    return (
      <CanvasPreview
        sectionId={mergedSection.id}
        props={mergedSection.props || {}}
        settings={mergedSection.settings ?? DEFAULT_SECTION_SETTINGS}
      />
    );
  }
  const Editor = getBlockEditor(section.type);

  if (!Editor) {
    return null;
  }

  return (
    <SectionRendererProvider renderer={SectionContent}>
      <Editor sectionId={mergedSection.id} props={mergedSection.props || {}} isExpanded={isExpanded} />
    </SectionRendererProvider>
  );
}
