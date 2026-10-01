import { create, toJson } from '@bufbuild/protobuf';
import { hydrateCanonicalBlockRoom } from '@echovisionlab/geul-common/collaboration/block-room-codec';
import { contentBlockCatalogFingerprint } from '@echovisionlab/geul-proto/content/block_catalog.ts';
import {
  LocalizedRichTextDocumentSchema,
  RichTextProfile,
} from '@echovisionlab/geul-proto/content/block_content_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { BlockRoomProtocolClient } from './block-room-protocol';

const entityId = '11111111-1111-4111-8111-111111111111';
const targetRevision = `tr1_${'A'.repeat(43)}`;

interface BootstrapFixtureOptions {
  sourceLocale?: string;
  locale?: string;
  localeExists?: boolean;
  targetRevision?: string;
}

function bootstrapFixture(challenge = 'challenge-1', options: BootstrapFixtureOptions = {}) {
  const locale = options.locale ?? 'ko';
  const sourceLocale = options.sourceLocale ?? locale;
  const localeExists = options.localeExists ?? true;
  const typed = create(LocalizedRichTextDocumentSchema, {
    blockCatalogFingerprint: contentBlockCatalogFingerprint,
    profile: RichTextProfile.POST,
    locale,
    base: { nodes: [] },
    localeOverlay: { locale, blocks: [] },
  });
  const source = new Y.Doc();
  hydrateCanonicalBlockRoom(source, 'post', sourceLocale, typed, []);
  const update = Y.encodeStateAsUpdate(source);
  source.destroy();
  return {
    challenge,
    update,
    payload: JSON.stringify({
      kind: 'block_room.bootstrap',
      protocolVersion: 2,
      bootstrapChallenge: challenge,
      documentName: `post:${entityId}:${locale}`,
      documentType: 'post',
      document: toJson(LocalizedRichTextDocumentSchema, typed),
      documentRevision: '22222222-2222-4222-8222-222222222222',
      sourceLocale,
      locale,
      localeExists,
      presentLocaleValues: [],
      targetRevision: options.targetRevision,
      sourceMetadata: { locale: sourceLocale },
      documentMetadata: {},
      metadataSequence: 0,
      localeMetadata: localeExists ? { locale } : undefined,
      blockCatalogFingerprint: contentBlockCatalogFingerprint,
      serverInstanceId: 'server-1',
      roomEpoch: '33333333-3333-4333-8333-333333333333',
      yjsBootstrapUpdate: Buffer.from(update).toString('base64'),
    }),
  };
}

function setup(locale = 'ko') {
  const document = new Y.Doc();
  const sendStateless = vi.fn();
  const setResumeToken = vi.fn();
  const onBootstrap = vi.fn();
  const onReady = vi.fn();
  const onReloadRequired = vi.fn();
  const protocol = new BlockRoomProtocolClient({
    documentType: 'post',
    entityId,
    locale,
    document,
    sendStateless,
    setResumeToken,
    onBootstrap,
    onReady,
    onReloadRequired,
  });
  return {
    protocol,
    document,
    sendStateless,
    setResumeToken,
    onBootstrap,
    onReady,
    onReloadRequired,
  };
}

function admit(runtime: ReturnType<typeof setup>, challenge = 'challenge-1', options: BootstrapFixtureOptions = {}) {
  const bootstrap = bootstrapFixture(challenge, options);
  runtime.protocol.handleStateless(bootstrap.payload);
  Y.applyUpdate(runtime.document, bootstrap.update);
  runtime.protocol.handleProviderSynced();
  runtime.protocol.handleStateless(
    JSON.stringify({
      kind: 'block_room.ready',
      protocolVersion: 2,
      bootstrapChallenge: challenge,
    }),
  );
}

