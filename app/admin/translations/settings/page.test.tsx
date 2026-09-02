// @vitest-environment jsdom

import { act, type ComponentProps, type ReactNode } from 'react';
import { Code, ConnectError } from '@connectrpc/connect';
import {
  TranslationLLMProviderPreset,
  TranslationProviderType,
  type TranslationProvider,
} from '@echovisionlab/geul-proto/secure/translation_pb.ts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TranslationSettingsPage from './page';

const api = vi.hoisted(() => ({
  getTranslationSettings: vi.fn(),
  listTranslationLocales: vi.fn(),
  listTranslationProviders: vi.fn(),
  updateTranslationSettings: vi.fn(),
  createTranslationProvider: vi.fn(),
  updateTranslationProvider: vi.fn(),
  deleteTranslationProvider: vi.fn(),
}));

const notifications = vi.hoisted(() => ({
  show: vi.fn(),
}));

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => (key: string, values?: Record<string, unknown>) => {
    const prefix = namespace ? `${namespace}.` : '';
    if (values?.name) {
      return `${prefix}${key} ${values.name}`;
    }
    if (values?.priority !== undefined) {
      return `${prefix}${key} ${values.priority}`;
    }
    return `${prefix}${key}`;
  },
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

vi.mock('@tabler/icons-react', () => ({
  IconChecklist: () => null,
  IconDeviceFloppy: () => null,
  IconEdit: () => null,
  IconPlus: () => null,
  IconSettings2: () => null,
  IconTrash: () => null,
}));

vi.mock('@mantine/notifications', () => ({
  notifications,
}));

vi.mock('@mantine/core', () => ({
  Divider: ({ label }: { label?: ReactNode }) => <hr aria-label={String(label ?? 'divider')} />,
  Group: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Modal: ({ opened, title, children }: { opened: boolean; title?: ReactNode; children: ReactNode }) =>
    opened ? (
      <section role="dialog">
        <h2>{title}</h2>
        {children}
      </section>
    ) : null,
  NumberInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number | '';
    onChange: (value: number | '') => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
      />
    </label>
  ),
  Paper: ({ children }: { children: ReactNode }) => <section>{children}</section>,
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Switch: ({
    checked,
    label,
    onChange,
  }: {
    checked: boolean;
    label: string;
    onChange: ComponentProps<'input'>['onChange'];
  }) => (
    <label>
      <input aria-label={label} type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  ),
  Text: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  Title: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
}));

vi.mock('@/components/core/Badge', () => ({
  LabelBadge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/core/Button', () => ({
  Button: ({
    children,
    disabled,
    href,
    loading,
    onClick,
  }: {
    children: ReactNode;
    disabled?: boolean;
    href?: string;
    loading?: boolean;
    onClick?: () => void;
  }) =>
    href ? (
      <a href={href}>{children}</a>
    ) : (
      <button type="button" disabled={disabled || loading} onClick={onClick}>
        {children}
      </button>
    ),
}));

vi.mock('@/components/core/IconButton', () => ({
  IconButton: ({
    'aria-label': ariaLabel,
    children,
    onClick,
    title,
  }: {
    'aria-label'?: string;
    children: ReactNode;
    onClick?: () => void;
    title?: string;
  }) => (
    <button type="button" aria-label={ariaLabel ?? title} onClick={onClick}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/core/Input', () => ({
  NumberInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: number | '';
    onChange: (value: number | '') => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value === '' ? '' : Number(event.currentTarget.value))}
      />
    </label>
  ),
  PasswordInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: ComponentProps<'input'>['onChange'];
  }) => (
    <label>
      {label}
      <input aria-label={label} type="password" value={value} onChange={onChange} />
    </label>
  ),
  Select: ({
    data,
    label,
    value,
    onChange,
  }: {
    data: Array<{ value: string; label: string }>;
    label: string;
    value: string;
    onChange: (value: string | null) => void;
  }) => (
    <label>
      {label}
      <select aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value || null)}>
        {data.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  Switch: ({
    checked,
    label,
    onChange,
  }: {
    checked: boolean;
    label: string;
    onChange: ComponentProps<'input'>['onChange'];
  }) => (
    <label>
      <input aria-label={label} type="checkbox" checked={checked} onChange={onChange} />
      {label}
    </label>
  ),
  TextInput: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: ComponentProps<'input'>['onChange'];
  }) => (
    <label>
      {label}
      <input aria-label={label} value={value} onChange={onChange} />
    </label>
  ),
  TagsInput: ({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value.join(', ')}
        onChange={(event) => onChange(event.currentTarget.value.split(','))}
      />
    </label>
  ),
}));

vi.mock('@/components/core/Modal', () => ({
  ConfirmModal: ({
    confirmLabel,
    message,
    onConfirm,
    opened,
    title,
  }: {
    confirmLabel: string;
    message: string;
    onConfirm: () => void;
    opened: boolean;
    title: string;
  }) =>
    opened ? (
      <section role="alertdialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </section>
    ) : null,
}));

