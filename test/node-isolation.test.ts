import { describe, expect, it, vi } from 'vitest';

describe('Node test transport isolation', () => {
  it('rejects accidental service calls before any network activity', async () => {
    await expect(fetch('https://service.example.test')).rejects.toThrow('Unexpected network request');
  });

  it('allows a test to install an explicit transport', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('fixture')));
    expect(await (await fetch('https://service.example.test')).text()).toBe('fixture');
  });

  it('restores the rejecting transport instead of leaking the preceding test mock', async () => {
    await expect(fetch('https://service.example.test')).rejects.toThrow('Unexpected network request');
  });
});
