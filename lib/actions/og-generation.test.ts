import { Code, ConnectError } from '@connectrpc/connect';
import { OgGenerationRunStatus } from '@echovisionlab/geul-proto/secure/admin_pb.ts';
import { OgEntityType, OgGenerationStatus } from '@echovisionlab/geul-proto/secure/events_pb.ts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '@/lib/api/server-client';
import {
  getLatestOgGenerationAction,
  getOgGenerationAction,
  getOgGenerationRunAction,
  regenerateOgImageAction,
} from './og-generation';

const mocks = vi.hoisted(() => ({
  regenerateOgImage: vi.fn(),
  getOgGeneration: vi.fn(),
  getLatestOgGeneration: vi.fn(),
  getOgGenerationRun: vi.fn(),
}));

vi.mock('@/lib/api/server-client', () => ({
  createAdminClient: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createAdminClient).mockResolvedValue({
    regenerateOgImage: mocks.regenerateOgImage,
    getOgGeneration: mocks.getOgGeneration,
    getLatestOgGeneration: mocks.getLatestOgGeneration,
    getOgGenerationRun: mocks.getOgGenerationRun,
  } as unknown as Awaited<ReturnType<typeof createAdminClient>>);
  mocks.regenerateOgImage.mockResolvedValue({
    runId: 'run-1',
    generationIds: ['generation-1'],
  });
});

