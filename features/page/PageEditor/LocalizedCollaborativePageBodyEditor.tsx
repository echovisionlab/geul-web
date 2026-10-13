'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import { SupportingText, Text as DsText } from '@/components/core/Typography';
import { useCallback } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useTranslations } from 'next-intl';

import { MapView } from '@/features/page/blocks/map/View';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { SectionMeta } from '@/features/page/PageEditor/types';
import { usePageSectionBlockRoomController } from '@/features/page/PageEditor/usePageSectionBlockRoomController';
import { LocalizedRichTextFragmentEditor } from '@/features/translation/LocalizedRichTextFragmentEditor';
import {
  humanizeSectionType,
  PageSectionLocalePropFields as SectionLocalePropFields,
  type PageSectionLocalePropKey,
} from '@/features/translation/PageSectionLocalePropFields';
import classes from '@/features/translation/StructuredLocaleContentPreview.module.css';

interface LocalizedCollaborativePageBodyEditorProps {
  fallbackText: string;
  editable?: boolean;
}

function CollaborativePageSectionEditor({
  section,
  editable,
  onPropChange,
}: {
  section: SectionMeta;
  editable: boolean;
  onPropChange: (sectionId: string, key: PageSectionLocalePropKey, value: string) => void;
}) {
  const t = useTranslations('translationPanel.activeEditLocale');
  const { doc, provider, locale, userName, pageId } = usePageEditor();
  const blockRoomController = usePageSectionBlockRoomController(doc, locale, section.id, section.type === 'rich-text');

  if (section.type === 'columns') {
    const configuredRatios = String(section.props?.columnRatios ?? '')
      .split(':')
      .map(Number);
    const ratios = section.columns.map((_, index) => configuredRatios[index] || 1);
    return (
      <div className={classes.columns} style={{ gridTemplateColumns: ratios.map((ratio) => `${ratio}fr`).join(' ') }}>
        {section.columns.map((column) => (
          <DsLayoutStack key={column.id} gap="md">
            {column.sections.map((childSection) => (
              <CollaborativePageSectionEditor
                key={childSection.id}
                section={childSection}
                editable={editable}
                onPropChange={onPropChange}
              />
            ))}
          </DsLayoutStack>
        ))}
      </div>
    );
  }

  if (section.type === 'rich-text' && blockRoomController) {
    return (
      <LocalizedRichTextFragmentEditor
        provider={provider}
        blockRoomController={blockRoomController}
        userName={userName}
        editable={editable}
        entityId={pageId}
        entityType={TranscodeEntityType.PAGE}
        allowNeutralBlockEdits={false}
        allowStructuralEdits={false}
        aiTarget={editable ? { type: 'page', id: pageId, locale } : undefined}
      />
    );
  }

  if (section.type === 'map') {
    return (
      <DsLayoutStack gap="sm">
        <div className={classes.dynamicSectionPreview}>
          <MapView sectionId={section.id} props={section.props ?? {}} requestedLocale={locale} />
        </div>
        <DsText size="xs" tone="secondary">
          {t('sharedStructureSectionDescription')}
        </DsText>
      </DsLayoutStack>
    );
  }

  return (
    <DsLayoutStack gap="sm">
      <SectionLocalePropFields section={section} editable={editable} onPropChange={onPropChange} />
      <div className={classes.dynamicSectionNotice}>
        <DsText size="sm" weight="medium">
          {humanizeSectionType(section.type)}
        </DsText>
        <DsText size="xs" tone="secondary">
          {t('sharedStructureSectionDescription')}
        </DsText>
      </div>
    </DsLayoutStack>
  );
}

export function LocalizedCollaborativePageBodyEditor({
  fallbackText,
  editable = true,
}: LocalizedCollaborativePageBodyEditorProps) {
  const { sections, updateLocalizedSectionProps } = usePageEditor();
  const handleSectionPropChange = useCallback(
    (sectionId: string, key: PageSectionLocalePropKey, value: string) => {
      updateLocalizedSectionProps(sectionId, { [key]: value });
    },
    [updateLocalizedSectionProps],
  );

  if (sections.length === 0) {
    return <SupportingText>{fallbackText}</SupportingText>;
  }
  return (
    <div className={classes.pageSections}>
      {sections.map((section) => (
        <div key={section.id} className={classes.pageSection}>
          <CollaborativePageSectionEditor
            section={section}
            editable={editable}
            onPropChange={handleSectionPropChange}
          />
        </div>
      ))}
    </div>
  );
}
