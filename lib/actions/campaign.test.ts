import { timestampFromDate } from '@bufbuild/protobuf/wkt';
import {
  CampaignRecipientScope,
  CampaignStatus,
  CampaignTargetMode,
} from '@echovisionlab/geul-proto/secure/campaign_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCampaignClient } from '@/lib/api/server-client';
import {
  createCampaignAction,
  getCampaignAction,
  getCampaignRecipientsAction,
  getCampaignStatsAction,
  previewCampaignAction,
  scheduleCampaignAction,
  sendCampaignNowAction,
} from './campaign';

const createCampaignRpcMock = vi.fn();
const getCampaignRpcMock = vi.fn();
const getCampaignStatsRpcMock = vi.fn();
const getCampaignRecipientsRpcMock = vi.fn();
const previewCampaignRpcMock = vi.fn();
const sendCampaignNowRpcMock = vi.fn();
const scheduleCampaignRpcMock = vi.fn();

type CampaignClient = Awaited<ReturnType<typeof createCampaignClient>>;

function createCampaignClientStub(overrides: Partial<CampaignClient>): CampaignClient {
  return {
    getCampaign: vi.fn(),
    listCampaignsAdmin: vi.fn(),
    createCampaign: vi.fn(),
    updateCampaignName: vi.fn(),
    updateCampaignConfiguration: vi.fn(),
    deleteCampaign: vi.fn(),
    scheduleCampaign: vi.fn(),
    cancelCampaign: vi.fn(),
    sendCampaignNow: vi.fn(),
    previewCampaign: vi.fn(),
    sendTestCampaign: vi.fn(),
    getCampaignStats: vi.fn(),
    getCampaignRecipients: vi.fn(),
    ...overrides,
  };
}

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createCampaignClient: vi.fn(),
}));

describe('createCampaignAction', () => {
  beforeEach(() => {
    createCampaignRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        createCampaign: createCampaignRpcMock,
      }),
    );
  });

  it('uses a default subject when none is provided', async () => {
    createCampaignRpcMock.mockResolvedValue({
      campaign: { id: 'campaign-1' },
    });

    await expect(createCampaignAction()).resolves.toEqual({
      data: { id: 'campaign-1' },
    });

    expect(createCampaignRpcMock).toHaveBeenCalledWith({
      name: 'Untitled Campaign',
      subject: 'Untitled Campaign',
    });
  });

  it('uses a default subject when the provided subject is blank', async () => {
    createCampaignRpcMock.mockResolvedValue({
      campaign: { id: 'campaign-2' },
    });

    await expect(createCampaignAction('   ')).resolves.toEqual({
      data: { id: 'campaign-2' },
    });

    expect(createCampaignRpcMock).toHaveBeenCalledWith({
      name: 'Untitled Campaign',
      subject: 'Untitled Campaign',
    });
  });

  it('trims and forwards an explicit name and mirrors it into subject by default', async () => {
    createCampaignRpcMock.mockResolvedValue({
      campaign: { id: 'campaign-3' },
    });

    await expect(createCampaignAction('  Launch Campaign  ')).resolves.toEqual({
      data: { id: 'campaign-3' },
    });

    expect(createCampaignRpcMock).toHaveBeenCalledWith({
      name: 'Launch Campaign',
      subject: 'Launch Campaign',
    });
  });

  it('forwards distinct shared name and localized subject when both are provided', async () => {
    createCampaignRpcMock.mockResolvedValue({
      campaign: { id: 'campaign-4' },
    });

    await expect(createCampaignAction('Admin Only Name', 'Public Subject')).resolves.toEqual({
      data: { id: 'campaign-4' },
    });

    expect(createCampaignRpcMock).toHaveBeenCalledWith({
      name: 'Admin Only Name',
      subject: 'Public Subject',
    });
  });
});

