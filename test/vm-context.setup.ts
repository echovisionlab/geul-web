import { ReadableStream, TransformStream, WritableStream } from 'node:stream/web';

// vmThreads runs each file in jsdom's own VM context. Vitest copies fetch, Response, Headers,
// AbortController, MessageChannel and a few more of Node's classes into it, but not the WHATWG streams that
// react-dom/server.browser (`renderToReadableStream`) creates and `new Response(stream)` reads. These are
// Node's classes, the same realm as the copied Response.
for (const [name, value] of Object.entries({ ReadableStream, TransformStream, WritableStream })) {
  if (!(name in globalThis)) {
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
}
