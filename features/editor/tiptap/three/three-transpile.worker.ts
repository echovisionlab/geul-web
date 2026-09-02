import { transpileThreeSceneSource } from './three-transpile';

type TranspileRequest = { type: 'transpile'; source: string };

const worker = globalThis as typeof globalThis & {
  postMessage: (message: unknown) => void;
  onmessage: ((event: MessageEvent<TranspileRequest>) => void) | null;
};

worker.onmessage = (event) => {
  if (event.data.type !== 'transpile') {
    return;
  }
  worker.postMessage(transpileThreeSceneSource(event.data.source));
};