vi.mock('@/features/site/PageLoader', () => ({
  PageLoader: () => <div>loading</div>,
}));

vi.mock('@/lib/api/browser-client', () => ({
  createTranslationClient: () => api,
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
let queryClient: QueryClient | null = null;

const settings = {
  defaultLocale: 'en',
  protectedTerms: ['Photoshop', 'React Native'],
};

function llmProvider(overrides: Partial<TranslationProvider> = {}): TranslationProvider {
  return {
    id: 'provider-1',
    name: 'Gemini Provider',
    type: TranslationProviderType.LLM,
    isActive: true,
    priority: 10,
    config: {
      case: 'llmConfig',
      value: {
        preset: TranslationLLMProviderPreset.TRANSLATION_LLM_PROVIDER_PRESET_GEMINI,
        model: 'gemini-2.5-flash-lite',
        supportsJsonMode: true,
        inputTokenPriceUsdPerMillion: 0.1,
        outputTokenPriceUsdPerMillion: 0.4,
        maxContextTokens: 1_000_000,
        temperature: 0.2,
      },
    },
    ...overrides,
  } as TranslationProvider;
}

function deeplProvider(overrides: Partial<TranslationProvider> = {}): TranslationProvider {
  return {
    id: 'provider-2',
    name: 'DeepL Provider',
    type: TranslationProviderType.DEEPL,
    isActive: false,
    priority: 20,
    config: {
      case: 'deeplConfig',
      value: {
        apiBaseUrl: 'https://api.deepl.com',
      },
    },
    ...overrides,
  } as TranslationProvider;
}

function buttonByText(text: string) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes(text)) as
    HTMLButtonElement | undefined;
  expect(button).toBeTruthy();
  return button!;
}

function inputByLabel(label: string) {
  const input = document.querySelector(`[aria-label="${label}"]`) as HTMLInputElement | null;
  expect(input).toBeTruthy();
  return input!;
}

function selectByLabel(label: string) {
  const select = document.querySelector(`[aria-label="${label}"]`) as HTMLSelectElement | null;
  expect(select).toBeTruthy();
  return select!;
}

async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
      await Promise.resolve();
    });
  }
}

function renderPage() {
  act(() => {
    root?.render(
      <QueryClientProvider client={queryClient!}>
        <TranslationSettingsPage />
      </QueryClientProvider>,
    );
  });
}