describe('BlockRoomProtocolClient', () => {
  it('requires reload before applying a bootstrap from an older inline codec protocol', () => {
    const runtime = setup();
    const oldBootstrap = JSON.parse(bootstrapFixture().payload);
    oldBootstrap.protocolVersion = 1;
    expect(runtime.protocol.handleStateless(JSON.stringify(oldBootstrap))).toBe(true);
    runtime.protocol.handleProviderSynced();
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();
    expect(runtime.onBootstrap).not.toHaveBeenCalled();
    expect(runtime.onReady).not.toHaveBeenCalled();
    expect(runtime.sendStateless).not.toHaveBeenCalled();
    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('waits for the provider state before sending the exact bootstrap ACK', () => {
    const runtime = setup();
    const bootstrap = bootstrapFixture();

    runtime.protocol.handleStateless(bootstrap.payload);
    expect(runtime.onBootstrap).toHaveBeenCalledOnce();
    expect(runtime.sendStateless).not.toHaveBeenCalled();
    expect(runtime.onReady).not.toHaveBeenCalled();

    Y.applyUpdate(runtime.document, bootstrap.update);
    runtime.protocol.handleProviderSynced();

    expect(runtime.sendStateless).toHaveBeenCalledOnce();
    const ack = JSON.parse(runtime.sendStateless.mock.calls[0]![0]) as Record<string, unknown>;
    expect(ack).toEqual({
      kind: 'block_room.bootstrap_ack',
      protocolVersion: 2,
      challenge: 'challenge-1',
      stateVector: expect.any(String),
    });
    expect(Buffer.from(ack.stateVector as string, 'base64')).toEqual(
      Buffer.from(Y.encodeStateVector(runtime.document)),
    );
    expect(runtime.setResumeToken).not.toHaveBeenCalled();
    expect(runtime.onReady).not.toHaveBeenCalled();

    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.ready',
        protocolVersion: 2,
        bootstrapChallenge: 'challenge-1',
      }),
    );
    expect(runtime.setResumeToken).toHaveBeenCalledWith('challenge-1');
    expect(runtime.onReady).toHaveBeenCalledOnce();
    expect(runtime.sendStateless).toHaveBeenCalledOnce();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('accepts provider-sync-before-bootstrap ordering when the resident state already matches', () => {
    const runtime = setup();
    const bootstrap = bootstrapFixture();
    Y.applyUpdate(runtime.document, bootstrap.update);

    runtime.protocol.handleProviderSynced();
    expect(runtime.sendStateless).not.toHaveBeenCalled();
    runtime.protocol.handleStateless(bootstrap.payload);

    expect(JSON.parse(runtime.sendStateless.mock.calls[0]![0])).toMatchObject({
      kind: 'block_room.bootstrap_ack',
      challenge: 'challenge-1',
    });
    expect(runtime.onReloadRequired).not.toHaveBeenCalled();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('requires the actual provider Y.Doc to contain the canonical bootstrap state', () => {
    const runtime = setup();
    runtime.protocol.handleStateless(bootstrapFixture().payload);

    runtime.protocol.handleProviderSynced();

    expect(runtime.sendStateless).not.toHaveBeenCalled();
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();
    expect(runtime.onReady).not.toHaveBeenCalled();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('rejects a ready message from another bootstrap challenge', () => {
    const runtime = setup();
    const bootstrap = bootstrapFixture();
    runtime.protocol.handleStateless(bootstrap.payload);
    Y.applyUpdate(runtime.document, bootstrap.update);
    runtime.protocol.handleProviderSynced();

    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.ready',
        protocolVersion: 2,
        bootstrapChallenge: 'another-challenge',
      }),
    );

    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();
    expect(runtime.setResumeToken).not.toHaveBeenCalled();
    expect(runtime.onReady).not.toHaveBeenCalled();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('correlates exact metadata and authoritative snapshot messages on the admitted socket', async () => {
    const runtime = setup();
    admit(runtime);
    expect(runtime.setResumeToken).toHaveBeenCalledWith('challenge-1');
    expect(runtime.onReady).toHaveBeenCalledOnce();
    runtime.sendStateless.mockClear();

    const metadata = runtime.protocol.updateMetadata('locale', { locale: 'ko', title: '제목' });
    const metadataRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    expect(metadataRequest).toEqual({
      kind: 'block_room.metadata',
      protocolVersion: 2,
      requestId: expect.any(String),
      operation: 'locale',
      payload: { locale: 'ko', title: '제목' },
    });
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_result',
        protocolVersion: 2,
        requestId: metadataRequest.requestId,
        ok: true,
        ack: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          targetRevision,
          changed: true,
          sourceChanged: true,
          changedLocales: ['ko'],
          locale: 'ko',
          metadataUpdate: { operation: 'locale', values: { title: '제목' }, sequence: 1 },
        },
      }),
    );
    await expect(metadata).resolves.toMatchObject({
      changed: true,
      changedLocales: ['ko'],
      targetRevision,
    });

    const snapshot = runtime.protocol.getSnapshot();
    const snapshotRequest = JSON.parse(runtime.sendStateless.mock.calls[1]![0]);
    expect(snapshotRequest).toEqual({
      kind: 'block_room.snapshot',
      protocolVersion: 2,
      requestId: expect.any(String),
    });
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.snapshot_result',
        protocolVersion: 2,
        requestId: snapshotRequest.requestId,
        ok: true,
        snapshot: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          sourceLocale: 'ko',
          locale: 'ko',
          localeExists: true,
        },
      }),
    );
    await expect(snapshot).resolves.toEqual({
      documentRevision: '44444444-4444-4444-8444-444444444444',
      sourceLocale: 'ko',
      locale: 'ko',
      localeExists: true,
    });

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('propagates reload-required failures and rejects pending work on teardown', async () => {
    const runtime = setup();
    admit(runtime);
    runtime.sendStateless.mockClear();

    const metadata = runtime.protocol.updateMetadata('document', { categoryIds: [] });
    const metadataRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_result',
        protocolVersion: 2,
        requestId: metadataRequest.requestId,
        ok: false,
        error: 'reload_required',
      }),
    );
    await expect(metadata).rejects.toMatchObject({
      name: 'BlockRoomProtocolError',
      reloadRequired: true,
    });
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();

    const snapshot = runtime.protocol.getSnapshot();
    runtime.protocol.destroy();
    await expect(snapshot).rejects.toEqual(
      expect.objectContaining({
        name: 'BlockRoomProtocolError',
        message: 'Block-room WebSocket was closed.',
        reloadRequired: false,
      }),
    );
    runtime.document.destroy();
  });

  it('fences a malformed successful metadata ACK and requires a canonical reload', async () => {
    const runtime = setup();
    admit(runtime);
    runtime.sendStateless.mockClear();

    const metadata = runtime.protocol.updateMetadata('locale', { locale: 'ko', title: '제목' });
    const metadataRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_result',
        protocolVersion: 2,
        requestId: metadataRequest.requestId,
        ok: true,
        ack: { changed: 'not-a-boolean' },
      }),
    );

    await expect(metadata).rejects.toMatchObject({
      name: 'BlockRoomProtocolError',
      reloadRequired: true,
    });
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('preserves opaque target revision bytes and rejects a blank target revision', async () => {
    const runtime = setup();
    admit(runtime);
    runtime.sendStateless.mockClear();

    const opaqueTargetRevision = ` ${targetRevision}\n`;
    const metadata = runtime.protocol.updateMetadata('locale', { locale: 'ko', title: '제목' });
    const metadataRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_result',
        protocolVersion: 2,
        requestId: metadataRequest.requestId,
        ok: true,
        ack: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          targetRevision: opaqueTargetRevision,
          changed: true,
          sourceChanged: false,
          changedLocales: ['ko'],
          locale: 'ko',
          metadataUpdate: { operation: 'locale', values: { title: '제목' }, sequence: 1 },
        },
      }),
    );
    await expect(metadata).resolves.toMatchObject({ targetRevision: opaqueTargetRevision });

    const malformed = runtime.protocol.updateMetadata('locale', { locale: 'ko', title: '제목' });
    const malformedRequest = JSON.parse(runtime.sendStateless.mock.calls[1]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_result',
        protocolVersion: 2,
        requestId: malformedRequest.requestId,
        ok: true,
        ack: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          targetRevision: '  ',
          changed: true,
          sourceChanged: false,
          changedLocales: ['ko'],
          locale: 'ko',
          metadataUpdate: { operation: 'locale', values: { title: '제목' }, sequence: 2 },
        },
      }),
    );
    await expect(malformed).rejects.toMatchObject({
      name: 'BlockRoomProtocolError',
      reloadRequired: true,
    });
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('fails closed when a snapshot omits exact room identity or revision parity', async () => {
    const runtime = setup();
    admit(runtime);
    runtime.sendStateless.mockClear();

    const snapshot = runtime.protocol.getSnapshot();
    const snapshotRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.snapshot_result',
        protocolVersion: 2,
        requestId: snapshotRequest.requestId,
        ok: true,
        snapshot: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          targetRevision,
          sourceLocale: 'ko',
          locale: 'ko',
          localeExists: true,
        },
      }),
    );

    await expect(snapshot).rejects.toMatchObject({
      name: 'BlockRoomProtocolError',
      reloadRequired: true,
    });
    expect(runtime.onReloadRequired).toHaveBeenCalledOnce();

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('preserves an opaque target revision in an exact target snapshot', async () => {
    const opaqueTargetRevision = ` ${targetRevision}\n`;
    const runtime = setup('en');
    admit(runtime, 'challenge-1', {
      sourceLocale: 'ko',
      locale: 'en',
      targetRevision: opaqueTargetRevision,
    });
    runtime.sendStateless.mockClear();

    const snapshot = runtime.protocol.getSnapshot();
    const snapshotRequest = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.snapshot_result',
        protocolVersion: 2,
        requestId: snapshotRequest.requestId,
        ok: true,
        snapshot: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          targetRevision: opaqueTargetRevision,
          sourceLocale: 'ko',
          locale: 'en',
          localeExists: true,
        },
      }),
    );

    await expect(snapshot).resolves.toMatchObject({
      targetRevision: opaqueTargetRevision,
      sourceLocale: 'ko',
      locale: 'en',
      localeExists: true,
    });

    runtime.protocol.destroy();
    runtime.document.destroy();
  });

  it('fences a timed-out metadata mutation and requires a canonical reload', async () => {
    vi.useFakeTimers();
    const runtime = setup();
    admit(runtime);
    runtime.sendStateless.mockClear();

    try {
      const metadata = runtime.protocol.updateMetadata('document', { categoryIds: [] });
      const rejected = expect(metadata).rejects.toMatchObject({
        name: 'BlockRoomProtocolError',
        reloadRequired: true,
      });

      await vi.advanceTimersByTimeAsync(10_000);
      await rejected;
      expect(runtime.onReloadRequired).toHaveBeenCalledOnce();
    } finally {
      runtime.protocol.destroy();
      runtime.document.destroy();
      vi.useRealTimers();
    }
  });

  it('honors request aborts and leaves unrelated stateless messages unconsumed', async () => {
    const runtime = setup();
    admit(runtime);
    const controller = new AbortController();
    const request = runtime.protocol.updateMetadata('locale', { locale: 'ko' }, controller.signal);

    controller.abort();

    await expect(request).rejects.toMatchObject({ name: 'AbortError' });
    expect(runtime.protocol.handleStateless(JSON.stringify({ kind: 'another_protocol' }))).toBe(false);

    runtime.protocol.destroy();
    runtime.document.destroy();
  });
});

