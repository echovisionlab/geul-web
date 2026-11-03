// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, renderHook } from '@/test/render';
import { TestProviders } from '@/test/TestProviders';
import { afterEach, expect, it, vi } from 'vitest';
import { useFieldValidation } from './useFieldValidation';

const parser = vi.hoisted(() => vi.fn());
vi.mock('@/lib/types/phone/PhoneNumber', () => ({ extractPhoneValue: parser }));
afterEach(() => {
  vi.useRealTimers();
  parser.mockReset();
});
it('ends a failed phone validation wait and retries when the answer changes', async () => {
  vi.useFakeTimers();
  parser
    .mockImplementationOnce(() => {
      throw new Error('Parser unavailable');
    })
    .mockReturnValue({ isValid: true });
  const field = { id: 'phone', type: 'tel' as const, label: 'Phone' };
  const view = renderHook(({ value }) => useFieldValidation({ field, value, debounceMs: 0 }), {
    initialProps: { value: { phone: '123', countryCode: 'US' } },
    wrapper: ({ children }: { children: ReactNode }) => <TestProviders>{children}</TestProviders>,
  });
  await act(async () => vi.runOnlyPendingTimersAsync());
  expect(view.result.current.isValidating).toBe(false);
  expect(view.result.current.isValid).toBe(false);
  expect(view.result.current.error).toBe('Failed to load data.');
  view.rerender({ value: { phone: '2025550123', countryCode: 'US' } });
  await act(async () => vi.runOnlyPendingTimersAsync());
  expect(view.result.current.isValidating).toBe(false);
  expect(view.result.current.isValid).toBe(true);
  expect(view.result.current.error).toBeNull();
});
