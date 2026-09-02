import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getFormSettingsMeta: vi.fn(),
  getFormEditorInitialFields: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: mocks.redirect, notFound: mocks.notFound }));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: vi.fn(() => null) }));
vi.mock('@/features/form/PublicFormView', () => ({ PublicFormView: vi.fn(() => null) }));
vi.mock('@/features/form/FormEditor/FormEditor', () => ({ FormEditor: () => <div>form-editor</div> }));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: vi.fn(() => null) }));
vi.mock('@/lib/actions/form', () => ({ checkFormAccessibilityBySlugAction: vi.fn() }));
vi.mock('@/features/form/AdminFormLayoutClient', () => ({
  AdminFormLayoutClient: ({ formId, children }: { formId: string; children: React.ReactNode }) => (
    <div data-form-id={formId}>{children}</div>
  ),
}));
vi.mock('@/features/form/AdminFormSubmissionsPage', () => ({ default: vi.fn(() => null) }));
vi.mock('@/features/form/FormSettingsContent', () => ({ FormSettingsContent: vi.fn(() => null) }));
vi.mock('@/features/form/SubmissionDeleteButton', () => ({ SubmissionDeleteButton: vi.fn(() => null) }));
vi.mock('@/features/form/SubmissionDetail', () => ({ SubmissionDetail: vi.fn(() => null) }));
vi.mock('@/lib/context', () => ({ createContext: vi.fn(async () => ({ countryCode: null })) }));
vi.mock('@/lib/contexts/FormEditorContext', () => ({
  FormEditorProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/features/form/FormTranslationContext', () => ({
  FormTranslationProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock('@/lib/queries/metadata', () => ({ getFormMetadataDocument: vi.fn() }));
vi.mock('@/lib/queries/form', () => ({
  getFormEditorInitialFields: mocks.getFormEditorInitialFields,
  getFormSettingsMeta: mocks.getFormSettingsMeta,
  getFormSubmissionWithSchema: vi.fn(),
}));
vi.mock('@/lib/utils/language.server', () => ({ getUserLocale: vi.fn(async () => 'en') }));
vi.mock('@/lib/utils/og', () => ({ buildFormOgMetadata: vi.fn() }));
vi.mock('@/lib/utils/route-metadata', () => ({ withNoIndex: vi.fn() }));
vi.mock('@/lib/utils/session.server', () => ({ getSession: mocks.getSession }));
vi.mock('@/lib/utils/url.server', () => ({ getBaseUrl: vi.fn(async () => 'https://example.test') }));
vi.mock('@/app/_shared/page-route-fallback', () => ({
  generatePageRouteFallbackMetadata: vi.fn(),
  renderPageRouteFallback: vi.fn(() => null),
}));

import PublicFormPage from './page';

const FORM_ID = '00000000-0000-4000-8000-000000000009';
const form = {
  id: FORM_ID,
  slug: 'form-slug',
  status: 'draft',
};

function props(slug: string, searchParams: Record<string, string | string[] | undefined> = { edit: 'true' }) {
  return {
    params: Promise.resolve({ slug }),
    searchParams: Promise.resolve(searchParams),
  };
}

describe('Form canonical editor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: 'member-1', role: 'admin' } });
    mocks.getFormSettingsMeta.mockResolvedValue(form);
    mocks.getFormEditorInitialFields.mockResolvedValue({ title: 'Form', description: '', submitButtonText: '' });
  });

  it('canonicalizes an authorized slug to the immutable ID while preserving the query', async () => {
    await expect(PublicFormPage(props('form-slug', { edit: 'true', tab: 'settings', lang: 'ko' }))).rejects.toThrow(
      `redirect:/forms/${FORM_ID}?edit=true&tab=settings&lang=ko`,
    );
    expect(mocks.getFormEditorInitialFields).not.toHaveBeenCalled();
  });

  it('renders the editor and tab navigation at the immutable ID', async () => {
    const html = renderToStaticMarkup(await PublicFormPage(props(FORM_ID)));

    expect(html).toContain(`data-form-id="${FORM_ID}"`);
    expect(html).toContain('form-editor');
    expect(mocks.getFormEditorInitialFields).toHaveBeenCalledWith(FORM_ID);
  });
});
