'use client';

import { getBlockEditor } from '@/features/page/blocks/registry';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { SectionRendererProvider, type SectionRendererProps } from './SectionRendererContext';

export function SectionContent({ section, isExpanded = true }: SectionRendererProps) {
  const { mergeSection } = usePageEditor();
  const Editor = getBlockEditor(section.type);

  if (!Editor) {
    return null;
  }

  const mergedSection = mergeSection(section);

  return (
    <SectionRendererProvider renderer={SectionContent}>
      <Editor sectionId={mergedSection.id} props={mergedSection.props || {}} isExpanded={isExpanded} />
    </SectionRendererProvider>
  );
}
