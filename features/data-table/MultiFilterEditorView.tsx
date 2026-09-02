'use client';

import { IconChevronLeft, IconFilter, IconX } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';
import { Box, Divider, Group, Indicator, ScrollArea, Stack, Text } from '@mantine/core';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox, Radio, SegmentedControl } from '@/components/core/Input';
import { Popover } from '@/components/core/Popover';
import { Tooltip } from '@/components/core/Tooltip';
import { isNoValueOperator, operatorDisplayConfig, type FilterOperator } from '@/lib/types/common/filter';
import { getFilterOperatorMessageKey } from './filter-i18n';
import { MultiFilterValueInput } from './MultiFilterValueInput';
import {
  formatActiveFilterValue,
  type ActiveFilter,
  type FilterEditState,
  type FilterFieldConfig,
} from './multi-filter-model';

interface Props {
  fields: FilterFieldConfig[];
  filters: ActiveFilter[];
  selectedField: string | null;
  editState: FilterEditState;
  availableOperators: readonly FilterOperator[];
  filterBy: 'AND' | 'OR';
  allowLogicToggle: boolean;
  opened: boolean;
  isMobile: boolean;
  badgeCount: number;
  placeholder?: string;
  disabled?: boolean;
  applyMode: 'field' | 'all';
  hasChanges?: boolean;
  valueInputWithinPortal?: boolean;
  onOpenChange: (opened: boolean) => void;
  onClose: () => void;
  onSelectField: (field: string) => void;
  onBackToFields: () => void;
  onRemoveFilter: (field: string) => void;
  onClearFilters: () => void;
  onEditStateChange: (state: FilterEditState) => void;
  onOperatorChange: (operator: FilterOperator, negated: boolean) => void;
  onFilterByChange: (filterBy: 'AND' | 'OR') => void;
  onApply: () => void;
}

