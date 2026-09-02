'use client';

import { useCallback } from 'react';
import { TranscodeEntityType } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { useTranslations } from 'next-intl';
import { Stack, Text } from '@mantine/core';
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
          <Stack key={column.id} gap="md">
            {column.sections.map((childSection) => (
              <CollaborativePageSectionEditor
                key={childSection.id}
                section={childSection}
                editable={editable}
                onPropChange={onPropChange}
              />
            ))}
          </Stack>
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
      <Stack gap="sm">
        <div className={classes.dynamicSectionPreview}>
          <MapView sectionId={section.id} props={section.props ?? {}} requestedLocale={locale} />
        </div>
        <Text size="xs" c="dimmed">
          {t('sharedStructureSectionDescription')}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <SectionLocalePropFields section={section} editable={editable} onPropChange={onPropChange} />
      <div className={classes.dynamicSectionNotice}>
        <Text size="sm" fw={500}>
          {humanizeSectionType(section.type)}
        </Text>
        <Text size="xs" c="dimmed">
          {t('sharedStructureSectionDescription')}
        </Text>
      </div>
    </Stack>
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
    return (
      <Text size="sm" c="dimmed">
        {fallbackText}
      </Text>
    );
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
