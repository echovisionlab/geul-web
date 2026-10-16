import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, writeFile, chmod, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { createEmailPreviewHandler, EMAIL_PREVIEW_FIXTURE_PATH } from './email-preview-handler.mjs';

async function boundary(t, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'email-preview-transport-'));
  const binaryPath = join(directory, 'renderer');
  // Only the process/HTTP contract is stubbed here. Browser regression uses the built Go binary.
  await writeFile(
    binaryPath,
    `#!${process.execPath}\nlet input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{const request=JSON.parse(input);if(request.subject==='fail'){process.stderr.write('private-renderer-detail');process.exit(1);}if(request.subject==='invalid'){process.stdout.write('not JSON');return;}const result={subject:request.subject,html:JSON.stringify(request),text:'plain text'};setTimeout(()=>process.stdout.write(JSON.stringify(result)),request.subject==='wait'?150:0);});\n`,
  );
  await chmod(binaryPath, 0o700);
  const handler = createEmailPreviewHandler({ binaryPath, ...options });
  const server = createServer(async (request, response) => {
    if (!(await handler(request, response))) response.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    request: (input, init = {}) =>
      fetch(`${origin}${EMAIL_PREVIEW_FIXTURE_PATH}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        ...init,
      }),
  };
}

test('passes canonical draft JSON through the executable and preserves its complete response', async (t) => {
  const fixture = await boundary(t);
  const input = {
    locale: 'ko',
    subject: 'Subject',
    document: { locale: 'ko' },
    layoutHtml: '<html>{{content}}</html>',
    variables: { name: 'Sample' },
  };
  const response = await fixture.request(input);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { subject: input.subject, html: JSON.stringify(input), text: 'plain text' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('routes only its exact fixture path and rejects cross-origin, wrong-method and invalid JSON requests', async (t) => {
  const fixture = await boundary(t);
  assert.equal((await fetch(`${fixture.origin}/other`)).status, 404);
  assert.equal((await fetch(`${fixture.origin}${EMAIL_PREVIEW_FIXTURE_PATH}?extra=1`)).status, 404);
  assert.equal((await fetch(`${fixture.origin}${EMAIL_PREVIEW_FIXTURE_PATH}`)).status, 405);
  assert.equal((await fixture.request({}, { headers: { Origin: 'https://other.test' } })).status, 403);
  assert.equal((await fixture.request({}, { body: 'not JSON' })).status, 400);
  assert.equal((await fixture.request([])).status, 400);
});

test('requires an explicitly configured absolute renderer executable', async (t) => {
  const fixture = await boundary(t, { binaryPath: 'relative-renderer' });
  assert.equal((await fixture.request({})).status, 503);
});

test('does not expose renderer stderr or accept non-JSON stdout', async (t) => {
  const fixture = await boundary(t);
  const rejected = await fixture.request({ subject: 'fail' });
  assert.equal(rejected.status, 422);
  assert.doesNotMatch(await rejected.text(), /private-renderer-detail/);
  assert.equal((await fixture.request({ subject: 'invalid' })).status, 502);
});

test('bounds request, process output and total render deadline', async (t) => {
  const small = await boundary(t, { maxBytes: 64 });
  assert.equal((await small.request({ subject: 'x'.repeat(100) })).status, 413);
  assert.equal((await small.request({ subject: 'small' })).status, 422);
  const slow = await boundary(t, { deadlineMs: 30 });
  assert.equal((await slow.request({ subject: 'wait' })).status, 504);
});

test('queues simultaneous story renders instead of rejecting normal parallel mounts', async (t) => {
  const fixture = await boundary(t, { maxConcurrent: 1 });
  const responses = await Promise.all(Array.from({ length: 3 }, () => fixture.request({ subject: 'wait' })));
  assert.deepEqual(
    responses.map((response) => response.status),
    [200, 200, 200],
  );
  for (const response of responses) await response.arrayBuffer();
});

test('an aborted browser request does not block subsequent stories', async (t) => {
  const fixture = await boundary(t, { maxConcurrent: 1 });
  const controller = new AbortController();
  const first = fixture.request({ subject: 'wait' });
  const cancelled = fixture.request({ subject: 'wait' }, { signal: controller.signal });
  const cancellation = assert.rejects(cancelled, { name: 'AbortError' });
  controller.abort();
  await cancellation;
  const next = fixture.request({ subject: 'next' });
  assert.equal((await first).status, 200);
  assert.equal((await next).status, 200);
});
