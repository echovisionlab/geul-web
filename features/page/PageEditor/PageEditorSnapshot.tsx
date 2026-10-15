'use client';

import { useTranslations } from 'next-intl';
import { LayoutStack } from '@/components/core/Layout';
import { ContentBlockMediaRuntimeProvider } from '@/features/media/ContentBlockMediaRuntimeContext';
import type { EditorSnapshot } from '@/features/editor/editor-snapshot';
import { TiptapSnapshot } from '@/features/editor/tiptap/TiptapSnapshot';
import { getBlockDefinition } from '../blocks/registry';
import { SectionItemView } from './SectionItemView';
import { LocalizedPageBodyView } from './LocalizedPageBodyView';
import { ColumnsEditorView } from './editors/ColumnsEditor';
import { DEFAULT_SECTION_SETTINGS, type SectionMeta } from './types';

const noop = () => {};
type SnapshotSection = NonNullable<EditorSnapshot['sections']>[number];
function sectionMeta(section: SnapshotSection): SectionMeta {
  return {
    id: section.id,
    type: section.kind,
    props: section.props,
    settings: { ...DEFAULT_SECTION_SETTINGS, ...section.settings },
    ...(section.kind === 'columns'
      ? { columns: section.columns.map((column) => ({ id: column.id, sections: column.sections.map(sectionMeta) })) }
      : {}),
  } as SectionMeta;
}

export function PageEditorSnapshot({ snapshot }: { snapshot: EditorSnapshot }) {
  const t = useTranslations('common');
  const index = new Map<string, SnapshotSection>();
  const visit = (items: readonly SnapshotSection[]) =>
    items.forEach((section) => {
      index.set(section.id, section);
      section.columns.forEach((column) => visit(column.sections));
    });
  visit(snapshot.sections ?? []);
  const sections = (snapshot.sections ?? []).map(sectionMeta);
  const richText = (section: SectionMeta) => {
    const stored = index.get(section.id);
    return stored?.content ? (
      <TiptapSnapshot
        content={stored.content}
        blocks={stored.blocks}
        locale={snapshot.locale}
        label={t('labels.body')}
      />
    ) : null;
  };
  const SectionContent = ({ section }: { section: SectionMeta }) => {
    if (section.type === 'rich-text') {
      return richText(section);
    }
    if (section.type === 'columns') {
      return (
        <ColumnsEditorView
          section={section}
          SectionRenderer={SectionContent}
          editable={false}
          allowStructuralEdits={false}
          updateSection={noop}
          updateLocalizedSectionProps={noop}
        />
      );
    }
    const CanvasPreview = getBlockDefinition(section.type)?.CanvasPreview;
    return CanvasPreview ? (
      <CanvasPreview
        sectionId={section.id}
        props={section.props ?? {}}
        settings={section.settings ?? DEFAULT_SECTION_SETTINGS}
      />
    ) : null;
  };
  return (
    <ContentBlockMediaRuntimeProvider items={snapshot.blockMedia ?? []}>
      {snapshot.locale !== snapshot.sourceLocale ? (
        <LocalizedPageBodyView
          sections={sections}
          locale={snapshot.locale}
          editable={false}
          fallbackText={t('states.none')}
          renderRichText={richText}
          onPropChange={noop}
        />
      ) : (
        <LayoutStack gap="md" data-editor-snapshot-revision={snapshot.documentRevision}>
          {sections.map((section) => (
            <SectionItemView
              key={section.id}
              section={section}
              initialExpanded={section.type === 'rich-text' || section.type === 'columns' ? true : undefined}
              editable={false}
              allowStructuralEdits={false}
              definition={getBlockDefinition(section.type)}
              onDelete={noop}
              updateSection={noop}
              updateLocalizedSectionProps={noop}
              content={<SectionContent section={section} />}
            />
          ))}
        </LayoutStack>
      )}
    </ContentBlockMediaRuntimeProvider>
  );
}
