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
  scheduleCampaign: vi.fn(),
  notificationsShow: vi.fn(),
  refetchCampaign: vi.fn(),
  getCampaign: vi.fn(),
  queryFn: null as (() => Promise<unknown>) | null,
  peerChange: null as (() => void) | null,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'campaign-1' }),
  useRouter: () => ({ push: vi.fn() }),
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
  }: {
    title: string;
    onTitleChange: (value: string) => void;
    actionItems: Array<{ key: string; label: string; disabled?: boolean; onClick: () => void }>;
  }) => (
    <div>
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
  Select: () => null,
  TextInput: () => null,
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
    sendDialog,
    scheduleDialog,
  }: {
    readOnly?: boolean;
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
vi.mock('@/features/campaign/CampaignRecipientScopeControl', () => ({ CampaignRecipientScopeControl: () => null }));
vi.mock('@/features/campaign/useCampaignDeliveryCommands', () => ({
  useCampaignDeliveryCommands: () => ({
    sendTest: { mutate: vi.fn(), isPending: false },
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
vi.mock('@/features/translation/locale-display-fields', () => ({
  canEditLocaleDocumentField: () => true,
  resolveResidentLocaleField: ({ sourceValue }: { sourceValue: string }) => sourceValue,
}));
vi.mock('@/features/translation/TranslationLocaleControl', () => ({ TranslationLocaleControl: () => null }));
vi.mock('@/features/translation/useLocaleDocumentSession', () => ({
  useLocaleDocumentSession: () => ({
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
    },
    mode: { shouldUseLocaleDocument: false },
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
    isSynced: true,
  }),
}));
vi.mock('@/lib/i18n/locale', () => ({
  getSupportedLocaleOptions: () => [],
  normalizeLocale: (value: string | null) => value,
}));
vi.mock('@/lib/queries/email-layout', () => ({ listEmailLayoutsSimple: vi.fn() }));
vi.mock('@/lib/utils/not-found-guard', () => ({ guardNotFound: vi.fn() }));

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
    mocks.scheduleCampaign.mockReset();
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
  it('preserves a newer name draft through peer refetch and an older name acknowledgement', async () => {
    vi.useFakeTimers();
    const firstWrite = deferred<{ name: string }>();
    const secondWrite = deferred<{ name: string }>();
    mocks.updateName.mockImplementation((_id: string, name: string) =>
      name === 'First draft' ? firstWrite.promise : secondWrite.promise,
    );
    await act(async () => root.render(createElement(CampaignEditPage)));
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="name-first"]')!.click());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    act(() => container.querySelector<HTMLButtonElement>('[data-testid="name-second"]')!.click());
    await act(async () => {
      mocks.peerChange?.();
    });
    expect(container.querySelector('[data-testid="campaign-name"]')?.textContent).toBe('Second draft');
    await act(async () => {
      firstWrite.resolve({ name: 'Canonical first' });
      await firstWrite.promise;
    });
    expect(container.querySelector('[data-testid="campaign-name"]')?.textContent).toBe('Second draft');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    await act(async () => {
      secondWrite.resolve({ name: 'Canonical second' });
      await secondWrite.promise;
    });
    expect(container.querySelector('[data-testid="campaign-name"]')?.textContent).toBe('Canonical second');
    expect(mocks.updateName).toHaveBeenCalledWith('campaign-1', 'First draft', expect.any(String));
    expect(mocks.updateName).toHaveBeenCalledWith('campaign-1', 'Second draft', expect.any(String));
  });
});