export function MultiFilterEditorView({
  fields,
  filters,
  selectedField,
  editState,
  availableOperators,
  filterBy,
  allowLogicToggle,
  opened,
  isMobile,
  badgeCount,
  placeholder,
  disabled = false,
  applyMode,
  hasChanges = true,
  valueInputWithinPortal = true,
  onOpenChange,
  onClose,
  onSelectField,
  onBackToFields,
  onRemoveFilter,
  onClearFilters,
  onEditStateChange,
  onOperatorChange,
  onFilterByChange,
  onApply,
}: Props) {
  const t = useTranslations('dataTable.filter');
  const tCommon = useTranslations('common');
  const tCommonActions = useTranslations('common.actions');
  const tCommonLabels = useTranslations('common.labels');
  const tCommonPlaceholders = useTranslations('common.placeholders');
  const effectivePlaceholder = placeholder ?? t('button');
  const getField = (field: string) => fields.find((candidate) => candidate.field === field);
  const selectedFieldConfig = selectedField ? getField(selectedField) : null;

  const fieldList = (
    <Box
      w={isMobile ? '100%' : 180}
      style={isMobile ? undefined : { borderRight: '1px solid var(--mantine-color-default-border)' }}
    >
      <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
        <Text size="sm" fw={500}>
          {tCommonLabels('fields')}
        </Text>
      </Box>
      <ScrollArea h={isMobile ? 'auto' : 250} mah={isMobile ? 300 : undefined}>
        <Stack gap={0} p="xs">
          {fields.map((field) => {
            const isActive = filters.some((filter) => filter.field === field.field);
            const isSelected = selectedField === field.field;
            return (
              <Group
                key={field.field}
                gap="xs"
                p="xs"
                wrap="nowrap"
                style={{
                  cursor: 'pointer',
                  borderRadius: 4,
                  backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
                }}
                onClick={() => onSelectField(field.field)}
              >
                <Checkbox
                  size="xs"
                  checked={isActive}
                  disabled={disabled}
                  onChange={() => (isActive ? onRemoveFilter(field.field) : onSelectField(field.field))}
                  onClick={(event) => event.stopPropagation()}
                />
                <Text size="sm" lineClamp={1}>
                  {field.label}
                </Text>
              </Group>
            );
          })}
        </Stack>
      </ScrollArea>
    </Box>
  );

  const configuration = (
    <Box flex={1}>
      {selectedField && selectedFieldConfig ? (
        <Stack gap={0} h="100%">
          <Box p="xs" style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}>
            <Group gap="xs">
              {isMobile ? (
                <IconButton
                  emphasis="low"
                  size="sm"
                  aria-label={t('aria.backToFields')}
                  onClick={onBackToFields}
                  disabled={disabled}
                >
                  <IconChevronLeft size={16} />
                </IconButton>
              ) : null}
              <Text size="sm" fw={500}>
                {selectedFieldConfig.label}
              </Text>
            </Group>
          </Box>

          <ScrollArea flex={1} p="sm">
            <Stack gap="md">
              <Box>
                <Text size="xs" fw={500} mb="xs">
                  {t('operator')}
                </Text>
                <Radio.Group
                  value={editState.negated ? `${editState.op}:negated` : editState.op}
                  onChange={(value) => {
                    const [operator, negated] = value.split(':') as [FilterOperator, string | undefined];
                    onOperatorChange(operator, negated === 'negated');
                  }}
                >
                  <Stack gap="xs">
                    {availableOperators.map((operator) => {
                      const config = operatorDisplayConfig[operator];
                      return (
                        <Box key={operator}>
                          <Radio
                            value={operator}
                            label={t(`operators.${getFilterOperatorMessageKey(operator)}`)}
                            size="xs"
                            disabled={disabled}
                          />
                          {config?.negatedLabel ? (
                            <Radio
                              value={`${operator}:negated`}
                              label={t(`operators.${getFilterOperatorMessageKey(operator, true)}`)}
                              size="xs"
                              mt={4}
                              disabled={disabled}
                            />
                          ) : null}
                        </Box>
                      );
                    })}
                  </Stack>
                </Radio.Group>
              </Box>

              <MultiFilterValueInput
                field={selectedFieldConfig}
                state={editState}
                onChange={onEditStateChange}
                labels={{
                  value: tCommonLabels('value'),
                  values: t('values'),
                  from: t('from'),
                  to: t('to'),
                  selectValues: tCommonPlaceholders('selectValues'),
                  enterValue: t('enterValue'),
                  trueValue: tCommon('states.true'),
                  falseValue: tCommon('states.false'),
                }}
                disabled={disabled}
                withinPortal={valueInputWithinPortal}
              />
            </Stack>
          </ScrollArea>

          {applyMode === 'field' && !isNoValueOperator(editState.op) ? (
            <Box p="xs" style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}>
              <Button size="xs" fullWidth onClick={onApply} disabled={disabled}>
                {tCommonActions('apply')}
              </Button>
            </Box>
          ) : null}
        </Stack>
      ) : (
        <Stack align="center" justify="center" h="100%" c="dimmed" py="xl">
          <Text size="sm">{t('selectField')}</Text>
        </Stack>
      )}
    </Box>
  );

  const showFooter = applyMode === 'all' || filters.length > 0;
  const footer = showFooter ? (
    <>
      <Divider />
      <Box p="xs">
        <Group justify="space-between" align="flex-start" wrap={isMobile ? 'wrap' : 'nowrap'}>
          <Box flex={1}>
            <Group gap="xs" mb={4}>
              <Text size="xs" c="dimmed">
                {t('activeFilters')}
              </Text>
              {allowLogicToggle && filters.length > 1 ? (
                <SegmentedControl
                  size="xs"
                  value={filterBy}
                  onChange={(value) => onFilterByChange(value as 'AND' | 'OR')}
                  data={[
                    { label: 'AND', value: 'AND' },
                    { label: 'OR', value: 'OR' },
                  ]}
                  disabled={disabled}
                />
              ) : null}
            </Group>
            <Group gap={4}>
              {filters.map((filter) => {
                const field = getField(filter.field);
                const value = formatActiveFilterValue(filter, field);
                return (
                  <LabelBadge
                    key={filter.field}
                    size="sm"
                    rightSection={
                      <IconButton
                        size={14}
                        tone="neutral"
                        emphasis="low"
                        aria-label={t('aria.removeFilter', { label: field?.label ?? filter.field })}
                        onClick={() => onRemoveFilter(filter.field)}
                        disabled={disabled}
                      >
                        <IconX size={10} />
                      </IconButton>
                    }
                  >
                    {field?.label ?? filter.field}{' '}
                    {t(`operators.${getFilterOperatorMessageKey(filter.op, filter.negated)}`)}
                    {value && ` "${value}"`}
                  </LabelBadge>
                );
              })}
            </Group>
          </Box>
          <Button
            size="xs"
            tone="neutral"
            emphasis="low"
            onClick={onClearFilters}
            disabled={disabled || (applyMode === 'all' && filters.length === 0)}
          >
            {tCommonActions('clearAll')}
          </Button>
          {applyMode === 'all' ? (
            <Button size="xs" onClick={onApply} disabled={disabled || !hasChanges}>
              {tCommonActions('apply')}
            </Button>
          ) : null}
        </Group>
      </Box>
    </>
  ) : null;

  const trigger = (
    <Tooltip label={effectivePlaceholder} disabled={isMobile}>
      <Indicator label={badgeCount} size={16} disabled={badgeCount === 0}>
        <IconButton
          aria-label={effectivePlaceholder}
          onClick={() => onOpenChange(!opened)}
          c={badgeCount === 0 ? 'dimmed' : undefined}
          disabled={disabled}
        >
          <IconFilter size={18} />
        </IconButton>
      </Indicator>
    </Tooltip>
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer
          opened={opened}
          onClose={onClose}
          placement="bottom"
          size="standard"
          title={t('drawerTitle')}
          closeLabel={tCommonActions('close')}
        >
          {selectedField ? configuration : fieldList}
          {footer}
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={opened} onOpenChange={onOpenChange} placement="bottom-start" size="wide">
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown padding="none">
        <Group align="stretch" gap={0} wrap="nowrap" style={{ minHeight: 300 }}>
          {fieldList}
          {configuration}
        </Group>
        {footer}
      </Popover.Dropdown>
    </Popover>
  );
}
