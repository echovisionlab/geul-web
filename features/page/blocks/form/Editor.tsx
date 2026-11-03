'use client';
import { InputValidationGlyph } from '@/components/core/Input/InputGlyphs';
import { QueryErrorAlert } from '@/features/application-error/QueryErrorAlert';

import {
  LayoutInline as DsLayoutInline,
  LayoutInset as DsLayoutInset,
  LayoutStack as DsLayoutStack,
} from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { useCallback, useMemo, useState } from 'react';
import { IconForms } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';

import { useDebouncedValue } from '@mantine/hooks';
import { LabelBadge } from '@/components/core/Badge';
import { Select, Switch } from '@/components/core/Input';
import { usePageEditor } from '@/features/page/PageEditor/PageEditorContext';
import { getPublicFormById, listPublishedForms, searchPublishedForms } from '@/lib/queries/form-browser';
import type { BlockCanvasPreviewProps, BlockEditorProps, BlockSettingsEditorProps } from '../types';
import type { FormProps } from './schema';
import { FormView } from './View';

interface FormSettingsFormProps {
  props: Partial<FormProps>;
  updateProps: (props: Record<string, unknown>) => void;
}

function FormSettingsForm({ props, updateProps }: FormSettingsFormProps) {
  const tPageEditor = useTranslations('pageEditor');
  const tCommonStates = useTranslations('common.states');
  const tForms = useTranslations('forms');

  const formId = props.formId || '';
  const showTitle = props.showTitle || 'true';

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch] = useDebouncedValue(searchTerm, 300);

  // Fetch forms based on search term or default list
  const searchFormsQuery = useQuery({
    queryKey: ['forms', 'searchPublished', debouncedSearch],
    queryFn: () => searchPublishedForms(debouncedSearch, 5),
    enabled: debouncedSearch.length > 0,
  });
  const { data: searchResults, isLoading: isSearching } = searchFormsQuery;

  const defaultFormsQuery = useQuery({
    queryKey: ['forms', 'listPublished', 5],
    queryFn: () => listPublishedForms(5),
    enabled: debouncedSearch.length === 0,
  });
  const { data: defaultForms, isLoading: isLoadingDefault } = defaultFormsQuery;

  // Get selected form info if we have a formId
  const selectedFormQuery = useQuery({
    queryKey: ['forms', 'public', formId],
    queryFn: () => getPublicFormById(formId),
    enabled: !!formId,
  });
  const { data: selectedForm } = selectedFormQuery;

  const forms = debouncedSearch.length > 0 ? searchResults : defaultForms;
  const isLoading = debouncedSearch.length > 0 ? isSearching : isLoadingDefault;

  // Build select options
  const formOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];

    // Add selected form if it's not in the current list
    if (selectedForm && formId) {
      const isInList = forms?.some((f) => f.id === formId);
      if (!isInList) {
        options.push({ value: selectedForm.id, label: selectedForm.title });
      }
    }

    // Add forms from the list
    if (forms) {
      for (const form of forms) {
        if (!options.some((o) => o.value === form.id)) {
          options.push({ value: form.id, label: form.title });
        }
      }
    }

    return options;
  }, [forms, selectedForm, formId]);

  const updateProp = useCallback(
    (key: keyof FormProps, value: string) => {
      updateProps({ [key]: value });
    },
    [updateProps],
  );

  return (
    <div data-page-block-editor="form">
      <QueryErrorAlert queries={[searchFormsQuery, defaultFormsQuery, selectedFormQuery]} />
      {/* Header */}
      <DsLayoutInset blockEnd="md">
        <DsLayoutInline gap="xs">
          <IconForms size={18} />
          <DsText size="sm" weight="medium">
            {tPageEditor('sectionTypes.form')}
          </DsText>
          {selectedForm && <LabelBadge size="sm">{selectedForm.title}</LabelBadge>}
        </DsLayoutInline>
      </DsLayoutInset>

      <DsLayoutStack gap="md">
        {/* Form Selection */}
        <Select
          label={tPageEditor('blockEditor.labels.selectForm')}
          placeholder={tForms('searchPlaceholder')}
          data={formOptions}
          value={formId}
          onChange={(value) => updateProp('formId', value || '')}
          searchable
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          aria-busy={isLoading || selectedFormQuery.isLoading}
          rightSection={
            isLoading || selectedFormQuery.isLoading ? <InputValidationGlyph status="checking" /> : undefined
          }
          nothingFoundMessage={isLoading ? tCommonStates('loading') : tForms('empty')}
        />

        {/* Display Options */}
        <DsLayoutInset blockStart="xs">
          <DsText size="xs" tone="secondary" weight="medium">
            {tPageEditor('blockEditor.sections.displayOptions')}
          </DsText>
        </DsLayoutInset>

        <Switch
          label={tPageEditor('blockEditor.labels.showFormTitle')}
          checked={showTitle === 'true'}
          onChange={(e) => updateProp('showTitle', e.currentTarget.checked ? 'true' : 'false')}
        />
      </DsLayoutStack>
    </div>
  );
}

export function FormSettingsEditor({ props, updateSharedProps }: BlockSettingsEditorProps<FormProps>) {
  return <FormSettingsForm props={props} updateProps={updateSharedProps} />;
}

export function FormEditor({ sectionId, props }: BlockEditorProps<FormProps>) {
  const { updateSection } = usePageEditor();
  const updateProps = useCallback(
    (nextProps: Record<string, unknown>) => {
      updateSection(sectionId, { props: nextProps });
    },
    [sectionId, updateSection],
  );

  return <FormSettingsForm props={props} updateProps={updateProps} />;
}

export function FormCanvasPreview({ sectionId, props }: BlockCanvasPreviewProps<FormProps>) {
  return <FormView sectionId={sectionId} props={{ ...props }} preview />;
}
