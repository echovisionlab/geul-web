import { fromJson } from '@bufbuild/protobuf';
import { ValueSchema } from '@bufbuild/protobuf/wkt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSiteSettingClient } from '@/lib/api/browser-client';
import { getOgConfig } from './site-setting-browser';

vi.mock('@/lib/api/browser-client', () => ({
  createSiteSettingClient: vi.fn(),
}));

vi.mock('@/lib/utils/client-logger', () => ({
  createClientLogger: () => ({ error: vi.fn() }),
}));

const getSetting = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createSiteSettingClient).mockReturnValue({
    getSetting,
  } as unknown as ReturnType<typeof createSiteSettingClient>);
});

describe('getOgConfig', () => {
  it('converts the protobuf Value into the canonical JSON config', async () => {
    getSetting.mockResolvedValue({
      setting: {
        value: fromJson(ValueSchema, {
          home: { title: 'Stored home' },
          content: { title: 'Stored content' },
        }),
      },
    });

    await expect(getOgConfig()).resolves.toEqual({
      home: { title: 'Stored home' },
      content: { title: 'Stored content' },
    });
  });
});
