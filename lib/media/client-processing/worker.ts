import { createArtifactStore, fingerprintSource, saveManifest } from './artifact-storage';
import { ClientMediaUnavailableError, checkAbort, type ProcessingOptions, type WorkerReply } from './contracts';

type WorkerRequest =
  | { type: 'prepare'; file: File; kind: 'audio' | 'video'; namespace: string; codecAssetBaseUrl: string }
  | { type: 'cancel' }
  | { type: 'dispose' };

const scope = globalThis as unknown as {
  addEventListener: (type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void) => void;
  postMessage: (message: WorkerReply) => void;
};
let controller: AbortController | undefined;
let artifactStore: Awaited<ReturnType<typeof createArtifactStore>> | undefined;
let activeJob: Promise<void> | undefined;
let completed = false;

async function cleanup(): Promise<void> {
  await artifactStore?.dispose();
  scope.postMessage({ type: 'disposed' });
}

scope.addEventListener('message', (event) => {
  const request = event.data;
  if (request.type === 'cancel' || request.type === 'dispose') {
    controller?.abort();
    void (activeJob ?? Promise.resolve()).then(cleanup, cleanup).catch(() => undefined);
    return;
  }
  if (activeJob || completed) {
    scope.postMessage({
      type: 'error',
      error: { name: 'Error', message: 'Client media Worker accepts one preparation job.' },
    });
    return;
  }
  controller = new AbortController();
  const signal = controller.signal;
  activeJob = (async () => {
    let processingStarted = false;
    try {
      const store = await createArtifactStore(request.namespace, signal);
      artifactStore = store;
      const options: ProcessingOptions = {
        signal,
        codecAssetBaseUrl: request.codecAssetBaseUrl,
        onProgress: (progress) => {
          processingStarted ||= progress > 0;
          scope.postMessage({ type: 'progress', progress });
        },
        onArtifact: (artifact) => {
          processingStarted = true;
          return store.write(artifact);
        },
      };
      const metadata =
        request.kind === 'audio'
          ? await (await import('./audio-processing')).processClientAudio(request.file, options)
          : await (await import('./video-processing')).processClientVideo(request.file, options);
      checkAbort(signal);
      if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
        throw new Error('Client media processing returned an invalid duration.');
      }
      const artifacts = store.artifacts();
      if (!artifacts.some((artifact) => artifact.path === 'master.m3u8')) {
        throw new Error('Client media processing did not produce a master playlist.');
      }
      const sourceFingerprint = await fingerprintSource(request.file, signal);
      await saveManifest(
        request.namespace,
        {
          version: 1,
          storageId: request.namespace,
          metadata,
          source: {
            name: request.file.name,
            size: request.file.size,
            type: request.file.type,
            lastModified: request.file.lastModified,
            fingerprint: sourceFingerprint,
          },
          artifacts: artifacts.map(({ file: _file, ...artifact }) => artifact),
        },
        signal,
      );
      checkAbort(signal);
      completed = true;
      scope.postMessage({ type: 'complete', metadata, artifacts, storageId: request.namespace, sourceFingerprint });
    } catch (error) {
      await artifactStore?.dispose().catch(() => undefined);
      scope.postMessage({
        type: 'error',
        error: {
          name: error instanceof Error ? error.name : 'Error',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          processingStarted,
          ...(error instanceof ClientMediaUnavailableError ? { unavailableReason: error.reason } : {}),
        },
      });
    }
  })();
});
