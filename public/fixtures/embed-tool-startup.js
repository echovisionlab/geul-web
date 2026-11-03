// External mount boundary for Tool Startup stories; the normal ready fixture stays unchanged.
const state = new URL(import.meta.url).searchParams.get('state');

export async function mount(_host, { signal }) {
  if (state === 'failed') {
    throw new Error('Fixture tool mount failed');
  }
  if (state !== 'pending' || !signal) {
    throw new Error('Pending fixture requires a state and an AbortSignal');
  }
  signal.throwIfAborted();
  await new Promise((_resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(signal.reason);
    };
    signal.addEventListener('abort', abort, { once: true });
  });
}
