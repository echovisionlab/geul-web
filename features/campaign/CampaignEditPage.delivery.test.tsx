// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CampaignTargetMode } from '@echovisionlab/geul-proto/secure/campaign_pb.ts';

const mocks = vi.hoisted(() => ({
  campaign: null as Record<string, unknown> | null,
  updateConfiguration: vi.fn(),
  sendCampaign: vi.fn(),
  scheduleCampaign: vi.fn(),
  notificationsShow: vi.fn(),
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
    useQuery: ({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'campaigns') {
        return {
          data: mocks.campaign,
          isLoading: false,
          refetch: async () => ({ data: mocks.campaign }),
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

vi.mock('@mantine/core', async () => {
  const React = await import('react');
  return {
    Box: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Group: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SimpleGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Stack: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Text: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
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

vi.mock('@mantine/notifications', () => ({ notifications: { show: mocks.notificationsShow } }));

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
  }: {
    actionItems: Array<{ key: string; label: string; disabled?: boolean; onClick: () => void }>;
  }) => (
    <div>
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
vi.mock('@/features/editor/useEditorPermissionRevocation', () => ({
  useEditorPermissionRevocation: () => ({ blocked: false, revoked: false, sessionExpired: false }),
}));
vi.mock('@/components/core/Input', () => ({
  Select: () => null,
  TextInput: () => null,
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
    sendDialog,
    scheduleDialog,
  }: {
    sendDialog: { opened: boolean; pending: boolean; labels: { warning: string }; onSend: () => void };
    scheduleDialog: {
      opened: boolean;
      audience: string;
      pending: boolean;
      onChange: (value: { date: Date | null; time: string }) => void;
      onSchedule: () => void;
    };
  }) => (
    <div>
      <div data-testid="send-warning">{sendDialog.labels.warning}</div>
      <div data-testid="schedule-audience">{scheduleDialog.audience}</div>
      <button type="button" data-testid="send-confirm" disabled={sendDialog.pending} onClick={sendDialog.onSend}>
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
        disabled={scheduleDialog.pending}
        onClick={scheduleDialog.onSchedule}
      >
        Confirm schedule
      </button>
    </div>
  ),
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
vi.mock('@/features/campaign/useCampaignName', () => ({
  useCampaignName: () => ({ name: 'Campaign', changeName: vi.fn(), pending: false }),
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
  getCampaignAction: vi.fn(),
  updateCampaignConfigurationAction: mocks.updateConfiguration,
}));
vi.mock('@/lib/collab/persist-now', () => ({ persistCollaborativeDocumentNow: vi.fn(async () => undefined) }));
vi.mock('@/lib/collab/block-room-metadata', () => ({ updateBlockRoomLocaleMetadata: vi.fn() }));
vi.mock('@/lib/contexts/EditorRuntimeContext', () => ({
  EditorRuntimeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/lib/editor/editor-save-registry', () => ({ flushEditorSaves: vi.fn(async () => true) }));
vi.mock('@/lib/editor/editor-entity-changes', () => ({
  publishEditorEntityChange: vi.fn(),
  useEditorEntityChanges: vi.fn(),
}));
vi.mock('@/lib/editor/useBlockRoomMetadataUpdates', () => ({ useBlockRoomMetadataUpdates: vi.fn() }));
vi.mock('@/lib/editor/useDebouncedRoomMetadata', () => ({ useDebouncedRoomMetadata: () => vi.fn() }));
vi.mock('@/features/editor/hooks/useBlockRoomTiptapController', () => ({ useRichTextBlockRoomController: () => null }));
vi.mock('@/lib/collab/useBlockRoomConnection', () => ({
  useBlockRoomConnection: () => ({
    provider: null,
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
    mocks.campaign = {
      id: 'campaign-1',
      status: 'draft',
      subject: 'Subject',
      targetMode: CampaignTargetMode.ALL,
      segmentId: null,
      layoutId: null,
      recipientScope: 'SUBSCRIBED_USERS',
    };
    mocks.updateConfiguration.mockReset();
    mocks.sendCampaign.mockReset();
    mocks.scheduleCampaign.mockReset();
    mocks.notificationsShow.mockReset();
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
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

    expect(mocks.updateConfiguration).toHaveBeenCalledWith('campaign-1', {
      targetMode: CampaignTargetMode.SEGMENT,
      segmentId: 'segment-new',
    });
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
});
