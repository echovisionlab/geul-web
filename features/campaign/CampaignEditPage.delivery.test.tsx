// @vitest-environment jsdom
import { setProviderAccessLevel } from '@/lib/collab/provider-control-state';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';

const mocks = vi.hoisted(() => ({
  provider: { on: vi.fn(), off: vi.fn(), disconnect: vi.fn() },
  confirmSend: null as null | (() => void),
  campaign: null as Record<string, unknown> | null,
  updateConfiguration: vi.fn(),
  updateName: vi.fn(),
  queryClient: { invalidateQueries: vi.fn() },
  sendCampaign: vi.fn(),
  sendTest: vi.fn(),
  scheduleCampaign: vi.fn(),
  routerPush: vi.fn(),
  isSynced: true,
  localeSession: null as null | {
    roomLocale: string;
    activeEditLocale: Record<string, unknown>;
    shouldUseLocaleDocument: boolean;
  },
  notificationsShow: vi.fn(),
  refetchCampaign: vi.fn(),
  getCampaign: vi.fn(),
  queryFn: null as (() => Promise<unknown>) | null,
  peerChange: null as (() => void) | null,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: mocks.routerPush }),
}));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    if (namespace === 'common.labels' && key === 'allUsers') {
      return 'All users';
    }
    if (namespace === 'campaignEditor' && key === 'target.unavailableAudience') {
      return 'Unavailable audience';
    }
    if (namespace === 'campaignEditor' && key === 'sendModal.warning') {
      return `Send to ${String(values?.audience)}`;
    }
    if (namespace === 'campaignEditor' && key === 'scheduleModal.audience') {
      return `Schedule for ${String(values?.audience)}`;
    }
    return `${namespace}.${key}`;
  },
}));

vi.mock('@tanstack/react-query', async () => {
  return {
    useMutation: ({ mutationFn }: { mutationFn: (input: unknown) => Promise<unknown> }) => ({
      mutateAsync: mutationFn,
      isPending: false,
    }),
    useQueryClient: () => mocks.queryClient,
    useQuery: ({ queryKey, queryFn }: { queryKey: string[]; queryFn: () => Promise<unknown> }) => {
      if (queryKey[0] === 'campaigns') {
        mocks.queryFn = queryFn;
        return {
          data: mocks.campaign,
          isLoading: false,
          refetch: mocks.refetchCampaign,
        };
      }
      if (queryKey[0] === 'emailLayouts') {
        return { data: [{ id: 'layout-1', name: 'Layout one' }], isError: false, isLoading: false };
      }
      if (queryKey[0] === 'segments') {
        return {
          data: [
            { id: 'segment-old', name: 'Old segment' },
            { id: 'segment-new', name: 'New segment' },
          ],
          isError: false,
          isLoading: false,
        };
      }
      return { data: [], isError: false, isLoading: false };
    },
  };
});

vi.mock('@mantine/hooks', async () => {
  const React = await import('react');
  return {
    useDisclosure: (initial = false) => {
      const [opened, setOpened] = React.useState(initial);
      return [opened, { open: () => setOpened(true), close: () => setOpened(false) }];
    },
  };
});

vi.mock('@/components/core/Notification', () => ({ notifications: { show: mocks.notificationsShow } }));

vi.mock('@tabler/icons-react', () => ({
  IconCalendar: () => null,
  IconChartBar: () => null,
  IconColumns2: () => null,
  IconEdit: () => null,
  IconEye: () => null,
  IconPlayerStop: () => null,
  IconSend: () => null,
  IconTestPipe: () => null,
}));

