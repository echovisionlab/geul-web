'use client';
import { breakpointQuery } from '@/components/core/Layout/breakpoints';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { SelectionRow } from '@/components/core/SelectionSurface';

import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
} from '@/components/core/Layout';
import { useId, type RefObject } from 'react';
import { IconArrowDown, IconArrowUp, IconSortAscending, IconSortDescending, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Separator as Divider, ScrollArea } from '@/components/core/Display';
import { useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox } from '@/components/core/Input/Checkbox';
import { Popover } from '@/components/core/Popover';
import { Tooltip } from '@/components/core/Tooltip';
import type { TableSortSpec } from '@/lib/utils/table-query';

export interface SortFieldConfig {
  field: string;
  label: string;
}

interface MultiSortViewProps {
  fields: SortFieldConfig[];
  sorts: TableSortSpec[];
  appliedSorts?: TableSortSpec[];
  placeholder?: string;
  maxSorts: number;
  opened: boolean;
  markerRef: RefObject<HTMLSpanElement | null>;
  disabled?: boolean;
  applying?: boolean;
  hasChanges?: boolean;
  onOpenedChange: (opened: boolean) => void;
  onToggleField: (field: string) => void;
  onToggleDirection: (field: string) => void;
  onMoveSort: (field: string, direction: 'up' | 'down') => void;
  onRemoveSort: (field: string) => void;
  onClear: () => void;
  onApply?: () => void;
}

