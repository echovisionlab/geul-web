#!/usr/bin/env node
// Fetches HTML documents from a running `next start` and reports their size, including the bytes
// of the inlined client message catalogue (the `messages` prop of ClientMessagesProvider in the
// RSC flight data).
//
//   node scripts/performance/html-document-size.mjs http://127.0.0.1:3917 / /posts/example /login
//
// Output: one JSON object per route with status, raw/gzip HTML bytes and the catalogue estimate.
// Use the same build and backend state for before/after comparisons; signed-out requests only.

import { gzipSync } from 'node:zlib';

const [baseUrl, ...routes] = process.argv.slice(2);
if (!baseUrl || routes.length === 0) {
  console.error('Usage: node scripts/performance/html-document-size.mjs <base-url> <route> [...route]');
  process.exit(2);
}

/** Decodes the `self.__next_f.push([1,"..."])` chunks into the flight payload text. */
function flightPayload(html) {
  let payload = '';
  for (const match of html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)) {
    payload += JSON.parse(match[1]);
  }
  return payload;
}

/** Bytes of the JSON object that follows `"messages":` in the flight payload, or 0. */
function catalogueBytes(payload) {
  const start = payload.indexOf('"messages":{');
  if (start === -1) return 0;
  let depth = 0;
  let inString = false;
  for (let index = start + '"messages":'.length; index < payload.length; index += 1) {
    const char = payload[index];
    if (inString) {
      if (char === '\\') index += 1;
      else if (char === '"') inString = false;
    } else if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return Buffer.byteLength(payload.slice(start, index + 1));
    }
  }
  return 0;
}

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), { redirect: 'manual', headers: { accept: 'text/html' } });
  const html = await response.text();
  const bytes = Buffer.from(html);
  console.log(
    JSON.stringify({
      route,
      status: response.status,
      htmlBytes: bytes.length,
      htmlGzipBytes: gzipSync(bytes, { level: 9 }).length,
      catalogueBytes: catalogueBytes(flightPayload(html)),
    }),
  );
}
