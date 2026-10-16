import { execFile } from 'node:child_process';
import { isAbsolute } from 'node:path';

export const EMAIL_PREVIEW_FIXTURE_PATH = '/__fixtures/email-preview';
const MAX_DOCUMENT_BYTES = 32 * 1024 * 1024;

class PreviewFailure extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function readRequest(request, signal, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const finish = (error, value) => {
      request.off('data', onData);
      request.off('end', onEnd);
      request.off('error', onError);
      signal.removeEventListener('abort', onAbort);
      if (error) {
        request.once('error', () => {});
        request.resume();
        reject(error);
      } else resolve(value);
    };
    const onData = (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) finish(new PreviewFailure(413, 'Email preview input is too large'));
      else chunks.push(chunk);
    };
    const onEnd = () => {
      try {
        const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid envelope');
        finish(null, input);
      } catch {
        finish(new PreviewFailure(400, 'Email preview requires a JSON object'));
      }
    };
    const onError = () => finish(new PreviewFailure(400, 'Email preview request was interrupted'));
    const onAbort = () => finish(signal.reason);
    request.on('data', onData);
    request.once('end', onEnd);
    request.once('error', onError);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function renderEmail(binaryPath, input, signal, maxBytes) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      binaryPath,
      [],
      { encoding: 'utf8', env: {}, shell: false, signal, killSignal: 'SIGKILL', maxBuffer: maxBytes },
      (error, stdout) => {
        if (error) {
          const unavailable = error.code === 'ENOENT' || error.code === 'EACCES';
          reject(
            new PreviewFailure(
              unavailable ? 503 : 422,
              unavailable ? 'Email preview renderer is unavailable' : 'The email renderer could not render this draft',
            ),
          );
          return;
        }
        try {
          const result = JSON.parse(stdout);
          if (
            typeof result?.html !== 'string' ||
            typeof result.subject !== 'string' ||
            typeof result.text !== 'string'
          ) {
            throw new Error('Invalid renderer result');
          }
          resolve(result);
        } catch {
          reject(new PreviewFailure(502, 'The email renderer returned an invalid response'));
        }
      },
    );
    // A renderer can reject before consuming stdin; its callback owns the error.
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify(input));
  });
}

function createRendererQueue(maxConcurrent) {
  let active = 0;
  const waiting = [];
  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };
  return (signal) => {
    if (signal.aborted) return Promise.reject(signal.reason);
    if (active < maxConcurrent) {
      active += 1;
      return Promise.resolve(release);
    }
    if (waiting.length >= 128) return Promise.reject(new PreviewFailure(429, 'Email preview renderer is busy'));
    return new Promise((resolve, reject) => {
      const resume = () => {
        signal.removeEventListener('abort', abort);
        active += 1;
        resolve(release);
      };
      const abort = () => {
        waiting.splice(waiting.indexOf(resume), 1);
        reject(signal.reason);
      };
      signal.addEventListener('abort', abort, { once: true });
      waiting.push(resume);
    });
  };
}

function respond(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(JSON.stringify(body));
}

/** Storybook-only adapter to the production Go renderer. Never sends email. */
export function createEmailPreviewHandler({
  binaryPath = process.env.EMAIL_PREVIEW_FIXTURE_BINARY,
  deadlineMs = 10_000,
  maxBytes = MAX_DOCUMENT_BYTES,
  maxConcurrent = 2,
} = {}) {
  const acquireRenderer = createRendererQueue(maxConcurrent);
  return async function handleRequest(request, response) {
    if (request.url !== EMAIL_PREVIEW_FIXTURE_PATH) return false;
    if (request.method !== 'POST') {
      response.setHeader('Allow', 'POST');
      respond(response, 405, { error: 'Email preview requires POST' });
      return true;
    }
    const origin = request.headers.origin;
    let sameOrigin = !origin;
    try {
      sameOrigin ||=
        new URL(origin).origin === `${request.socket.encrypted ? 'https' : 'http'}://${request.headers.host}`;
    } catch {
      /* An invalid Origin is rejected below. */
    }
    if (!sameOrigin || request.headers['sec-fetch-site'] === 'cross-site') {
      respond(response, 403, { error: 'Email preview requires the Storybook origin' });
      return true;
    }
    if (!binaryPath || !isAbsolute(binaryPath)) {
      respond(response, 503, { error: 'Configure EMAIL_PREVIEW_FIXTURE_BINARY with the built Go renderer' });
      return true;
    }
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(new PreviewFailure(504, 'Email preview timed out')), deadlineMs);
    deadline.unref();
    const disconnect = () => {
      if (!response.writableEnded) controller.abort(new Error('Preview client disconnected'));
    };
    request.once('aborted', disconnect);
    // Queued requests have no body reader yet; still own their stream error lifecycle.
    request.once('error', disconnect);
    request.once('close', () => request.off('error', disconnect));
    response.once('close', disconnect);
    let releaseRenderer;
    try {
      // Keep queued requests under stream backpressure instead of buffering full drafts.
      releaseRenderer = await acquireRenderer(controller.signal);
      const input = await readRequest(request, controller.signal, maxBytes);
      const result = await renderEmail(binaryPath, input, controller.signal, maxBytes);
      if (!response.destroyed) respond(response, 200, result);
    } catch (error) {
      request.resume();
      const failure = controller.signal.aborted ? controller.signal.reason : error;
      if (!response.destroyed) {
        respond(response, failure instanceof PreviewFailure ? failure.status : 500, {
          error: failure instanceof PreviewFailure ? failure.message : 'Email preview failed',
        });
      }
    } finally {
      clearTimeout(deadline);
      request.off('aborted', disconnect);
      response.off('close', disconnect);
      releaseRenderer?.();
    }
    return true;
  };
}
