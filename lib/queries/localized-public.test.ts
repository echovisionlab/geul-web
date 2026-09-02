import type { LocalizationInfo } from '@echovisionlab/geul-proto/public/translation_pb.ts';
import { describe, expect, it, vi } from 'vitest';
import { mapPublicLocalizationInfo, maybeFetchSourceLocale } from './localized-public';

describe('mapPublicLocalizationInfo', () => {
  it('returns null when localization info is absent', () => {
    expect(mapPublicLocalizationInfo(null)).toBeNull();
    expect(mapPublicLocalizationInfo(undefined)).toBeNull();
  });

  it('maps available locales and localized state fields', () => {
    const mapped = mapPublicLocalizationInfo({
      requestedLocale: 'en',
      displayedLocale: 'ko',
      sourceLocale: 'ko',
      isFallback: true,
      isOriginal: false,
      machineGenerated: true,
      fallbackReason: 3,
      availableLocales: ['ko', 'en'],
    } as unknown as LocalizationInfo);

    expect(mapped).toEqual({
      requestedLocale: 'en',
      displayedLocale: 'ko',
      sourceLocale: 'ko',
      isFallback: true,
      isOriginal: false,
      machineGenerated: true,
      fallbackReason: 3,
      availableLocales: ['ko', 'en'],
    });
  });

  it('omits available locales when the proto list is empty', () => {
    const mapped = mapPublicLocalizationInfo({
      requestedLocale: 'ko',
      displayedLocale: 'ko',
      sourceLocale: 'ko',
      isFallback: false,
      isOriginal: true,
      machineGenerated: false,
      fallbackReason: 0,
      availableLocales: [],
    } as unknown as LocalizationInfo);

    expect(mapped?.availableLocales).toBeUndefined();
  });
});

describe('maybeFetchSourceLocale', () => {
  it('keeps the initial response when source locale is already displayed', async () => {
    const fetchWithLocale = vi.fn();
    const initialResponse = { ok: true };

    const result = await maybeFetchSourceLocale({
      preferSourceLocale: true,
      initialResponse,
      entity: {
        localizationInfo: {
          sourceLocale: 'ko',
          displayedLocale: 'ko',
        },
      },
      fetchWithLocale,
    });

    expect(result).toBe(initialResponse);
    expect(fetchWithLocale).not.toHaveBeenCalled();
  });

  it('refetches with the normalized source locale when original view is preferred', async () => {
    const initialResponse = { ok: false };
    const sourceResponse = { ok: true };
    const fetchWithLocale = vi.fn().mockResolvedValue(sourceResponse);

    const result = await maybeFetchSourceLocale({
      preferSourceLocale: true,
      initialResponse,
      entity: {
        localizationInfo: {
          sourceLocale: 'ko-KR',
          displayedLocale: 'en-US',
        },
      },
      fetchWithLocale,
    });

    expect(fetchWithLocale).toHaveBeenCalledWith('ko');
    expect(result).toBe(sourceResponse);
  });
});