async function changeInput(label: string, value: string) {
  const input = inputByLabel(label);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

async function changeSelect(label: string, value: string) {
  const select = selectByLabel(label);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

beforeEach(() => {
  api.getTranslationSettings.mockResolvedValue({
    settings,
    generationEnabled: false,
    generationDisabledReason: 'translation generation requires an active translation provider',
  });
  api.listTranslationLocales.mockResolvedValue({
    locales: [
      { code: 'en', displayName: 'English' },
      { code: 'ko', displayName: 'Korean' },
    ],
  });
  api.listTranslationProviders.mockResolvedValue({
    providers: [llmProvider()],
  });
  api.updateTranslationSettings.mockResolvedValue({ settings });
  api.createTranslationProvider.mockResolvedValue({ provider: llmProvider({ id: 'created' }) });
  api.updateTranslationProvider.mockResolvedValue({ provider: llmProvider() });
  api.deleteTranslationProvider.mockResolvedValue({ success: true });

  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  queryClient?.clear();
  container?.remove();
  document.body.innerHTML = '';
  container = null;
  root = null;
  queryClient = null;
  vi.clearAllMocks();
});

describe('TranslationSettingsPage', () => {
  it('renders provider state and preserves the source default and exact protected terms', async () => {
    renderPage();
    await settle();

    expect(document.body.textContent).toContain('Gemini Provider');
    expect(document.body.textContent).toContain('gemini-2.5-flash-lite');
    expect(document.body.textContent).toContain('translationSettingsPage.generation.disabled');
    expect(document.body.textContent).toContain('translation generation requires an active translation provider');
    const initialSettingsQueries = api.getTranslationSettings.mock.calls.length;
    expect(buttonByText('translationSettingsPage.actions.save').disabled).toBe(true);

    await changeSelect('translationSettingsPage.fields.defaultLocale.label', 'ko');

    await act(async () => {
      buttonByText('translationSettingsPage.actions.save').click();
    });
    await settle();

    expect(api.updateTranslationSettings).toHaveBeenCalledWith({
      settings: { ...settings, defaultLocale: 'ko' },
    });
    expect(api.getTranslationSettings.mock.calls.length).toBeGreaterThan(initialSettingsQueries);
  });

  it('treats blank and exact-duplicate protected-term input as a canonical no-op', async () => {
    renderPage();
    await settle();

    await changeInput('translationSettingsPage.fields.protectedTerms.label', ' Photoshop, Photoshop, React Native,   ');

    expect(buttonByText('translationSettingsPage.actions.save').disabled).toBe(true);
    expect(api.updateTranslationSettings).not.toHaveBeenCalled();
  });

  it('trims and exact-deduplicates protected terms while preserving case in the update payload', async () => {
    renderPage();
    await settle();

    await changeInput(
      'translationSettingsPage.fields.protectedTerms.label',
      ' Photoshop , Photoshop, photoshop, React Native ',
    );
    await act(async () => {
      buttonByText('translationSettingsPage.actions.save').click();
    });
    await settle();

    expect(api.updateTranslationSettings).toHaveBeenCalledWith({
      settings: {
        defaultLocale: 'en',
        protectedTerms: ['Photoshop', 'photoshop', 'React Native'],
      },
    });
  });

  it('shows bounded authorization and internal errors without exposing raw RPC details', async () => {
    api.updateTranslationSettings
      .mockRejectedValueOnce(new ConnectError('secret permission context', Code.PermissionDenied))
      .mockRejectedValueOnce(new ConnectError('raw provider credential failure', Code.Internal));
    renderPage();
    await settle();
    await changeSelect('translationSettingsPage.fields.defaultLocale.label', 'ko');

    await act(async () => buttonByText('translationSettingsPage.actions.save').click());
    await settle();
    expect(notifications.show).toHaveBeenCalledWith({ color: 'red', message: 'Forbidden' });

    await act(async () => buttonByText('translationSettingsPage.actions.save').click());
    await settle();
    expect(notifications.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'translationSettingsPage.notifications.saveFailed',
    });
    expect(JSON.stringify(notifications.show.mock.calls)).not.toContain('raw provider credential failure');
    expect(JSON.stringify(notifications.show.mock.calls)).not.toContain('secret permission context');
  });

  it('validates and creates an LLM provider with default cost controls', async () => {
    api.listTranslationProviders.mockResolvedValue({ providers: [] });

    renderPage();
    await settle();

    await act(async () => {
      buttonByText('translationSettingsPage.actions.addProvider').click();
    });
    await act(async () => {
      buttonByText('translationSettingsPage.actions.createProvider').click();
    });

    expect(notifications.show).toHaveBeenCalledWith({
      color: 'red',
      message: 'translationSettingsPage.validation.providerNameRequired',
    });

    await changeInput('translationSettingsPage.fields.providerName.label', 'Primary Gemini');
    await changeInput('translationSettingsPage.fields.llmApiKey.label', 'gemini-secret');

    await act(async () => {
      buttonByText('translationSettingsPage.actions.createProvider').click();
    });
    await settle();

    expect(api.createTranslationProvider).toHaveBeenCalledTimes(1);
    expect(api.createTranslationProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Primary Gemini',
        type: TranslationProviderType.LLM,
        isActive: true,
        priority: 0,
        config: expect.objectContaining({
          case: 'llmConfig',
          value: expect.objectContaining({
            apiKey: 'gemini-secret',
            model: 'gemini-2.5-flash-lite',
            supportsJsonMode: true,
            inputTokenPriceUsdPerMillion: 0.1,
            outputTokenPriceUsdPerMillion: 0.4,
            maxContextTokens: 1_000_000,
            temperature: 0.2,
          }),
        }),
      }),
    );
  });

  it('edits, toggles, and deletes DeepL providers without requiring a repeated secret', async () => {
    api.listTranslationProviders.mockResolvedValue({ providers: [deeplProvider()] });

    renderPage();
    await settle();

    await act(async () => {
      inputByLabel('translationSettingsPage.fields.providerActive.shortLabel').click();
    });
    expect(api.updateTranslationProvider).toHaveBeenCalledWith({
      id: 'provider-2',
      isActive: true,
    });

    await act(async () => {
      (
        document.querySelector('[aria-label="translationSettingsPage.actions.editProvider"]') as HTMLButtonElement
      ).click();
    });

    await changeSelect('translationSettingsPage.fields.providerType.label', 'deepl');
    await changeInput('translationSettingsPage.fields.providerName.label', 'DeepL Updated');
    await changeInput('translationSettingsPage.fields.deeplApiBaseUrl.label', 'https://api-free.deepl.com');

    await act(async () => {
      buttonByText('common.actions.save').click();
    });
    await settle();

    expect(api.updateTranslationProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'provider-2',
        name: 'DeepL Updated',
        type: TranslationProviderType.DEEPL,
        isActive: false,
        priority: 20,
        config: expect.objectContaining({
          case: 'deeplConfig',
          value: expect.objectContaining({
            apiKey: '',
            apiBaseUrl: 'https://api-free.deepl.com',
          }),
        }),
      }),
    );

    await act(async () => {
      (
        document.querySelector('[aria-label="translationSettingsPage.actions.deleteProvider"]') as HTMLButtonElement
      ).click();
    });
    expect(document.body.textContent).toContain('translationSettingsPage.modal.deleteProviderMessage DeepL Provider');

    await act(async () => {
      buttonByText('translationSettingsPage.actions.deleteProvider').click();
    });
    await settle();

    expect(api.deleteTranslationProvider).toHaveBeenCalledWith({
      id: 'provider-2',
    });
  });
});
