'use client';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback } from 'react';
import { IconFilter, IconTable } from '@tabler/icons-react';
import { useTranslations } from 'next-intl';

import { LabelBadge } from '@/components/core/Badge';
import { MultiSelect, NumberInput, Switch } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { WorkTableProps } from './schema';
import {
  getWorkTableEditorTypeOptions,
  getWorkTableFilterFieldDefinitions,
  getWorkTableSortFieldDefinitions,
  getWorkTableStatusOptions,
  parseWorkTableFilterFields,
  parseWorkTableSortFields,
} from './spec';
import { WorkTableView } from './View';

interface WorkTableSettingsFormProps {
  props: Partial<WorkTableProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function WorkTableSettingsForm({ props, updateProps }: WorkTableSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommon = useTranslations('common');
  const tWorks = useTranslations('works');
  const workTypes = props.workTypes || '';
  const featuredOnly = props.featuredOnly || 'false';
  const statuses = props.statuses || 'WORK_STATUS_PUBLISHED';
  const filterFields = parseWorkTableFilterFields(props.filterFields);
  const sortFields = parseWorkTableSortFields(props.sortFields);
  const pageSize = props.pageSize || '10';
  const labelOverrides = {
    fieldLabels: {
      type: tCommon('labels.type'),
      status: tCommon('labels.status'),
      published_at: tCommon('labels.published'),
      updated_at: tCommon('labels.updated'),
      title: tCommon('labels.title'),
      featured: tCommon('labels.featured'),
      year: tPageEditor('blockEditor.fieldLabels.year'),
      month: tPageEditor('blockEditor.fieldLabels.month'),
      until_year: tPageEditor('blockEditor.fieldLabels.untilYear'),
      until_month: tPageEditor('blockEditor.fieldLabels.untilMonth'),
      is_present: tPageEditor('blockEditor.fieldLabels.present'),
    },
    statusOptionLabels: {
      published: tCommon('statuses.published'),
      archived: tCommon('statuses.archived'),
    },
    typeOptionLabels: {
      music_project: tWorks('types.music_project'),
      portfolio: tWorks('types.portfolio'),
      article: tWorks('types.article'),
      contribution: tWorks('types.contribution'),
    },
  } as const;

  const updateProp = useCallback(
    (key: keyof WorkTableProps, value: string) => {
      updateProps({ [key]: value });
    },
    [updateProps],
  );

  return (
    <div data-page-block-editor="work-table">
      <DsLayoutInset blockEnd="md">
        <DsLayoutInline gap="xs">
          <IconTable size={18} />
          <DsText size="sm" weight="medium">
            {tPageEditor('sectionTypes.workTable')}
          </DsText>
          <LabelBadge size="sm" tone="neutral">
            {tPageEditor('blockEditor.badges.rows', { count: pageSize })}
          </LabelBadge>
        </DsLayoutInline>
      </DsLayoutInset>

      <DsLayoutStack gap="md">
        <DsLayoutInline gap="xs">
          <IconFilter size={14} />
          <DsText size="xs" tone="secondary" weight="medium">
            {tPageEditor('blockEditor.sections.defaultFilters')}
          </DsText>
        </DsLayoutInline>

        <MultiSelect
          label={tPageEditor('blockEditor.labels.workTypes')}
          placeholder={tPageEditor('blockEditor.placeholders.allTypes')}
          data={getWorkTableEditorTypeOptions(labelOverrides)}
          value={workTypes ? workTypes.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('workTypes', values.join(','))}
          searchable
          clearable
        />

        <MultiSelect
          label={tCommon('labels.status')}
          placeholder={tPageEditor('blockEditor.placeholders.publishedByDefault')}
          data={getWorkTableStatusOptions(labelOverrides)}
          value={statuses ? statuses.split(',').filter(Boolean) : []}
          onChange={(values) => updateProp('statuses', values.join(','))}
          clearable
        />

        <Switch
          label={tPageEditor('blockEditor.labels.featuredWorksOnly')}
          checked={featuredOnly === 'true'}
          onChange={(event) => updateProp('featuredOnly', event.currentTarget.checked ? 'true' : 'false')}
        />

        <MultiSelect
          label={tPageEditor('blockEditor.labels.exposedFilters')}
          data={getWorkTableFilterFieldDefinitions(labelOverrides).map((field) => ({
            value: field.field,
            label: field.label,
          }))}
          value={filterFields}
          onChange={(values) => updateProp('filterFields', values.join(','))}
          clearable
        />

        <MultiSelect
          label={tPageEditor('blockEditor.labels.exposedSorts')}
          data={getWorkTableSortFieldDefinitions(labelOverrides).map((field) => ({
            value: field.field,
            label: field.label,
          }))}
          value={sortFields}
          onChange={(values) => updateProp('sortFields', values.join(','))}
          clearable
        />

        <NumberInput
          label={tPageEditor('blockEditor.labels.rowsPerPage')}
          value={parseInt(pageSize, 10)}
          onChange={(value) => updateProp('pageSize', String(value || 10))}
          min={1}
          max={50}
        />
      </DsLayoutStack>
    </div>
  );
}

export function WorkTableSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<WorkTableProps>) {
  return <WorkTableSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function WorkTableEditor({ sectionId, props }: BlockEditorProps<WorkTableProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <WorkTableSettingsForm props={props} updateProps={updateProps} />;
}

export function WorkTableCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<WorkTableProps>) {
  return <WorkTableView sectionId={sectionId} props={{ ...props }} />;
}