describe('getCampaignAction', () => {
  beforeEach(() => {
    getCampaignRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        getCampaign: getCampaignRpcMock,
      }),
    );
  });

  const campaign = {
    id: 'campaign-1',
    name: 'Campaign',
    subject: 'Subject',
    status: CampaignStatus.DRAFT,
    targetMode: CampaignTargetMode.ALL,
    segmentId: undefined,
    recipientScope: CampaignRecipientScope.SUBSCRIBED_USERS,
    sentCount: 0,
  };

  it('maps explicit all and segment targets without null inference', async () => {
    getCampaignRpcMock.mockResolvedValueOnce({ campaign });
    await expect(getCampaignAction('campaign-1')).resolves.toMatchObject({
      targetMode: CampaignTargetMode.ALL,
      segmentId: undefined,
    });

    getCampaignRpcMock.mockResolvedValueOnce({
      campaign: {
        ...campaign,
        targetMode: CampaignTargetMode.SEGMENT,
        segmentId: 'audience-1',
      },
    });
    await expect(getCampaignAction('campaign-1')).resolves.toMatchObject({
      targetMode: CampaignTargetMode.SEGMENT,
      segmentId: 'audience-1',
    });
  });

  it('fails closed for unspecified or contradictory target relationships', async () => {
    getCampaignRpcMock.mockResolvedValueOnce({
      campaign: { ...campaign, targetMode: CampaignTargetMode.UNSPECIFIED },
    });
    await expect(getCampaignAction('campaign-1')).resolves.toBeNull();

    getCampaignRpcMock.mockResolvedValueOnce({
      campaign: {
        ...campaign,
        targetMode: CampaignTargetMode.ALL,
        segmentId: 'audience-1',
      },
    });
    await expect(getCampaignAction('campaign-1')).resolves.toBeNull();
  });

  it('fails closed for an unspecified lifecycle status', async () => {
    getCampaignRpcMock.mockResolvedValueOnce({
      campaign: { ...campaign, status: CampaignStatus.UNSPECIFIED },
    });

    await expect(getCampaignAction('campaign-1')).resolves.toBeNull();
  });
});

describe('getCampaignStatsAction', () => {
  beforeEach(() => {
    getCampaignStatsRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        getCampaignStats: getCampaignStatsRpcMock,
      }),
    );
  });

  it('maps campaign delivery counters from the campaign API', async () => {
    getCampaignStatsRpcMock.mockResolvedValue({
      stats: {
        totalSent: 7,
        totalSkipped: 2,
        totalFailed: 1,
        totalBlocked: 3,
        totalSuppressed: 4,
      },
    });

    await expect(getCampaignStatsAction('campaign-1')).resolves.toEqual({
      totalSent: 7,
      totalSkipped: 2,
      totalFailed: 1,
      totalBlocked: 3,
      totalSuppressed: 4,
    });

    expect(getCampaignStatsRpcMock).toHaveBeenCalledWith({ id: 'campaign-1' });
  });
});

describe('getCampaignRecipientsAction', () => {
  beforeEach(() => {
    getCampaignRecipientsRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        getCampaignRecipients: getCampaignRecipientsRpcMock,
      }),
    );
  });

  it('maps campaign delivery recipient timestamps and status', async () => {
    const sentAt = new Date('2026-04-22T01:02:03.000Z');
    const terminalAt = new Date('2026-04-22T01:03:04.000Z');
    getCampaignRecipientsRpcMock.mockResolvedValue({
      recipients: [
        {
          email: 'recipient@example.com',
          memberId: 'member-1',
          status: 'sent',
          sentAt: timestampFromDate(sentAt),
          terminalAt: timestampFromDate(terminalAt),
          errorType: '',
        },
      ],
      total: 1,
    });

    await expect(getCampaignRecipientsAction('campaign-1', 25, 50)).resolves.toEqual({
      recipients: [
        {
          email: 'recipient@example.com',
          memberId: 'member-1',
          status: 'sent',
          sentAt,
          terminalAt,
          errorType: undefined,
        },
      ],
      total: 1,
    });

    expect(getCampaignRecipientsRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      limit: 25,
      offset: 50,
    });
  });
});

