import { create } from '@bufbuild/protobuf';
import {
  DeepLTranslationProviderConfigSchema,
  LLMTranslationProviderConfigSchema,
  TranslationLLMProviderPreset,
  TranslationProviderType,
  type TranslationProvider,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';

export type ProviderFormType = 'llm' | 'deepl';
export type LLMProviderPresetFormType = 'gemini' | 'openai-compatible';

export interface ProviderFormState {
  name: string;
  type: ProviderFormType;
  isActive: boolean;
  priority: number;
  llmPreset: LLMProviderPresetFormType;
  llmApiKey: string;
  llmApiBaseUrl: string;
  llmModel: string;
  llmInputTokenPriceUsdPerMillion: number | '';
  llmOutputTokenPriceUsdPerMillion: number | '';
  llmMaxContextTokens: number | '';
  llmMaxOutputTokens: number | '';
  llmSupportsJsonMode: boolean;
  llmTemperature: number | '';
  deeplApiKey: string;
  deeplApiBaseUrl: string;
}

export const DEFAULT_PROVIDER_FORM: ProviderFormState = {
  name: '',
  type: 'llm',
  isActive: true,
  priority: 0,
  llmPreset: 'gemini',
  llmApiKey: '',
  llmApiBaseUrl: '',
  llmModel: 'gemini-2.5-flash-lite',
  llmInputTokenPriceUsdPerMillion: 0.1,
  llmOutputTokenPriceUsdPerMillion: 0.4,
  llmMaxContextTokens: 1_000_000,
  llmMaxOutputTokens: '',
  llmSupportsJsonMode: true,
  llmTemperature: 0.2,
  deeplApiKey: '',
  deeplApiBaseUrl: 'https://api.deepl.com',
};

export function providerTypeToProto(type: ProviderFormType) {
  return type === 'llm' ? TranslationProviderType.LLM : TranslationProviderType.DEEPL;
}

export function providerTypeFromProto(type: TranslationProviderType): ProviderFormType {
  return type === TranslationProviderType.LLM ? 'llm' : 'deepl';
}

function llmPresetToProto(preset: LLMProviderPresetFormType) {
  return preset === 'openai-compatible'
    ? TranslationLLMProviderPreset.TRANSLATION_LLM_PROVIDER_PRESET_OPENAI_COMPATIBLE
    : TranslationLLMProviderPreset.TRANSLATION_LLM_PROVIDER_PRESET_GEMINI;
}

function llmPresetFromProto(preset: TranslationLLMProviderPreset): LLMProviderPresetFormType {
  return preset === TranslationLLMProviderPreset.TRANSLATION_LLM_PROVIDER_PRESET_OPENAI_COMPATIBLE
    ? 'openai-compatible'
    : 'gemini';
}

function optionalNumber(value: number | '') {
  return value === '' ? undefined : value;
}

export function buildProviderConfig(form: ProviderFormState) {
  if (form.type === 'llm') {
    return {
      case: 'llmConfig' as const,
      value: create(LLMTranslationProviderConfigSchema, {
        apiKey: form.llmApiKey.trim(),
        preset: llmPresetToProto(form.llmPreset),
        apiBaseUrl: form.llmApiBaseUrl.trim() || undefined,
        model: form.llmModel.trim(),
        inputTokenPriceUsdPerMillion: optionalNumber(form.llmInputTokenPriceUsdPerMillion),
        outputTokenPriceUsdPerMillion: optionalNumber(form.llmOutputTokenPriceUsdPerMillion),
        maxContextTokens: optionalNumber(form.llmMaxContextTokens),
        maxOutputTokens: optionalNumber(form.llmMaxOutputTokens),
        supportsJsonMode: form.llmSupportsJsonMode,
        temperature: optionalNumber(form.llmTemperature),
      }),
    };
  }
  return {
    case: 'deeplConfig' as const,
    value: create(DeepLTranslationProviderConfigSchema, {
      apiKey: form.deeplApiKey.trim(),
      apiBaseUrl: form.deeplApiBaseUrl.trim() || undefined,
    }),
  };
}

export function providerToForm(provider: TranslationProvider): ProviderFormState {
  return {
    name: provider.name,
    type: providerTypeFromProto(provider.type),
    isActive: provider.isActive,
    priority: provider.priority,
    llmPreset:
      provider.config.case === 'llmConfig'
        ? llmPresetFromProto(provider.config.value.preset)
        : DEFAULT_PROVIDER_FORM.llmPreset,
    llmApiKey: '',
    llmApiBaseUrl:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.apiBaseUrl ?? '')
        : DEFAULT_PROVIDER_FORM.llmApiBaseUrl,
    llmModel: provider.config.case === 'llmConfig' ? provider.config.value.model : DEFAULT_PROVIDER_FORM.llmModel,
    llmInputTokenPriceUsdPerMillion:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.inputTokenPriceUsdPerMillion ?? DEFAULT_PROVIDER_FORM.llmInputTokenPriceUsdPerMillion)
        : DEFAULT_PROVIDER_FORM.llmInputTokenPriceUsdPerMillion,
    llmOutputTokenPriceUsdPerMillion:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.outputTokenPriceUsdPerMillion ??
          DEFAULT_PROVIDER_FORM.llmOutputTokenPriceUsdPerMillion)
        : DEFAULT_PROVIDER_FORM.llmOutputTokenPriceUsdPerMillion,
    llmMaxContextTokens:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.maxContextTokens ?? DEFAULT_PROVIDER_FORM.llmMaxContextTokens)
        : DEFAULT_PROVIDER_FORM.llmMaxContextTokens,
    llmMaxOutputTokens:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.maxOutputTokens ?? DEFAULT_PROVIDER_FORM.llmMaxOutputTokens)
        : DEFAULT_PROVIDER_FORM.llmMaxOutputTokens,
    llmSupportsJsonMode:
      provider.config.case === 'llmConfig'
        ? provider.config.value.supportsJsonMode
        : DEFAULT_PROVIDER_FORM.llmSupportsJsonMode,
    llmTemperature:
      provider.config.case === 'llmConfig'
        ? (provider.config.value.temperature ?? DEFAULT_PROVIDER_FORM.llmTemperature)
        : DEFAULT_PROVIDER_FORM.llmTemperature,
    deeplApiKey: '',
    deeplApiBaseUrl:
      provider.config.case === 'deeplConfig'
        ? (provider.config.value.apiBaseUrl ?? DEFAULT_PROVIDER_FORM.deeplApiBaseUrl)
        : DEFAULT_PROVIDER_FORM.deeplApiBaseUrl,
  };
}

export type ProviderValidationError =
  'providerNameRequired' | 'providerApiKeyRequired' | 'providerModelRequired' | 'providerBaseUrlRequired';

export function validateProviderForm(
  form: ProviderFormState,
  editingProvider: TranslationProvider | null,
): ProviderValidationError | null {
  if (!form.name.trim()) {
    return 'providerNameRequired';
  }
  const typeChanged = editingProvider !== null && providerTypeFromProto(editingProvider.type) !== form.type;
  const secret = form.type === 'llm' ? form.llmApiKey.trim() : form.deeplApiKey.trim();
  if ((editingProvider === null || typeChanged) && !secret) {
    return 'providerApiKeyRequired';
  }
  if (form.type === 'llm' && !form.llmModel.trim()) {
    return 'providerModelRequired';
  }
  if (form.type === 'llm' && form.llmPreset === 'openai-compatible' && !form.llmApiBaseUrl.trim()) {
    return 'providerBaseUrlRequired';
  }
  return null;
}
