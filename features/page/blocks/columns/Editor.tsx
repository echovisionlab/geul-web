/**
 * ColumnsEditor
 *
 * Adapts the columns editor to the block registry while obtaining the recursive
 * section renderer from the PageEditor composition boundary.
 */
'use client';

import { useMemo } from 'react';
import { ColumnsEditor as ColumnsEditorInternal } from '@/features/page/PageEditor/editors/ColumnsEditor';
import { useSectionRenderer } from '@/features/page/PageEditor/SectionRendererContext';
import type { ColumnsSection } from '@/features/page/PageEditor/types';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { BlockEditorProps } from '../types';
import type { ColumnsProps } from './schema';

export function ColumnsEditor({ sectionId }: BlockEditorProps<ColumnsProps>) {
  const { sections } = usePageEditor();
  const SectionRenderer = useSectionRenderer();

  // Find the section to pass to the internal editor
  const section = useMemo(
    () => sections.find((s) => s.id === sectionId) as ColumnsSection | undefined,
    [sections, sectionId],
  );

  if (!section) {
    return null;
  }

  return <ColumnsEditorInternal section={section} SectionRenderer={SectionRenderer} />;
}
