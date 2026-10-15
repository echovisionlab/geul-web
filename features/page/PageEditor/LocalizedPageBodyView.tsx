'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { LayoutStack } from '@/components/core/Layout';
import { SupportingText, Text } from '@/components/core/Typography';
import { MapView } from '@/features/page/blocks/map/View';
import {
  humanizeSectionType,
  PageSectionLocalePropFields,
  type PageSectionLocalePropKey,
} from '@/features/translation/PageSectionLocalePropFields';
import type { SectionMeta } from './types';
import classes from '@/features/translation/StructuredLocaleContentPreview.module.css';

export function LocalizedPageBodyView({
  sections,
  locale,
  editable,
  fallbackText,
  renderRichText,
  onPropChange,
}: {
  sections: readonly SectionMeta[];
  locale: string;
  editable: boolean;
  fallbackText: string;
  renderRichText: (section: SectionMeta) => ReactNode;
  onPropChange: (sectionId: string, key: PageSectionLocalePropKey, value: string) => void;
}) {
  const t = useTranslations('translationPanel.activeEditLocale');
  const renderSection = (section: SectionMeta): ReactNode => {
    if (section.type === 'columns') {
      const ratios = String(section.props?.columnRatios ?? '')
        .split(':')
        .map(Number);
      return (
        <div
          className={classes.columns}
          style={{ gridTemplateColumns: section.columns.map((_, index) => `${ratios[index] || 1}fr`).join(' ') }}
        >
          {section.columns.map((column) => (
            <LayoutStack key={column.id} gap="md">
              {column.sections.map((child) => (
                <div key={child.id}>{renderSection(child)}</div>
              ))}
            </LayoutStack>
          ))}
        </div>
      );
    }
    if (section.type === 'rich-text') {
      return <div data-room-rich-text>{renderRichText(section)}</div>;
    }
    if (section.type === 'map') {
      return (
        <LayoutStack gap="sm">
          <div className={classes.dynamicSectionPreview}>
            <MapView sectionId={section.id} props={section.props ?? {}} requestedLocale={locale} />
          </div>
          <Text size="xs" tone="secondary">
            {t('sharedStructureSectionDescription')}
          </Text>
        </LayoutStack>
      );
    }
    return (
      <LayoutStack gap="sm">
        <PageSectionLocalePropFields section={section} editable={editable} onPropChange={onPropChange} />
        <div className={classes.dynamicSectionNotice}>
          <Text size="sm" weight="medium">
            {humanizeSectionType(section.type)}
          </Text>
          <Text size="xs" tone="secondary">
            {t('sharedStructureSectionDescription')}
          </Text>
        </div>
      </LayoutStack>
    );
  };
  return (
    <div className={classes.pageSections} data-page-body-mounted>
      {sections.length ? (
        sections.map((section) => (
          <div key={section.id} className={classes.pageSection}>
            {renderSection(section)}
          </div>
        ))
      ) : (
        <SupportingText>{fallbackText}</SupportingText>
      )}
    </div>
  );
}