describe('OG generation actions', () => {
  it.each([
    {
      name: 'locale',
      input: {
        entityType: 'post' as const,
        entityId: ' post-1 ',
        selection: { type: 'locale' as const, locale: ' ko ' },
      },
      expected: {
        entityType: OgEntityType.POST,
        entityId: 'post-1',
        selection: { target: { case: 'locale', value: 'ko' } },
      },
    },
    {
      name: 'localized work',
      input: {
        entityType: 'work' as const,
        entityId: 'work-1',
        selection: { type: 'locale' as const, locale: 'fr' },
      },
      expected: {
        entityType: OgEntityType.WORK,
        entityId: 'work-1',
        selection: { target: { case: 'locale', value: 'fr' } },
      },
    },
    {
      name: 'all locales',
      input: { entityType: 'page' as const, entityId: 'page-1', selection: { type: 'all_locales' as const } },
      expected: {
        entityType: OgEntityType.PAGE,
        entityId: 'page-1',
        selection: { target: { case: 'allLocales', value: {} } },
      },
    },
  ])('maps the $name target selection without sentinel strings', async ({ input, expected }) => {
    await expect(regenerateOgImageAction(input)).resolves.toEqual({
      runId: 'run-1',
      generationIds: ['generation-1'],
    });

    expect(mocks.regenerateOgImage).toHaveBeenCalledWith(expected);
  });

  it('uses canonical fixed route identities without forwarding a caller entity ID', async () => {
    await regenerateOgImageAction({
      entityType: 'site',
      entityId: 'caller-controlled',
      selection: { type: 'primary' },
    });
    await regenerateOgImageAction({
      entityType: 'privacy',
      selection: { type: 'locale', locale: 'en' },
    });

    expect(mocks.regenerateOgImage).toHaveBeenNthCalledWith(1, {
      entityType: OgEntityType.SITE,
      entityId: undefined,
      selection: { target: { case: 'primary', value: {} } },
    });
    expect(mocks.regenerateOgImage).toHaveBeenNthCalledWith(2, {
      entityType: OgEntityType.PRIVACY,
      entityId: undefined,
      selection: { target: { case: 'locale', value: 'en' } },
    });
  });

  it('maps localized and entity latest-generation queries to concrete targets', async () => {
    mocks.getLatestOgGeneration.mockResolvedValue({});

    await getLatestOgGenerationAction({ entityType: 'privacy', locale: ' ko ' });
    await getLatestOgGenerationAction({ entityType: 'series', entityId: 'series-1', locale: 'ja' });
    await getLatestOgGenerationAction({ entityType: 'work', entityId: 'work-1', locale: 'en' });
    await getLatestOgGenerationAction({ entityType: 'artist', entityId: 'artist-1', locale: 'fr' });
    await getLatestOgGenerationAction({ entityType: 'site' });

    expect(mocks.getLatestOgGeneration).toHaveBeenNthCalledWith(1, {
      target: {
        entityType: OgEntityType.PRIVACY,
        entityId: '00000000-0000-0000-0000-000000000101',
        scope: { case: 'locale', value: { locale: 'ko' } },
      },
    });
    expect(mocks.getLatestOgGeneration).toHaveBeenNthCalledWith(2, {
      target: {
        entityType: OgEntityType.SERIES,
        entityId: 'series-1',
        scope: { case: 'locale', value: { locale: 'ja' } },
      },
    });
    expect(mocks.getLatestOgGeneration).toHaveBeenNthCalledWith(3, {
      target: {
        entityType: OgEntityType.WORK,
        entityId: 'work-1',
        scope: { case: 'locale', value: { locale: 'en' } },
      },
    });
    expect(mocks.getLatestOgGeneration).toHaveBeenNthCalledWith(4, {
      target: {
        entityType: OgEntityType.ARTIST,
        entityId: 'artist-1',
        scope: { case: 'locale', value: { locale: 'fr' } },
      },
    });
    expect(mocks.getLatestOgGeneration).toHaveBeenNthCalledWith(5, {
      target: {
        entityType: OgEntityType.SITE,
        entityId: 'default',
        scope: { case: 'entity', value: {} },
      },
    });
  });

  it('rejects mismatched target scopes before making an RPC', async () => {
    await expect(getLatestOgGenerationAction({ entityType: 'post', entityId: 'post-1' })).resolves.toEqual({
      error: 'Locale is required to load the latest OG generation',
    });
    await expect(
      getLatestOgGenerationAction({ entityType: 'label', entityId: 'label-1', locale: 'ko' }),
    ).resolves.toEqual({
      error: 'This OG target does not accept a locale',
    });
    await expect(
      regenerateOgImageAction({
        entityType: 'post',
        entityId: 'post-1',
        selection: { type: 'locale', locale: ' ' },
      }),
    ).resolves.toEqual({ error: 'Locale is required to regenerate this OG image' });

    expect(mocks.getLatestOgGeneration).not.toHaveBeenCalled();
    expect(mocks.regenerateOgImage).not.toHaveBeenCalled();
  });

  it('maps queued generations directly to the queued UI state', async () => {
    mocks.getOgGeneration.mockResolvedValue({
      generation: {
        generationId: 'generation-1',
        runId: 'run-1',
        status: OgGenerationStatus.QUEUED,
      },
    });

    await expect(getOgGenerationAction(' generation-1 ')).resolves.toEqual({
      generation: {
        generationId: 'generation-1',
        runId: 'run-1',
        status: 'queued',
        assetId: undefined,
        assetUrl: undefined,
        errorCode: undefined,
        replacementGenerationId: undefined,
      },
    });
    expect(mocks.getOgGeneration).toHaveBeenCalledWith({ generationId: 'generation-1' });
  });

  it('maps global run counts directly', async () => {
    mocks.getOgGenerationRun.mockResolvedValue({
      run: {
        runId: 'run-global',
        status: OgGenerationRunStatus.PROCESSING,
        generationCount: 12,
        queuedCount: 2,
        processingCount: 4,
        readyCount: 2,
        failedCount: 1,
        supersededCount: 0,
        cancelledCount: 0,
        failures: [
          {
            generationId: 'generation-bad',
            target: {
              entityType: OgEntityType.POST,
              entityId: 'post-bad',
              scope: { case: 'locale', value: { locale: 'ja' } },
            },
            errorCode: 'render',
            error: 'Render failed',
          },
        ],
      },
    });

    await expect(getOgGenerationRunAction(' run-global ')).resolves.toEqual({
      run: {
        runId: 'run-global',
        status: 'processing',
        generationCount: 12,
        queuedCount: 2,
        processingCount: 4,
        readyCount: 2,
        failedCount: 1,
        supersededCount: 0,
        cancelledCount: 0,
        failures: [
          {
            generationId: 'generation-bad',
            target: { entityType: 'post', entityId: 'post-bad', locale: 'ja' },
            errorCode: 'render',
            error: 'render',
          },
        ],
      },
    });
    expect(mocks.getOgGenerationRun).toHaveBeenCalledWith({ runId: 'run-global' });
  });

  it('returns stable authorization and fallback errors without exposing raw RPC or provider details', async () => {
    mocks.regenerateOgImage
      .mockRejectedValueOnce(new ConnectError('secret permission detail', Code.PermissionDenied))
      .mockRejectedValueOnce(new ConnectError('raw provider credential detail', Code.Internal));

    await expect(
      regenerateOgImageAction({
        entityType: 'artist',
        entityId: 'artist-1',
        selection: { type: 'locale', locale: 'ko' },
      }),
    ).resolves.toEqual({ error: 'Forbidden' });
    await expect(
      regenerateOgImageAction({
        entityType: 'artist',
        entityId: 'artist-1',
        selection: { type: 'locale', locale: 'ko' },
      }),
    ).resolves.toEqual({ error: 'Failed to regenerate OG image' });
  });
});