vi.mock('@/features/editor/EditorHeader', () => ({
  EditorHeader: ({
    actionItems,
    title,
    onTitleChange,
    onBack,
  }: {
    title: string;
    onTitleChange: (value: string) => void;
    onBack: () => void;
    actionItems: Array<{ key: string; label: string; disabled?: boolean; onClick: () => void }>;
  }) => (
    <div>
      <button type="button" data-testid="back" onClick={onBack}>
        Back
      </button>
      <output data-testid="campaign-name">{title}</output>
      <button type="button" data-testid="name-first" onClick={() => onTitleChange('First draft')}>
        First name
      </button>
      <button type="button" data-testid="name-second" onClick={() => onTitleChange('Second draft')}>
        Second name
      </button>
      {actionItems.map((item) => (
        <button type="button" key={item.key} data-testid={item.key} disabled={item.disabled} onClick={item.onClick}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/features/editor/EditorPermissionRevokedDialog', () => ({ EditorPermissionRevokedDialog: () => null }));
vi.mock('@/features/editor/EditorSessionExpiredDialog', () => ({ EditorSessionExpiredDialog: () => null }));

vi.mock('@/components/core/Input', () => ({
  // The layout picker: choosing its first option reports that option's value, as the Core Select does.
  Select: ({
    data,
    disabled,
    onChange,
  }: {
    data: Array<{ value: string }>;
    disabled?: boolean;
    onChange: (value: string | null) => void;
  }) => (
    <button
      type="button"
      data-testid="layout-select"
      disabled={disabled}
      onClick={() => onChange(data[0]?.value ?? null)}
    >
      Choose layout
    </button>
  ),
  TextInput: ({
    label,
    value,
    disabled,
    onChange,
  }: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  }) => <input aria-label={label} data-testid="subject" value={value} disabled={disabled} onChange={onChange} />,
}));
vi.mock('@/components/core/Input/DateTimeInput', () => ({
  dateTimeValueToDate: ({ date, time }: { date: Date | null; time: string }) => {
    if (!date || !time) {
      return null;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const result = new Date(date);
    result.setHours(hours ?? 0, minutes ?? 0, 0, 0);
    return result;
  },
  dateToDateTimeValue: (date: Date) => ({ date, time: '12:00' }),
}));
vi.mock('@/features/site/PageLoader', () => ({ PageLoader: () => null }));
vi.mock('@/features/admin/IconViewModeControl', () => ({ IconViewModeControl: () => null }));
vi.mock('@/features/campaign/CampaignEditor/CampaignEditor', () => ({ CampaignEditor: () => null }));
vi.mock('@/features/campaign/CampaignDeliveryDialogs', () => ({
  CampaignDeliveryDialogs: ({
    readOnly,
    testDialog,
    sendDialog,
    scheduleDialog,
  }: {
    readOnly?: boolean;
    testDialog: { onEmailChange: (email: string) => void; onSend: () => void };
    sendDialog: { opened: boolean; pending: boolean; labels: { warning: string }; onSend: () => void };
    scheduleDialog: {
      opened: boolean;
      audience: string;
      pending: boolean;
      onChange: (value: { date: Date | null; time: string }) => void;
      onSchedule: () => void;
    };
  }) => {
    mocks.confirmSend = sendDialog.onSend;
    return (
      <div>
        <button type="button" data-testid="test-email" onClick={() => testDialog.onEmailChange('qa@example.com')} />
        <button type="button" data-testid="test-confirm" disabled={readOnly} onClick={testDialog.onSend}>
          Confirm test
        </button>
        <div data-testid="send-warning">{sendDialog.labels.warning}</div>
        <div data-testid="schedule-audience">{scheduleDialog.audience}</div>
        <button
          type="button"
          data-testid="send-confirm"
          disabled={readOnly || sendDialog.pending}
          onClick={sendDialog.onSend}
        >
          Confirm send
        </button>
        <button
          type="button"
          data-testid="schedule-date"
          onClick={() => scheduleDialog.onChange({ date: new Date('2030-01-02T00:00:00Z'), time: '12:30' })}
        />
        <button
          type="button"
          data-testid="schedule-confirm"
          disabled={readOnly || scheduleDialog.pending}
          onClick={scheduleDialog.onSchedule}
        >
          Confirm schedule
        </button>
      </div>
    );
  },
}));
vi.mock('@/features/campaign/CampaignRecipientScopeControl', () => ({
  CampaignRecipientScopeControl: ({
    disabled,
    onChange,
  }: {
    disabled?: boolean;
    onChange: (value: 'SUBSCRIBED_USERS' | 'ALL_MATCHING_USERS') => void;
  }) => (
    <button
      type="button"
      data-testid="recipient-scope-all"
      disabled={disabled}
      onClick={() => onChange('ALL_MATCHING_USERS')}
    >
      All matching users
    </button>
  ),
}));
vi.mock('@/features/campaign/useCampaignDeliveryCommands', () => ({
  useCampaignDeliveryCommands: () => ({
    sendTest: { mutate: mocks.sendTest, isPending: false },
    sendCampaign: { mutate: mocks.sendCampaign, isPending: false },
    scheduleCampaign: { mutate: mocks.scheduleCampaign, isPending: false },
    cancelSchedule: { mutate: vi.fn(), isPending: false },
  }),
}));
vi.mock('@/features/campaign/useCampaignPreview', () => ({
  useCampaignPreview: () => ({
    viewMode: 'edit',
    changeViewMode: vi.fn(),
    showEditor: false,
    showPreview: false,
    previewSrcDoc: null,
    editorReady: vi.fn(),
    editorContentChanged: vi.fn(),
    scheduleRefresh: vi.fn(),
  }),
}));
vi.mock('@/features/campaign/CampaignTargetControl', async () => {
  const { CampaignTargetMode } = await import('@echovisionlab/geul-proto/secure/campaign_pb.ts');
  return {
    CampaignTargetControl: ({
      onChange,
      disabled,
    }: {
      onChange: (value: { targetMode: number; segmentId: string }) => void;
      disabled?: boolean;
    }) => (
      <button
        type="button"
        data-testid="change-target"
        disabled={disabled}
        onClick={() => onChange({ targetMode: CampaignTargetMode.SEGMENT, segmentId: 'segment-new' })}
      >
        Change target
      </button>
    ),
    isDeliverableCampaignTarget: (
      { targetMode, segmentId }: { targetMode: number; segmentId: string | null },
      segments: Array<{ id: string }>,
    ) =>
      targetMode === CampaignTargetMode.ALL ||
      Boolean(segmentId && segments.some((segment) => segment.id === segmentId)),
  };
});
vi.mock('@/features/translation/EntityTranslationsPanel', () => ({ EntityTranslationsPanel: () => null }));
vi.mock('@/features/translation/TranslationLocaleControl', () => ({ TranslationLocaleControl: () => null }));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
    roomLocale: mocks.localeSession?.roomLocale,
    activeEditLocale: {
      activeLocale: 'en',
      sourceLocale: 'en',
      isSourceLocale: true,
      hasLiveRow: true,
      displayTitle: 'Subject',
      canEditActiveLocale: true,
      localeOptions: [],
      isControlVisible: false,
      setActiveLocale: vi.fn(),
      ...mocks.localeSession?.activeEditLocale,
    },
    mode: { shouldUseLocaleDocument: mocks.localeSession?.shouldUseLocaleDocument ?? false },
    hasRoomMutationAuthority: () => true,
  }),
}));
vi.mock('@/lib/actions/audience', () => ({ listActiveSegmentsAction: vi.fn() }));
vi.mock('@/lib/actions/campaign', () => ({
  getCampaignAction: mocks.getCampaign,
  updateCampaignConfigurationAction: mocks.updateConfiguration,
  updateCampaignNameAction: mocks.updateName,
}));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn(async () => undefined) }));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/editor/editor-save-registry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/editor/editor-save-registry')>()),
  flushEditorSaves: vi.fn(async () => true),
}));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: (_document: string, callback: () => void) => {
    mocks.peerChange = callback;
  },
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({ useRichTextBlockRoomController: () => null }));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: mocks.provider,
    doc: null,
    bootstrap: null,
    protocol: null,
    isConnected: true,
    isSynced: mocks.isSynced,
  }),
}));
vi.mock('@/lib/i18n/locale', () => ({
  getSupportedLocaleOptions: () => [],
  normalizeLocale: (value: string | null) => value,
}));
vi.mock('@/lib/queries/email-layout', () => ({ listEmailLayoutsSimple: vi.fn() }));
vi.mock('@/lib/utils/not-found-guard', () => ({ guardNotFound: vi.fn() }));

