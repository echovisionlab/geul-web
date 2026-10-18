// @vitest-environment jsdom

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/render';
import { publishEditorEntityChange } from '@/lib/editor/editor-entity-changes';
import EmailTemplateEditPage from './EmailTemplateEditPage';

const actions = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'template-1' }),
  useRouter: () => router,
  usePathname: () => '/admin/email-templates/template-1',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/actions/email-template', () => ({
  getEmailTemplateAction: actions.get,
  updateEmailTemplateLayoutAction: actions.save,
  previewEmailTemplateAction: vi.fn(),
  sendTestEmailTemplateAction: vi.fn(),
}));
vi.mock('@/lib/api/browser/secure-translation', () => ({
  createTranslationClient: () => ({
    listTranslationLocales: async () => ({ locales: [] }),
    listEntityTranslations: async () => ({ entries: [], sourceLocale: 'en' }),
    listTranslationJobs: async () => ({ jobs: [] }),
    getTranslationSettings: async () => ({ generationEnabled: false }),
  }),
}));
// Keep the realtime connection offline; layout selection uses the authorized HTTP action.
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: null,
    doc: null,
    bootstrap: null,
    protocol: null,
    isConnected: false,
    isSynced: false,
  }),
}));
vi.mock('@/lib/queries/email-layout', () => ({ listEmailLayoutsSimple: async () => [] }));

class TestBroadcastChannel {
  static channels = new Set<TestBroadcastChannel>();
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(readonly name: string) {
    TestBroadcastChannel.channels.add(this);
  }
  postMessage(data: unknown) {
    for (const channel of TestBroadcastChannel.channels) {
      if (channel !== this && channel.name === this.name) {
        channel.onmessage?.({ data } as MessageEvent);
      }
    }
  }
  close() {
    TestBroadcastChannel.channels.delete(this);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}

beforeEach(() => {
  actions.get.mockReset();
  actions.save.mockReset();
  vi.stubGlobal('BroadcastChannel', TestBroadcastChannel);
});
afterEach(() => {
  vi.unstubAllGlobals();
  TestBroadcastChannel.channels.clear();
});

it('keeps the selected layout when an older peer read and cached snapshot arrive after saving', async () => {
  const original = {
    id: 'template-1',
    name: 'Template',
    subject: 'Subject',
    key: 'custom',
    variables: [],
    layoutId: 'original',
  };
  let template = original;
  const stale = deferred<typeof original>();
  actions.get.mockImplementationOnce(() => stale.promise).mockImplementation(async () => template);
  actions.save.mockImplementation(async (_id: string, layoutId: string) => {
    template = { ...template, layoutId };
    return { success: true };
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  client.setQueryData(['emailTemplates', 'template-1'], original);
  client.setQueryData(
    ['emailLayouts', 'simple'],
    [
      { id: 'original', name: 'Original layout' },
      { id: 'first', name: 'First layout' },
    ],
  );
  const { user, unmount, rerender } = render(
    <QueryClientProvider client={client}>
      <EmailTemplateEditPage />
    </QueryClientProvider>,
  );
  try {
    const layout = screen.getByRole('combobox', { name: 'Layout' });
    expect(layout).toHaveValue('Original layout');
    act(() => publishEditorEntityChange('email_template:template-1'));
    await waitFor(() => expect(actions.get).toHaveBeenCalledOnce());
    await user.click(layout);
    await user.click(await screen.findByRole('option', { name: 'First layout' }));
    await waitFor(() => expect(actions.save).toHaveBeenCalledWith('template-1', 'first', expect.any(String)));
    await waitFor(() =>
      expect(client.getQueryData(['emailTemplates', 'template-1'])).toMatchObject({ layoutId: 'first' }),
    );
    // Leaving the searchable field reconciles its input text with the selected layout.
    await user.tab();
    await waitFor(() => expect(layout).toHaveValue('First layout'));
    await act(async () => {
      stale.resolve(original);
      await stale.promise;
    });
    expect(layout).toHaveValue('First layout');
    act(() => client.setQueryData(['emailTemplates', 'template-1'], original));
    rerender(
      <QueryClientProvider client={client}>
        <EmailTemplateEditPage />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('combobox', { name: 'Layout' })).toHaveValue('First layout');
  } finally {
    unmount();
    client.clear();
  }
});