describe('previewCampaignAction', () => {
  beforeEach(() => {
    previewCampaignRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        previewCampaign: previewCampaignRpcMock,
      }),
    );
  });

  it('forwards the active locale and selected layout to the preview API', async () => {
    previewCampaignRpcMock.mockResolvedValue({
      preview: {
        subject: 'Subject',
        htmlContent: '<p>HTML</p>',
        textContent: 'Text',
      },
    });

    await expect(
      previewCampaignAction('campaign-1', {
        locale: 'ko',
        layoutId: 'layout-1',
      }),
    ).resolves.toEqual({
      subject: 'Subject',
      htmlContent: '<p>HTML</p>',
      textContent: 'Text',
    });

    expect(previewCampaignRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      locale: 'ko',
      layoutId: 'layout-1',
      subject: undefined,
      document: undefined,
    });
  });

  it('forwards draft subject and typed document overrides to the preview API', async () => {
    const document = { $typeName: 'api.content.v1.LocalizedRichTextDocument' } as never;
    previewCampaignRpcMock.mockResolvedValue({
      preview: {
        subject: 'Draft subject',
        htmlContent: '<p>Draft HTML</p>',
        textContent: 'Draft text',
      },
    });

    await previewCampaignAction('campaign-1', {
      locale: 'ko',
      layoutId: 'layout-1',
      subject: 'Draft subject',
      document,
    });

    expect(previewCampaignRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      locale: 'ko',
      layoutId: 'layout-1',
      subject: 'Draft subject',
      document,
    });
  });

  it('forwards an explicit empty layout override when the selected layout is cleared', async () => {
    previewCampaignRpcMock.mockResolvedValue({
      preview: {
        subject: 'Subject',
        htmlContent: '<p>HTML</p>',
        textContent: 'Text',
      },
    });

    await previewCampaignAction('campaign-1', {
      locale: 'en',
      layoutId: null,
    });

    expect(previewCampaignRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      locale: 'en',
      layoutId: '',
      subject: undefined,
      document: undefined,
    });
  });
});

describe('campaign recipient scope delivery commands', () => {
  beforeEach(() => {
    sendCampaignNowRpcMock.mockReset();
    scheduleCampaignRpcMock.mockReset();
    vi.mocked(createCampaignClient).mockReset();
    vi.mocked(createCampaignClient).mockResolvedValue(
      createCampaignClientStub({
        sendCampaignNow: sendCampaignNowRpcMock,
        scheduleCampaign: scheduleCampaignRpcMock,
      }),
    );
  });

  it('sends the subscribed-users default explicitly', async () => {
    sendCampaignNowRpcMock.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.SENDING,
      recipientCount: 3,
    });

    await sendCampaignNowAction('campaign-1', 'SUBSCRIBED_USERS');

    expect(sendCampaignNowRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      recipientScope: CampaignRecipientScope.SUBSCRIBED_USERS,
    });
  });

  it('schedules all matching users only when explicitly selected', async () => {
    const scheduledAt = new Date('2026-08-04T03:00:00.000Z');
    scheduleCampaignRpcMock.mockResolvedValue({
      id: 'campaign-1',
      changed: true,
      status: CampaignStatus.SCHEDULED,
      recipientScope: CampaignRecipientScope.ALL_MATCHING_USERS,
      scheduledAt: timestampFromDate(scheduledAt),
    });

    await scheduleCampaignAction('campaign-1', scheduledAt, 'ALL_MATCHING_USERS');

    expect(scheduleCampaignRpcMock).toHaveBeenCalledWith({
      id: 'campaign-1',
      scheduledAt: timestampFromDate(scheduledAt),
      recipientScope: CampaignRecipientScope.ALL_MATCHING_USERS,
    });
  });
});
