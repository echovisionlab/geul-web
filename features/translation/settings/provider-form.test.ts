import { create } from '@bufbuild/protobuf';
import { TranslationProviderSchema, TranslationProviderType } from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { expect, it } from 'vitest';
import { buildProviderConfig, DEFAULT_PROVIDER_FORM, providerToForm, validateProviderForm } from './provider-form';

it('validates new LLM providers and retains default cost controls', () => {
  expect(validateProviderForm(DEFAULT_PROVIDER_FORM, null)).toBe('providerNameRequired');
  const form = { ...DEFAULT_PROVIDER_FORM, name: 'Primary Gemini', llmApiKey: 'gemini-secret' };
  expect(validateProviderForm(form, null)).toBeNull();
  expect(buildProviderConfig(form)).toMatchObject({
    case: 'llmConfig',
    value: {
      apiKey: 'gemini-secret',
      model: 'gemini-2.5-flash-lite',
      inputTokenPriceUsdPerMillion: 0.1,
      outputTokenPriceUsdPerMillion: 0.4,
      maxContextTokens: 1_000_000,
      temperature: 0.2,
      supportsJsonMode: true,
    },
  });
});

it('edits a DeepL provider without exposing or requiring its existing secret', () => {
  const provider = create(TranslationProviderSchema, {
    id: 'provider-2',
    name: 'DeepL Provider',
    type: TranslationProviderType.DEEPL,
    config: { case: 'deeplConfig', value: { apiKey: 'stored-secret', apiBaseUrl: 'https://api.deepl.com' } },
  });
  const form = { ...providerToForm(provider), name: 'DeepL Updated' };
  expect(form.deeplApiKey).toBe('');
  expect(validateProviderForm(form, provider)).toBeNull();
  expect(validateProviderForm(form, null)).toBe('providerApiKeyRequired');
  expect(buildProviderConfig(form)).toMatchObject({
    case: 'deeplConfig',
    value: { apiKey: '', apiBaseUrl: 'https://api.deepl.com' },
  });
});