it('projects initial metadata to early and late subscribers and ignores reordered peer ACKs', () => {
  const runtime = setup();
  const early = vi.fn();
  runtime.protocol.subscribeMetadata(early);
  const bootstrap = JSON.parse(bootstrapFixture().payload);
  bootstrap.sourceMetadata = { locale: 'ko', title: 'initial' };
  bootstrap.localeMetadata = { locale: 'ko', title: 'initial' };
  bootstrap.documentMetadata = { categoryIds: ['initial'] };
  runtime.protocol.handleStateless(JSON.stringify(bootstrap));
  expect(early).toHaveBeenCalledWith({ operation: 'locale', values: { title: 'initial' }, sequence: 0 });
  const send = (sequence: number, title: string, documentName = `post:${entityId}:ko`) =>
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.metadata_changed',
        protocolVersion: 2,
        documentName,
        ack: {
          documentRevision: '44444444-4444-4444-8444-444444444444',
          changed: true,
          sourceChanged: true,
          changedLocales: ['ko'],
          locale: 'ko',
          metadataUpdate: { operation: 'locale', values: { title }, sequence },
        },
      }),
    );
  send(2, 'latest');
  send(1, 'old');
  send(3, 'wrong room', `post:${entityId}:en`);
  expect(early).toHaveBeenLastCalledWith({ operation: 'locale', values: { title: 'latest' }, sequence: 2 });
  const late = vi.fn();
  runtime.protocol.subscribeMetadata(late);
  expect(late).toHaveBeenCalledWith({ operation: 'locale', values: { title: 'latest' }, sequence: 2 });
  expect(runtime.onReloadRequired).not.toHaveBeenCalled();
  runtime.protocol.destroy();
  runtime.document.destroy();
});

