'use client';

import { HierarchyIndent } from '@/components/core/Hierarchy';

import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset, LayoutInline } from '@/components/core/Layout';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { isMenuItemLabelApplicableToLocale } from '@/features/translation/menu-translation-model';
import type { MenuItem } from './menu-editor-model';

export function MenuTargetItemsEditor({
  items,
  locale,
  requestedLabels,
  editable,
  onChange,
  onUseSource,
}: {
  items: readonly MenuItem[];
  locale: string;
  requestedLabels: Readonly<Record<string, string>>;
  editable: boolean;
  onChange: (itemId: string, value: string) => void;
  onUseSource: (itemId: string) => void;
}) {
  const t = useTranslations('translationPanelMenu.previewModal.fields');
  if (items.length === 0) {
    return <DsText tone="secondary">-</DsText>;
  }
  return (
    <DsLayoutStack gap="xxs">
      {items.map((item) => (
        <TargetItem
          key={item.id}
          item={item}
          locale={locale}
          requestedLabels={requestedLabels}
          editable={editable}
          onChange={onChange}
          onUseSource={onUseSource}
          label={t('localizedLabelForLocale', { locale })}
        />
      ))}
    </DsLayoutStack>
  );
}

function TargetItem({
  item,
  locale,
  requestedLabels,
  editable,
  onChange,
  onUseSource,
  label,
}: {
  item: MenuItem;
  locale: string;
  requestedLabels: Readonly<Record<string, string>>;
  editable: boolean;
  onChange: (itemId: string, value: string) => void;
  onUseSource: (itemId: string) => void;
  label: string;
}) {
  const tCommonLabels = useTranslations('common.labels');
  const applicable = isMenuItemLabelApplicableToLocale(item, locale);
  const explicit = Object.hasOwn(requestedLabels, item.id);
  return (
    <DsLayoutInset block="xxs">
      <DsLayoutStack gap="xs">
        <TextInput
          label={label}
          value={item.label}
          onChange={(event) => onChange(item.id, event.currentTarget.value)}
          disabled={!editable || !applicable}
        />
        <LayoutInline justify="end" gap="none">
          <Button
            size="xs"
            emphasis="low"
            tone="neutral"
            onClick={() => onUseSource(item.id)}
            disabled={!editable || !applicable || !explicit}
          >
            {tCommonLabels('source')}
          </Button>
        </LayoutInline>
        {item.children?.length ? (
          <HierarchyIndent>
            <DsLayoutStack gap="xs">
              {item.children.map((child) => (
                <TargetItem
                  key={child.id}
                  item={child}
                  locale={locale}
                  requestedLabels={requestedLabels}
                  editable={editable}
                  onChange={onChange}
                  onUseSource={onUseSource}
                  label={label}
                />
              ))}
            </DsLayoutStack>
          </HierarchyIndent>
        ) : null}
      </DsLayoutStack>
    </DsLayoutInset>
  );
}
