'use client';
import { SupportingText, Text as DsText } from '@/components/core/Typography';

import { SectionCard as DsSectionCard } from '@/components/core/Section';
import { SelectionRow } from '@/components/core/SelectionSurface';

import {
  LayoutStack as DsLayoutStack,
  LayoutInset as DsLayoutInset,
  LayoutInline as DsLayoutInline,
  LayoutInset,
} from '@/components/core/Layout';

import { IconChevronLeft, IconFilter } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { Separator as Divider, ScrollArea } from '@/components/core/Display';
import { LabelBadge } from '@/components/core/Badge';
import { Button } from '@/components/core/Button';
import { Drawer } from '@/components/core/Drawer';
import { IconButton } from '@/components/core/IconButton';
import { Checkbox } from '@/components/core/Input/Checkbox';
import { Radio } from '@/components/core/Input/Radio';
import { SegmentedControl } from '@/components/core/Input/SegmentedControl';
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
        <ScrollArea size={isMobile ? 'content' : 'standard'} limit={isMobile ? 'large' : undefined}>
          <DsLayoutInset space="xs">
            <DsLayoutStack gap="none">
              {fields.map((field) => {
                const isActive = filters.some((filter) => filter.field === field.field);
                const isSelected = selectedField === field.field;
                return (
                  <SelectionRow
                    key={field.field}
                    aria-label={field.label}
                    selected={isSelected}
                    disabled={disabled}
                    onAction={() => onSelectField(field.field)}
                    leading={
                      <Checkbox
                        aria-label={field.label}
                        size="xs"
                        checked={isActive}
                        disabled={disabled}
                        onChange={() => (isActive ? onRemoveFilter(field.field) : onSelectField(field.field))}
                        onClick={(event) => event.stopPropagation()}
                      />
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

  const configuration = (
    <DsLayoutInset space="none" flexible>
      {selectedField && selectedFieldConfig ? (
        <DsLayoutStack gap="none" fill="block" role="group" aria-label={selectedFieldConfig.label}>
          <DsSectionCard padding="none" appearance="plain" border="block-end">
            <DsLayoutInset space="xs">
              <DsLayoutInset space="none">
                <DsLayoutInline gap="xs">
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
                  <DsText size="sm" weight="medium">
                    {selectedFieldConfig.label}
                  </DsText>
                </DsLayoutInline>
              </DsLayoutInset>
            </DsLayoutInset>
          </DsSectionCard>

          <ScrollArea grow inset="sm">
            <DsLayoutStack gap="md">
              <div>
                <DsLayoutInset blockEnd="xs">
                  <DsText size="sm" weight="medium">
                    {t('operator')}
                  </DsText>
                </DsLayoutInset>
                <Radio.Group
                  aria-label={t('operator')}
                  value={editState.negated ? `${editState.op}:negated` : editState.op}
                  onChange={(value) => {
                    const [operator, negated] = value.split(':') as [FilterOperator, string | undefined];
                    onOperatorChange(operator, negated === 'negated');
                  }}
                >
                  <DsLayoutStack gap="xs">
                    {availableOperators.map((operator) => {
                      const config = operatorDisplayConfig[operator];
                      return (
                        <div key={operator}>
                          <Radio
                            value={operator}
                            label={t(`operators.${getFilterOperatorMessageKey(operator)}`)}
                            size="xs"
                            disabled={disabled}
                          />
                          {config?.negatedLabel ? (
                            <LayoutInset space="none" blockStart="xxs">
                              <Radio
                                value={`${operator}:negated`}
                                label={t(`operators.${getFilterOperatorMessageKey(operator, true)}`)}
                                size="xs"
                                disabled={disabled}
                              />
                            </LayoutInset>
                          ) : null}
                        </div>
                      );
                    })}
                  </DsLayoutStack>
                </Radio.Group>
              </div>

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
            </DsLayoutStack>
          </ScrollArea>

          {applyMode === 'field' && !isNoValueOperator(editState.op) ? (
            <DsSectionCard padding="none" appearance="plain" border="block-start">
              <DsLayoutInset space="xs">
                <DsLayoutInset space="none">
                  <Button size="xs" fullWidth onClick={onApply} disabled={disabled}>
                    {tCommonActions('apply')}
                  </Button>
                </DsLayoutInset>
              </DsLayoutInset>
            </DsSectionCard>
          ) : null}
        </DsLayoutStack>
      ) : (
        <div style={{ height: '100%' }}>
          <DsLayoutInset block="xl">
            <DsLayoutStack align="center" justify="center">
              <SupportingText>{t('selectField')}</SupportingText>
            </DsLayoutStack>
          </DsLayoutInset>
        </div>
      )}
    </DsLayoutInset>
  );

  const showFooter = applyMode === 'all' || filters.length > 0;
  const footer = showFooter ? (
    <>
      <Divider />
      <DsLayoutInset space="xs">
        <DsLayoutInset space="none">
          <DsLayoutInline justify="between" align="start" wrap={isMobile ? 'wrap' : 'nowrap'}>
            <DsLayoutInset space="none" flexible>
              <DsLayoutInset blockEnd="xxs">
                <DsLayoutInline gap="xs">
                  <DsText size="xs" tone="secondary">
                    {t('activeFilters')}
                  </DsText>
                  {allowLogicToggle && filters.length > 1 ? (
                    <SegmentedControl
                      aria-label={t('aria.logic')}
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
                </DsLayoutInline>
              </DsLayoutInset>
              <DsLayoutInline gap="xxs">
                {filters.map((filter) => {
                  const field = getField(filter.field);
                  const value = formatActiveFilterValue(filter, field);
                  return (
                    <LabelBadge
                      key={filter.field}
                      size="sm"
                      onDismiss={() => onRemoveFilter(filter.field)}
                      dismissLabel={t('aria.removeFilter', { label: field?.label ?? filter.field })}
                      dismissDisabled={disabled}
                    >
                      {field?.label ?? filter.field}{' '}
                      {t(`operators.${getFilterOperatorMessageKey(filter.op, filter.negated)}`)}
                      {value && ` "${value}"`}
                    </LabelBadge>
                  );
                })}
              </DsLayoutInline>
            </DsLayoutInset>
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
          </DsLayoutInline>
        </DsLayoutInset>
      </DsLayoutInset>
    </>
  ) : null;

  const trigger = (
    <Tooltip label={effectivePlaceholder} disabled={isMobile}>
      <IconButton
        count={badgeCount}
        aria-label={badgeCount ? `${effectivePlaceholder} (${badgeCount})` : effectivePlaceholder}
        onClick={() => onOpenChange(!opened)}
        disabled={disabled}
      >
        <IconFilter size={18} />
      </IconButton>
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
      <Popover.Dropdown padding="none" aria-label={t('drawerTitle')}>
        <div style={{ minHeight: 300 }}>
          <DsLayoutInline align="stretch" gap="none" wrap="nowrap">
            {fieldList}
            {configuration}
          </DsLayoutInline>
        </div>
        {footer}
      </Popover.Dropdown>
    </Popover>
  );
}
