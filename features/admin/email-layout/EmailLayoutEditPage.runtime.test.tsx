// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { render, screen, waitFor } from '@/test/render';
import { registerEditorSave } from '@/lib/editor/editor-save-registry';
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import CampaignEditPage from '@/features/campaign/CampaignEditPage';
import EmailTemplateEditPage from '@/features/admin/email-template/EmailTemplateEditPage';
import EmailLayoutEditPage from './EmailLayoutEditPage';

const transport = vi.hoisted(() => ({
  synced: true,
  id: '11111111-1111-4111-8111-111111111111',
  language: 'en',
  provider: {
    on: vi.fn(),
    off: vi.fn(),
    configuration: { name: 'email_layout:11111111-1111-4111-8111-111111111111:en' },
  },
}));
let document: Y.Doc;
let client: QueryClient;
const release: Array<() => void> = [];
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: transport.id }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => `/admin/email-layouts/${transport.id}`,
  useSearchParams: () => new URLSearchParams(`lang=${transport.language}`),
}));
vi.mock('@/lib/queries/email-layout', () => ({
  listEmailLayoutsSimple: async () => [],
  getEmailLayout: async () => ({
    id: transport.id,
    name: 'Layout',
    key: 'paper',
    htmlContent: '<main>Admitted</main>',
  }),
}));
vi.mock('@/lib/actions/campaign', () => ({
  getCampaignAction: async () => ({
    ok: true,
    value: {
      id: transport.id,
      name: 'Campaign',
      subject: 'Subject',
      status: 'draft',
      targetMode: 1,
      recipientScope: 'SUBSCRIBED_USERS',
      layoutId: null,
      segmentId: null,
    },
  }),
  updateCampaignConfigurationAction: vi.fn(),
  updateCampaignNameAction: vi.fn(),
  previewCampaignAction: vi.fn(async () => ({ ok: true, value: { htmlContent: '<p>Preview</p>' } })),
  cancelCampaignAction: vi.fn(),
  scheduleCampaignAction: vi.fn(),
  sendCampaignNowAction: vi.fn(),
  sendTestCampaignAction: vi.fn(),
}));
vi.mock('@/lib/actions/audience', () => ({ listActiveSegmentsAction: async () => [] }));
vi.mock('@/lib/actions/email-template', () => ({
  getEmailTemplateAction: async () => ({
    id: transport.id,
    name: 'Template',
    subject: 'Subject',
    key: 'custom',
    variables: [],
    layoutId: null,
  }),
  updateEmailTemplateLayoutAction: vi.fn(),
  previewEmailTemplateAction: vi.fn(),
  sendTestEmailTemplateAction: vi.fn(),
}));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: null,
    doc: null,
    bootstrap: null,
    protocol: null,
    isSynced: false,
    isConnected: false,
  }),
}));
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/lib/actions/email-layout', () => ({ updateEmailLayoutAction: vi.fn() }));
vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({
    listTranslationLocales: async () => ({ locales: [{ code: 'ko', enabled: true }] }),
    listEntityTranslations: async () => ({ sourceLocale: 'en', entries: [] }),
  }),
}));
vi.mock('@/lib/hooks/useHocuspocusConnection', () => ({
  useHocuspocusConnection: () => ({
    provider: transport.provider,
    doc: document,
    isConnected: transport.synced,
    isSynced: transport.synced,
  }),
}));
// The browser engine is unavailable in jsdom; retain a stateful input at its adapter boundary.
vi.mock('@/features/editor/tiptap/code-editor', () => ({
  MonacoSourceEditor: ({ value, ariaLabel, readOnly }: { value: string; ariaLabel: string; readOnly: boolean }) => (
    <textarea aria-label={ariaLabel} defaultValue={value} readOnly={readOnly} />
  ),
}));
vi.mock('@/features/admin/email-layout/EmailLayoutPreview', () => ({
  EmailLayoutPreview: () => <p>Layout preview</p>,
}));
vi.mock('@/features/translation/EmailEntityTranslationsPanel', () => ({ EmailEntityTranslationsPanel: () => null }));

beforeEach(() => {
  transport.synced = true;
  transport.id = '11111111-1111-4111-8111-111111111111';
  transport.language = 'en';
  setProviderAccessLevel(transport.provider, 'edit');
  document = new Y.Doc();
  document.getText('html-content').insert(0, '<main>Admitted</main>');
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
});
afterEach(() => {
  release.splice(0).forEach((dispose) => dispose());
  client.clear();
  document.destroy();
});
function page() {
  return (
    <QueryClientProvider client={client}>
      <EmailLayoutEditPage />
    </QueryClientProvider>
  );
}

it('keeps the admitted HTML input, selection and content across a reconnect', async () => {
  const view = render(page());
  const html = await screen.findByRole('textbox', { name: 'HTML' });
  await view.user.click(html);
  await view.user.paste(' local draft');
  const value = (html as HTMLTextAreaElement).value;
  const selection = (html as HTMLTextAreaElement).selectionStart;
  transport.synced = false;
  view.rerender(page());
  expect(screen.getByRole('textbox', { name: 'HTML' })).toBe(html);
  expect(html).toHaveValue(value);
  expect((html as HTMLTextAreaElement).selectionStart).toBe(selection);
  expect(screen.getByText('Layout preview')).toBeVisible();
  transport.synced = true;
  view.rerender(page());
  expect(screen.getByRole('textbox', { name: 'HTML' })).toBe(html);
});

it('keeps an initially unsynced document behind the loader', async () => {
  transport.synced = false;
  render(page());
  expect(await screen.findByRole('textbox', { name: 'Key' })).toBeVisible();
  expect(screen.queryByRole('textbox', { name: 'HTML' })).not.toBeInTheDocument();
  expect(screen.getByText('Connecting to editor...')).toBeVisible();
});

it('keeps correction fields and the HTML instance when the locale save barrier fails, then retries', async () => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  release.push(
    registerEditorSave('email_layout:11111111-1111-4111-8111-111111111111', { flush: save, hasPending: () => false }),
  );
  const view = render(page());
  const html = await screen.findByRole('textbox', { name: 'HTML' });
  const key = screen.getByRole('textbox', { name: 'Key' });
  await view.user.click(screen.getByRole('combobox', { name: 'Language' }));
  await view.user.click(await screen.findByRole('option', { name: '한국어' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'HTML' })).toBe(html);
  expect(screen.getByRole('textbox', { name: 'Key' })).toBe(key);
  expect(key).toBeEnabled();
  await view.user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(save).toHaveBeenCalledTimes(2);
});

it.each([
  { name: 'campaign', Page: CampaignEditPage, documentKey: 'campaign' },
  { name: 'template', Page: EmailTemplateEditPage, documentKey: 'email_template' },
])('keeps $name fields mounted after a failed locale save and supports inline retry', async ({ Page, documentKey }) => {
  const save = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  release.push(registerEditorSave(`${documentKey}:${transport.id}`, { flush: save, hasPending: () => false }));
  const { user } = render(
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>,
  );
  const subject = await screen.findByRole('textbox', { name: 'Subject' });
  await user.click(await screen.findByRole('combobox', { name: 'Language' }));
  await user.click(await screen.findByRole('option', { name: '한국어' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Subject' })).toBe(subject);
  expect(subject).toHaveValue('Subject');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(save).toHaveBeenCalledTimes(2);
});