import { flushEditorSaves } from '@/lib/editor/editor-save-registry';
import CampaignEditPage from './CampaignEditPage';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('CampaignEditPage delivery target confirmation', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    setProviderAccessLevel(mocks.provider, 'edit');
    mocks.campaign = {
      id: 'campaign-1',
      status: 'draft',
      subject: 'Subject',
      name: 'Campaign',
      targetMode: CampaignTargetMode.ALL,
      segmentId: null,
      layoutId: null,
      recipientScope: 'SUBSCRIBED_USERS',
    };
    mocks.updateConfiguration.mockReset();
    mocks.updateName.mockReset();
    mocks.sendCampaign.mockReset();
    mocks.sendTest.mockReset();
    mocks.scheduleCampaign.mockReset();
    mocks.routerPush.mockReset();
    mocks.isSynced = true;
    mocks.localeSession = null;
    vi.mocked(flushEditorSaves).mockReset().mockResolvedValue(true);
    mocks.notificationsShow.mockReset();
    mocks.refetchCampaign.mockReset();
    mocks.getCampaign.mockReset().mockImplementation(async () => ({ ok: true, value: mocks.campaign }));
    mocks.refetchCampaign.mockImplementation(async () => ({ data: await mocks.queryFn?.() }));
    mocks.peerChange = null;
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('upgrades and downgrades campaign controls without replacing the open content', async () => {
    setProviderAccessLevel(mocks.provider, 'view');
    await act(async () => root.render(createElement(CampaignEditPage)));
    const content = container.firstElementChild;
    const controls = [...container.querySelectorAll('[data-testid="change-target"]')];
    expect(controls.length).toBeGreaterThan(0);
    expect((container.querySelector('[data-testid="send-confirm"]') as HTMLButtonElement).disabled).toBe(true);
    act(() => setProviderAccessLevel(mocks.provider, 'edit'));
    expect((container.querySelector('[data-testid="send-confirm"]') as HTMLButtonElement).disabled).toBe(false);
    expect(container.firstElementChild).toBe(content);
    act(() => setProviderAccessLevel(mocks.provider, 'view'));
    expect(container.firstElementChild).toBe(content);
    expect(mocks.provider.disconnect).not.toHaveBeenCalled();
    expect((container.querySelector('[data-testid="send-confirm"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => mocks.confirmSend?.());
    expect(mocks.sendCampaign).not.toHaveBeenCalled();
    expect(container.querySelectorAll('[data-testid="change-target"]').length).toBe(controls.length);
    expect(controls.every((control) => (control as HTMLInputElement).disabled)).toBe(true);
  });

  it('blocks send and schedule confirmation until the saved target is reflected in both modals', async () => {
    const update = deferred<{ error?: string | null }>();
    mocks.updateConfiguration.mockImplementation((_campaignId: string, values: Record<string, unknown>) =>
      update.promise.then((result) => {
        if (!result.error && mocks.campaign) {
          mocks.campaign = { ...mocks.campaign, ...values };
        }
        return result;
      }),
    );

    await act(async () => {
      root.render(createElement(CampaignEditPage));
    });
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      container.querySelector<HTMLButtonElement>('[data-testid="send-now"]')!.click();
      container.querySelector<HTMLButtonElement>('[data-testid="schedule"]')!.click();
      container.querySelector<HTMLButtonElement>('[data-testid="schedule-date"]')!.click();
      container.querySelector<HTMLButtonElement>('[data-testid="change-target"]')!.click();
    });

    expect(mocks.updateConfiguration).toHaveBeenCalledWith(
      'campaign-1',
      {
        targetMode: CampaignTargetMode.SEGMENT,
        segmentId: 'segment-new',
      },
      expect.any(String),
    );
    expect(container.querySelector('[data-testid="send-warning"]')?.textContent).toBe('Send to All users');
    expect(container.querySelector('[data-testid="schedule-audience"]')?.textContent).toBe('All users');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="send-confirm"]')?.disabled).toBe(true);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="schedule-confirm"]')?.disabled).toBe(true);
    expect(mocks.sendCampaign).not.toHaveBeenCalled();
    expect(mocks.scheduleCampaign).not.toHaveBeenCalled();

    await act(async () => {
      update.resolve({ error: null });
      await update.promise;
    });

    expect(container.querySelector('[data-testid="send-warning"]')?.textContent).toBe('Send to New segment');
    expect(container.querySelector('[data-testid="schedule-audience"]')?.textContent).toBe('New segment');
    expect(container.querySelector<HTMLButtonElement>('[data-testid="send-confirm"]')?.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('[data-testid="schedule-confirm"]')?.disabled).toBe(false);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="send-confirm"]')!.click();
      container.querySelector<HTMLButtonElement>('[data-testid="schedule-confirm"]')!.click();
      await Promise.resolve();
    });
    expect(mocks.sendCampaign).toHaveBeenCalledWith('SUBSCRIBED_USERS');
    expect(mocks.scheduleCampaign).toHaveBeenCalledWith({
      scheduledAt: expect.any(Date),
      recipientScope: 'SUBSCRIBED_USERS',
    });
  });

  const deliveryPaths = [
    {
      path: 'send-all',
      start: () => click('send-confirm'),
      delivery: () => mocks.sendCampaign,
      expected: ['SUBSCRIBED_USERS'],
    },
    {
      path: 'send-test',
      start: async () => {
        await click('test-email');
        await click('test-confirm');
      },
      delivery: () => mocks.sendTest,
      expected: [{ email: 'qa@example.com', locale: 'en' }],
    },
    {
      path: 'schedule',
      start: async () => {
        await click('schedule-date');
        await click('schedule-confirm');
      },
      delivery: () => mocks.scheduleCampaign,
      expected: [{ scheduledAt: expect.any(Date), recipientScope: 'SUBSCRIBED_USERS' }],
    },
  ];

  /** One user click, committed before the next one reads the page state. */
  async function click(testId: string) {
    await act(async () => container.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)!.click());
  }

  it.each(deliveryPaths)(
    '$path delivers nothing while unsaved campaign edits fail to save',
    async ({ start, delivery }) => {
      vi.mocked(flushEditorSaves).mockResolvedValueOnce(false);
      await act(async () => root.render(createElement(CampaignEditPage)));

      await start();

      await vi.waitFor(() =>
        expect(mocks.notificationsShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' })),
      );
      expect(delivery()).not.toHaveBeenCalled();
    },
  );

  it.each(deliveryPaths)(
    '$path delivers once unsaved campaign edits are saved',
    async ({ start, delivery, expected }) => {
      await act(async () => root.render(createElement(CampaignEditPage)));

      await start();

      await vi.waitFor(() => expect(delivery()).toHaveBeenCalledWith(...expected));
      expect(flushEditorSaves).toHaveBeenCalledWith('campaign:campaign-1');
      expect(vi.mocked(flushEditorSaves).mock.invocationCallOrder[0]).toBeLessThan(
        delivery().mock.invocationCallOrder[0]!,
      );
    },
  );

  it('stays on the campaign when Back cannot save pending edits, and leaves once they are saved', async () => {
    vi.mocked(flushEditorSaves).mockResolvedValueOnce(false);
    await act(async () => root.render(createElement(CampaignEditPage)));

    await click('back');
    await vi.waitFor(() =>
      expect(mocks.notificationsShow).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' })),
    );
    expect(mocks.routerPush).not.toHaveBeenCalled();

    await click('back');
    await vi.waitFor(() => expect(mocks.routerPush).toHaveBeenCalledWith('/admin/campaigns'));
  });

  it.each([
    ['layout', 'layout-select', { layoutId: 'layout-1' }],
    ['recipient scope', 'recipient-scope-all', { recipientScope: 'ALL_MATCHING_USERS' }],
  ])('writes only the changed %s to the campaign configuration', async (_field, control, values) => {
    mocks.updateConfiguration.mockResolvedValue({});
    await act(async () => root.render(createElement(CampaignEditPage)));

    await click(control);

    await vi.waitFor(() =>
      expect(mocks.updateConfiguration).toHaveBeenCalledWith('campaign-1', values, expect.any(String)),
    );
    expect(mocks.updateConfiguration).toHaveBeenCalledOnce();
  });

  it('shows an explicitly empty target-locale subject and keeps it locked until the locale room syncs', async () => {
    mocks.isSynced = false;
    mocks.localeSession = {
      roomLocale: 'ko',
      shouldUseLocaleDocument: true,
      activeEditLocale: { activeLocale: 'ko', sourceLocale: 'en', isSourceLocale: false, displayTitle: '' },
    };
    await act(async () => root.render(createElement(CampaignEditPage)));
    const subject = () => container.querySelector<HTMLInputElement>('[data-testid="subject"]')!;

    // The source subject ('Subject') must not stand in for the translator's intentional empty value.
    expect(subject().value).toBe('');
    expect(subject().disabled).toBe(true);

    mocks.isSynced = true;
    await act(async () => root.render(createElement(CampaignEditPage)));

    expect(subject().value).toBe('');
    expect(subject().disabled).toBe(false);
  });

  it('drops a peer read started before a configuration write after the write has settled', async () => {
    const staleRead = deferred<{ ok: true; value: Record<string, unknown> | null }>();
    const staleCampaign = { ...mocks.campaign };
    mocks.getCampaign.mockImplementationOnce(() => staleRead.promise);
    mocks.updateConfiguration.mockImplementation(async (_id: string, values: Record<string, unknown>) => {
      mocks.campaign = { ...mocks.campaign, ...values };
      return {};
    });
    await act(async () => {
      root.render(createElement(CampaignEditPage));
    });
    act(() => mocks.peerChange?.());
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="change-target"]')!.click();
      await Promise.resolve();
    });
    expect(container.querySelector('[data-testid="send-warning"]')?.textContent).toBe('Send to New segment');
    await act(async () => {
      staleRead.resolve({ ok: true, value: staleCampaign });
      await staleRead.promise;
    });
    expect(container.querySelector('[data-testid="send-warning"]')?.textContent).toBe('Send to New segment');
  });
});
