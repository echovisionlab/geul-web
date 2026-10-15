'use client';

import { LayoutStack as DsLayoutStack } from '@/components/core/Layout';
import type { ChangeEvent } from 'react';
import { PAGE_LOCALE_SECTION_PROP_KEYS } from '@echovisionlab/geul-common/collaboration/page';
import { useTranslations } from 'next-intl';

import { Textarea, TextInput } from '@/components/core/Input';

export type PageSectionLocalePropKey = (typeof PAGE_LOCALE_SECTION_PROP_KEYS)[number];

interface SectionWithLocaleProps {
  id: string;
  props?: unknown;
}

export function humanizeSectionType(type: string) {
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function getSectionLocaleTextProps(section: SectionWithLocaleProps) {
  if (!section.props || typeof section.props !== 'object') {
    return [];
  }
  const props = section.props as Record<string, unknown>;
  return PAGE_LOCALE_SECTION_PROP_KEYS.flatMap((key) => {
    const value = props[key];
    return Object.hasOwn(props, key) && typeof value === 'string' ? [{ key, value }] : [];
  });
}

export function PageSectionLocalePropFields({
  section,
  editable = true,
  onPropChange,
}: {
  section: SectionWithLocaleProps;
  editable?: boolean;
  onPropChange: (sectionId: string, key: PageSectionLocalePropKey, value: string) => void;
}) {
  const t = useTranslations('translationPanel.activeEditLocale');
  const tCommonLabels = useTranslations('common.labels');
  const textProps = getSectionLocaleTextProps(section);
  if (textProps.length === 0) {
    return null;
  }

  return (
    <DsLayoutStack gap="xs">
      {textProps.map(({ key, value }) => {
        const fieldLabel =
          key === 'label'
            ? tCommonLabels('label')
            : key === 'title'
              ? tCommonLabels('title')
              : key === 'description'
                ? tCommonLabels('description')
                : t(`sectionFieldLabels.${key}`);
        const sharedProps = {
          key: `${section.id}-${key}`,
          label: fieldLabel,
          value,
          disabled: !editable,
          onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            onPropChange(section.id, key, event.currentTarget.value),
        };
        return key === 'description' || key === 'caption' || key === 'copyJson' ? (
          <Textarea {...sharedProps} minRows={2} autosize />
        ) : (
          <TextInput {...sharedProps} />
        );
      })}
    </DsLayoutStack>
  );
}
