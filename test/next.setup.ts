import { vi } from 'vitest';

// Routes opt into Next request semantics; pure Node tests do not install this mock.
vi.mock('next/server', async () => {
  const nextServer = await vi.importActual<typeof import('next/server')>('next/server');
  return { ...nextServer, connection: vi.fn(async () => undefined) };
});
