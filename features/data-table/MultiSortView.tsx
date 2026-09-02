'use client';

import type { RefObject } from 'react';
import {
  IconArrowDown,
  IconArrowUp,
  IconGripVertical,
  IconSortAscending,
  IconSortDescending,
  IconX,
} from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Indicator, ScrollArea, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox } from '@/components/core/Input';
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
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const isMobile = useMediaQuery('(max-width: 768px)');
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
    <Box
      w={isMobile ? '100%' : 180}
      style={isMobile ? undefined : { borderRight: '1px solid var(--mantine-color-default-border)' }}
    >
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="sm" fw={500}>
          {tCommonLabels('fields')}
        </Text>
      </Box>
      <ScrollArea h={isMobile ? 'auto' : 200} mah={isMobile ? 250 : undefined}>
        <Stack gap={0} p="xs">
          {fields.map((field) => {
            const sort = getSortForField(field.field);
            const canAdd = sorts.length < maxSorts || Boolean(sort);

            return (
              <Group
                key={field.field}
                gap="xs"
                p="xs"
                wrap="nowrap"
                justify="space-between"
                style={{
                  cursor: canAdd ? 'pointer' : 'not-allowed',
                  borderRadius: 4,
                  opacity: canAdd ? 1 : 0.5,
                }}
                onClick={() => canAdd && onToggleField(field.field)}
              >
                <Group gap="xs" wrap="nowrap">
                  <Checkbox
                    size="xs"
                    checked={Boolean(sort)}
                    disabled={!canAdd || disabled}
                    onChange={() => onToggleField(field.field)}
                    onClick={(event) => event.stopPropagation()}
                  />
                  <Text size="sm" lineClamp={1}>
                    {field.label}
                  </Text>
                </Group>

                {sort && (
                  <IconButton
                    aria-label={t('aria.toggleDirection', { label: field.label })}
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
                )}
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );

  const actions = onApply ? (
    <Group grow>
      <Button size="xs" tone="neutral" emphasis="low" onClick={onClear} disabled={disabled || sorts.length === 0}>
        {tCommonActions('clearAll')}
      </Button>
      <Button size="xs" onClick={onApply} disabled={disabled || !hasChanges}>
        {tCommonActions('apply')}
      </Button>
    </Group>
  ) : (
    <Button size="xs" tone="neutral" emphasis="low" fullWidth onClick={onClear}>
      {tCommonActions('clearAll')}
    </Button>
  );

  const sortOrderPanel = (
    <Box flex={1}>
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="sm" fw={500}>
          {tCommonLabels('sortOrder')}
        </Text>
      </Box>

      {sorts.length > 0 ? (
        <Stack gap={0}>
          <ScrollArea h={isMobile ? 'auto' : 160} mah={isMobile ? 200 : undefined}>
            <Stack gap="xs" p="xs">
              {sorts.map((sort, index) => {
                const label = getFieldConfig(sort.field)?.label ?? sort.field;

                return (
                  <Group
                    key={sort.field}
                    gap="xs"
                    wrap="nowrap"
                    justify="space-between"
                    p="xs"
                    style={{
                      backgroundColor: 'var(--mantine-color-default-hover)',
                      borderRadius: 4,
                    }}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <IconButton
                        aria-label={t('aria.reorder', { label })}
                        size="xs"
                        emphasis="low"
                        style={{ cursor: 'grab' }}
                      >
                        <IconGripVertical size={14} />
                      </IconButton>
                      <Text size="sm" fw={500}>
                        {index + 1}.
                      </Text>
                      <Text size="sm" lineClamp={1}>
                        {label}
                      </Text>
                    </Group>

                    <Group gap={4} wrap="nowrap">
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
                        size="xs"
                        emphasis="medium"
                        disabled={disabled}
                        onClick={() => onToggleDirection(sort.field)}
                      >
                        {sort.direction === 'asc' ? <IconSortAscending size={14} /> : <IconSortDescending size={14} />}
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
                    </Group>
                  </Group>
                );
              })}
            </Stack>
          </ScrollArea>
          <Divider />
          <Box p="xs">{actions}</Box>
        </Stack>
      ) : (
        <Stack gap={0}>
          <Stack align="center" justify="center" h={isMobile ? 100 : 160} c="dimmed">
            <Text size="sm">{t('none')}</Text>
            <Text size="xs">{isMobile ? t('selectAbove') : t('selectFromLeft')}</Text>
          </Stack>
          {onApply && (
            <>
              <Divider />
              <Box p="xs">{actions}</Box>
            </>
          )}
        </Stack>
      )}
    </Box>
  );

  const trigger = (
    <Tooltip label={sortDisplay} disabled={isMobile}>
      <Indicator label={appliedSorts.length} size={16} disabled={appliedSorts.length === 0}>
        <IconButton
          aria-label={effectivePlaceholder}
          onClick={() => onOpenedChange(!opened)}
          c={appliedSorts.length === 0 ? 'dimmed' : undefined}
        >
          {appliedSorts[0]?.direction === 'asc' ? <IconSortAscending size={18} /> : <IconSortDescending size={18} />}
        </IconButton>
      </Indicator>
    </Tooltip>
  );

  if (isMobile) {
    return (
      <>
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
          <Stack gap="md">
            {fieldListPanel}
            {sorts.length > 0 && sortOrderPanel}
          </Stack>
        </Drawer>
      </>
    );
  }

  return (
    <>
      <span ref={markerRef} style={{ display: 'none' }} />
      <Popover open={opened} onOpenChange={onOpenedChange} placement="bottom-start" size="wide">
        <Popover.Target>{trigger}</Popover.Target>
        <Popover.Dropdown padding="none">
          <Group align="stretch" gap={0} wrap="nowrap" style={{ minHeight: 250 }}>
            {fieldListPanel}
            {sortOrderPanel}
          </Group>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