export function MultiSortView({
  fields,
  sorts,
  appliedSorts = sorts,
  placeholder,
  maxSorts,
  opened,
  markerRef,
  disabled = false,
  applying = false,
  hasChanges = false,
  onOpenedChange,
  onToggleField,
  onToggleDirection,
  onMoveSort,
  onRemoveSort,
  onClear,
  onApply,
}: MultiSortViewProps) {
  const t = useTranslations('dataTable.sort');
  const directionDescriptionId = useId();
  const directionDescriptions = (
    <>
      <span hidden id={`${directionDescriptionId}-asc`}>
        {t('aria.directionAscending')}
      </span>
      <span hidden id={`${directionDescriptionId}-desc`}>
        {t('aria.directionDescending')}
      </span>
    </>
  );
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const isMobile = useMediaQuery(breakpointQuery('sm'));
  const effectivePlaceholder = placeholder ?? t('button');
  const getFieldConfig = (field: string) => fields.find((config) => config.field === field);
  const getSortForField = (field: string) => sorts.find((sort) => sort.field === field);

  const sortDisplay = (() => {
    if (appliedSorts.length === 0) {
      return effectivePlaceholder;
    }
    if (appliedSorts.length === 1) {
      const sort = appliedSorts[0];
      return getFieldConfig(sort.field)?.label ?? sort.field;
    }
    return t('count', { count: appliedSorts.length });
  })();

  const fieldListPanel = (
    <div style={{ width: isMobile ? '100%' : 180 }}>
      <DsSectionCard padding="none" appearance="plain" border={isMobile ? 'none' : 'inline-end'}>
        <DsSectionCard padding="none" appearance="plain" border="block-end">
          <DsLayoutInset space="xs">
            <DsLayoutInset space="none">
              <DsText size="sm" weight="medium">
                {tCommonLabels('fields')}
              </DsText>
            </DsLayoutInset>
          </DsLayoutInset>
        </DsSectionCard>
        <ScrollArea size={isMobile ? 'content' : 'standard'} limit={isMobile ? 'standard' : undefined}>
          <DsLayoutInset space="xs">
            <DsLayoutStack gap="none">
              {fields.map((field) => {
                const sort = getSortForField(field.field);
                const canAdd = sorts.length < maxSorts || Boolean(sort);

                return (
                  <SelectionRow
                    key={field.field}
                    aria-label={field.label}
                    selected={Boolean(sort)}
                    disabled={!canAdd || disabled}
                    onAction={() => onToggleField(field.field)}
                    leading={
                      <Checkbox
                        aria-label={field.label}
                        size="xs"
                        checked={Boolean(sort)}
                        disabled={!canAdd || disabled}
                        onChange={() => onToggleField(field.field)}
                      />
                    }
                    trailing={
                      sort ? (
                        <IconButton
                          aria-label={t('aria.toggleDirection', { label: field.label })}
                          aria-describedby={`${directionDescriptionId}-${sort.direction}`}
                          size="xs"
                          emphasis="low"
                          disabled={disabled}
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleDirection(field.field);
                          }}
                        >
                          {sort.direction === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />}
                        </IconButton>
                      ) : null
                    }
                  >
                    <DsText size="sm" lines={1}>
                      {field.label}
                    </DsText>
                  </SelectionRow>
                );
              })}
            </DsLayoutStack>
          </DsLayoutInset>
        </ScrollArea>
      </DsSectionCard>
    </div>
  );

  const actions = onApply ? (
    <DsLayoutInline grow>
      <Button size="xs" tone="neutral" emphasis="low" onClick={onClear} disabled={disabled || sorts.length === 0}>
        {tCommonActions('clearAll')}
      </Button>
      <Button size="xs" onClick={onApply} loading={applying} disabled={disabled || !hasChanges}>
        {tCommonActions('apply')}
      </Button>
    </DsLayoutInline>
  ) : (
    <Button size="xs" tone="neutral" emphasis="low" fullWidth onClick={onClear}>
      {tCommonActions('clearAll')}
    </Button>
  );

  const sortOrderPanel = (
    <DsLayoutInset space="none" flexible>
      <DsSectionCard padding="none" appearance="plain" border="block-end">
        <DsLayoutInset space="xs">
          <DsLayoutInset space="none">
            <DsText size="sm" weight="medium">
              {tCommonLabels('sortOrder')}
            </DsText>
          </DsLayoutInset>
        </DsLayoutInset>
      </DsSectionCard>

      {sorts.length > 0 ? (
        <DsLayoutStack gap="none">
          <ScrollArea size={isMobile ? 'content' : 'compact'} limit={isMobile ? 'standard' : undefined}>
            <DsLayoutInset space="xs">
              <DsLayoutStack gap="xs">
                {sorts.map((sort, index) => {
                  const label = getFieldConfig(sort.field)?.label ?? sort.field;

                  return (
                    <SelectionRow
                      key={sort.field}
                      appearance="muted"
                      trailing={
                        <DsLayoutInline gap="xxs" wrap="nowrap">
                          <IconButton
                            aria-label={t('aria.moveUp', { label })}
                            size="xs"
                            emphasis="low"
                            disabled={index === 0 || disabled}
                            onClick={() => onMoveSort(sort.field, 'up')}
                          >
                            <IconArrowUp size={12} />
                          </IconButton>
                          <IconButton
                            aria-label={t('aria.moveDown', { label })}
                            size="xs"
                            emphasis="low"
                            disabled={index === sorts.length - 1 || disabled}
                            onClick={() => onMoveSort(sort.field, 'down')}
                          >
                            <IconArrowDown size={12} />
                          </IconButton>
                          <IconButton
                            aria-label={t('aria.toggleDirection', { label })}
                            aria-describedby={`${directionDescriptionId}-${sort.direction}`}
                            size="xs"
                            emphasis="medium"
                            disabled={disabled}
                            onClick={() => onToggleDirection(sort.field)}
                          >
                            {sort.direction === 'asc' ? (
                              <IconSortAscending size={14} />
                            ) : (
                              <IconSortDescending size={14} />
                            )}
                          </IconButton>
                          <IconButton
                            aria-label={t('aria.removeSort', { label })}
                            size="xs"
                            tone="danger"
                            emphasis="low"
                            disabled={disabled}
                            onClick={() => onRemoveSort(sort.field)}
                          >
                            <IconX size={12} />
                          </IconButton>
                        </DsLayoutInline>
                      }
                    >
                      <DsLayoutInline gap="xs" wrap="nowrap">
                        <DsText size="sm" weight="medium">
                          {index + 1}.
                        </DsText>
                        <DsText size="sm" lines={1}>
                          {label}
                        </DsText>
                      </DsLayoutInline>
                    </SelectionRow>
                  );
                })}
              </DsLayoutStack>
            </DsLayoutInset>
          </ScrollArea>
          <Divider />
          <DsLayoutInset space="xs">
            <DsLayoutInset space="none">{actions}</DsLayoutInset>
          </DsLayoutInset>
        </DsLayoutStack>
      ) : (
        <DsLayoutStack gap="none">
          <div style={{ height: isMobile ? 100 : 160 }}>
            <DsLayoutStack align="center" justify="center">
              <SupportingText>{t('none')}</SupportingText>
              <DsText size="xs">{isMobile ? t('selectAbove') : t('selectFromLeft')}</DsText>
            </DsLayoutStack>
          </div>
          {onApply && (
            <>
              <Divider />
              <DsLayoutInset space="xs">
                <DsLayoutInset space="none">{actions}</DsLayoutInset>
              </DsLayoutInset>
            </>
          )}
        </DsLayoutStack>
      )}
    </DsLayoutInset>
  );

  const trigger = (
    <Tooltip label={sortDisplay} disabled={isMobile}>
      <IconButton
        count={appliedSorts.length}
        aria-label={appliedSorts.length ? `${effectivePlaceholder} (${appliedSorts.length})` : effectivePlaceholder}
        onClick={() => onOpenedChange(!opened)}
      >
        {appliedSorts[0]?.direction === 'asc' ? <IconSortAscending size={18} /> : <IconSortDescending size={18} />}
      </IconButton>
    </Tooltip>
  );

  if (isMobile) {
    return (
      <>
        {directionDescriptions}
        <span ref={markerRef} style={{ display: 'none' }} />
        {trigger}
        <Drawer
          opened={opened}
          onClose={() => onOpenedChange(false)}
          placement="bottom"
          size="auto"
          title={t('button')}
          closeLabel={tCommonActions('close')}
        >
          <DsLayoutStack gap="md">
            {fieldListPanel}
            {sorts.length > 0 && sortOrderPanel}
          </DsLayoutStack>
        </Drawer>
      </>
    );
  }

  return (
    <>
      {directionDescriptions}
      <span ref={markerRef} style={{ display: 'none' }} />
      <Popover open={opened} onOpenChange={onOpenedChange} placement="bottom-start" size="wide">
        <Popover.Target>{trigger}</Popover.Target>
        <Popover.Dropdown padding="none" aria-label={t('button')}>
          <div style={{ minHeight: 250 }}>
            <DsLayoutInline align="stretch" gap="none" wrap="nowrap">
              {fieldListPanel}
              {sortOrderPanel}
            </DsLayoutInline>
          </div>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
