'use client';

import { useTranslations } from 'next-intl';
import { Divider, Group, Modal, Stack } from '@mantine/core';
import { Button } from '@/components/core/Button';
import { NumberInput, PasswordInput, Select, Switch, TextInput } from '@/components/core/Input';
import {
  DEFAULT_PROVIDER_FORM,
  type LLMProviderPresetFormType,
  type ProviderFormState,
  type ProviderFormType,
} from './provider-form';

interface Props {
  opened: boolean;
  editing: boolean;
  form: ProviderFormState;
  saving: boolean;
  onChange: (form: ProviderFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function TranslationProviderModal({ opened, editing, form, saving, onChange, onClose, onSubmit }: Props) {
  const t = useTranslations('translationSettingsPage');
  const tCommonActions = useTranslations('common.actions');
  const patch = (values: Partial<ProviderFormState>) => onChange({ ...form, ...values });
  const providerTypes: { value: ProviderFormType; label: string }[] = [
    { value: 'llm', label: t('providerTypes.llm') },
    { value: 'deepl', label: t('providerTypes.deepl') },
  ];
  const llmPresets: { value: LLMProviderPresetFormType; label: string }[] = [
    { value: 'gemini', label: t('llmPresets.gemini') },
    { value: 'openai-compatible', label: t('llmPresets.openaiCompatible') },
  ];

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={editing ? t('modal.editProviderTitle') : t('modal.createProviderTitle')}
      size="md"
    >
      <Stack gap="md">
        <TextInput
          label={t('fields.providerName.label')}
          value={form.name}
          onChange={(event) => patch({ name: event.currentTarget.value })}
        />
        <Select
          label={t('fields.providerType.label')}
          data={providerTypes}
          value={form.type}
          onChange={(value) => value && patch({ type: value as ProviderFormType })}
          allowDeselect={false}
        />
        <Group grow>
          <NumberInput
            label={t('fields.providerPriority.label')}
            description={t('fields.providerPriority.description')}
            value={form.priority}
            onChange={(value) => patch({ priority: Number.isFinite(Number(value)) ? Number(value) : form.priority })}
          />
          <Switch
            label={t('fields.providerActive.label')}
            description={t('fields.providerActive.description')}
            checked={form.isActive}
            mt={24}
            onChange={(event) => patch({ isActive: event.currentTarget.checked })}
          />
        </Group>

        <Divider label={t('modal.credentialsSection')} labelPosition="left" />
        {form.type === 'llm' ? (
          <>
            <Select
              label={t('fields.llmPreset.label')}
              data={llmPresets}
              value={form.llmPreset}
              onChange={(value) => {
                if (value) {
                  patch({
                    llmPreset: value as LLMProviderPresetFormType,
                    llmModel:
                      value === 'gemini' && form.llmModel.trim() === ''
                        ? DEFAULT_PROVIDER_FORM.llmModel
                        : form.llmModel,
                  });
                }
              }}
              allowDeselect={false}
            />
            <PasswordInput
              label={t('fields.llmApiKey.label')}
              description={editing ? t('fields.llmApiKey.descriptionEdit') : undefined}
              value={form.llmApiKey}
              onChange={(event) => patch({ llmApiKey: event.currentTarget.value })}
            />
            <TextInput
              label={t('fields.llmModel.label')}
              description={t('fields.llmModel.description')}
              value={form.llmModel}
              onChange={(event) => patch({ llmModel: event.currentTarget.value })}
            />
            <TextInput
              label={t('fields.llmApiBaseUrl.label')}
              description={t('fields.llmApiBaseUrl.description')}
              value={form.llmApiBaseUrl}
              onChange={(event) => patch({ llmApiBaseUrl: event.currentTarget.value })}
            />
            <Group grow>
              <NumberInput
                label={t('fields.llmInputPrice.label')}
                description={t('fields.llmInputPrice.description')}
                min={0}
                decimalScale={4}
                value={form.llmInputTokenPriceUsdPerMillion}
                onChange={(value) => patch({ llmInputTokenPriceUsdPerMillion: value === '' ? '' : Number(value) })}
              />
              <NumberInput
                label={t('fields.llmOutputPrice.label')}
                description={t('fields.llmOutputPrice.description')}
                min={0}
                decimalScale={4}
                value={form.llmOutputTokenPriceUsdPerMillion}
                onChange={(value) => patch({ llmOutputTokenPriceUsdPerMillion: value === '' ? '' : Number(value) })}
              />
            </Group>
            <Group grow>
              <NumberInput
                label={t('fields.llmMaxContextTokens.label')}
                description={t('fields.llmMaxContextTokens.description')}
                min={0}
                value={form.llmMaxContextTokens}
                onChange={(value) => patch({ llmMaxContextTokens: value === '' ? '' : Number(value) })}
              />
              <NumberInput
                label={t('fields.llmMaxOutputTokens.label')}
                description={t('fields.llmMaxOutputTokens.description')}
                min={0}
                value={form.llmMaxOutputTokens}
                onChange={(value) => patch({ llmMaxOutputTokens: value === '' ? '' : Number(value) })}
              />
            </Group>
            <Group grow>
              <NumberInput
                label={t('fields.llmTemperature.label')}
                description={t('fields.llmTemperature.description')}
                min={0}
                max={2}
                step={0.1}
                decimalScale={2}
                value={form.llmTemperature}
                onChange={(value) => patch({ llmTemperature: value === '' ? '' : Number(value) })}
              />
              <Switch
                label={t('fields.llmSupportsJsonMode.label')}
                description={t('fields.llmSupportsJsonMode.description')}
                checked={form.llmSupportsJsonMode}
                mt={24}
                onChange={(event) => patch({ llmSupportsJsonMode: event.currentTarget.checked })}
              />
            </Group>
          </>
        ) : (
          <>
            <PasswordInput
              label={t('fields.deeplApiKey.label')}
              description={editing ? t('fields.deeplApiKey.descriptionEdit') : undefined}
              value={form.deeplApiKey}
              onChange={(event) => patch({ deeplApiKey: event.currentTarget.value })}
            />
            <TextInput
              label={t('fields.deeplApiBaseUrl.label')}
              description={t('fields.deeplApiBaseUrl.description')}
              value={form.deeplApiBaseUrl}
              onChange={(event) => patch({ deeplApiBaseUrl: event.currentTarget.value })}
            />
          </>
        )}

        <Group justify="flex-end" mt="sm">
          <Button type="button" emphasis="low" disabled={saving} onClick={onClose}>
            {tCommonActions('cancel')}
          </Button>
          <Button onClick={onSubmit} loading={saving}>
            {editing ? tCommonActions('save') : t('actions.createProvider')}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