it('requires metadata update details in successful metadata ACKs', async () => {
  const runtime = setup();
  admit(runtime);
  runtime.sendStateless.mockClear();
  const pending = runtime.protocol.updateMetadata('locale', {
    locale: 'ko',
    title: 'updated',
  });
  const request = JSON.parse(runtime.sendStateless.mock.calls[0]![0]);
  runtime.protocol.handleStateless(
    JSON.stringify({
      kind: 'block_room.metadata_result',
      protocolVersion: 2,
      requestId: request.requestId,
      ok: true,
      ack: {
        documentRevision: '44444444-4444-4444-8444-444444444444',
        changed: true,
        sourceChanged: true,
        changedLocales: ['ko'],
        locale: 'ko',
      },
    }),
  );
  await expect(pending).rejects.toMatchObject({ reloadRequired: true });
  expect(runtime.onReloadRequired).toHaveBeenCalledOnce();
  runtime.protocol.destroy();
  runtime.document.destroy();
});

it('accepts durability hints only for the admitted exact room and valid clocks', () => {
  const runtime = setup();
  const listener = vi.fn();
  const unsubscribe = runtime.protocol.subscribePersisted(listener);
  const vector = Y.encodeStateVector(runtime.document);
  const send = (documentName = `post:${entityId}:ko`, stateVector = Buffer.from(vector).toString('base64')) =>
    runtime.protocol.handleStateless(
      JSON.stringify({
        kind: 'block_room.persisted',
        protocolVersion: 2,
        documentName,
        stateVector,
        deleted: { '7': [{ clock: 2, len: 3 }] },
      }),
    );
  send();
  expect(listener).not.toHaveBeenCalled();
  admit(runtime);
  send(`post:${entityId}:en`);
  send(undefined, 'bad vector');
  expect(listener).not.toHaveBeenCalled();
  send();
  expect(listener).toHaveBeenCalledExactlyOnceWith({ stateVector: vector, deleted: { '7': [{ clock: 2, len: 3 }] } });
  unsubscribe();
  send();
  expect(listener).toHaveBeenCalledOnce();
  runtime.protocol.destroy();
  runtime.document.destroy();
});
