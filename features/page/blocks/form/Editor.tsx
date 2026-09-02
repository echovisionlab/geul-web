'use client';

import { useCallback, useMemo, useState } from 'react';
import { IconForms } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Box, Group, Stack, Text } from '@mantine/core';
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
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['forms', 'searchPublished', debouncedSearch],
    queryFn: () => searchPublishedForms(debouncedSearch, 5),
    enabled: debouncedSearch.length > 0,
  });

  const { data: defaultForms, isLoading: isLoadingDefault } = useQuery({
    queryKey: ['forms', 'listPublished', 5],
    queryFn: () => listPublishedForms(5),
    enabled: debouncedSearch.length === 0,
  });

  // Get selected form info if we have a formId
  const { data: selectedForm } = useQuery({
    queryKey: ['forms', 'public', formId],
    queryFn: () => getPublicFormById(formId),
    enabled: !!formId,
  });

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
      updateProps({ ...props, [key]: value });
    },
    [updateProps, props],
  );

  return (
    <Box data-page-block-editor="form">
      {/* Header */}
      <Group gap="xs" mb="md">
        <IconForms size={18} />
        <Text size="sm" fw={500}>
          {tPageEditor('sectionTypes.form')}
        </Text>
        {selectedForm && <LabelBadge size="sm">{selectedForm.title}</LabelBadge>}
      </Group>

      <Stack gap="sm">
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
          nothingFoundMessage={isLoading ? tCommonStates('loading') : tForms('empty')}
          size="xs"
        />

        {/* Display Options */}
        <Text size="xs" c="dimmed" fw={500} mt="xs">
          {tPageEditor('blockEditor.sections.displayOptions')}
        </Text>

        <Switch
          label={tPageEditor('blockEditor.labels.showFormTitle')}
          checked={showTitle === 'true'}
          onChange={(e) => updateProp('showTitle', e.currentTarget.checked ? 'true' : 'false')}
          size="sm"
        />
      </Stack>
    </Box>
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
