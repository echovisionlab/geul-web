// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/actions/user', () => ({
  checkNicknameAvailabilityAction: vi.fn(),
}));

import {
  normalizeNickname,
  useNicknameValidation,
  type NicknameAvailabilityCheck,
  type NicknameValidationState,
} from './useNicknameValidation';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;
let currentState: NicknameValidationState | null = null;

function Harness({ value, check }: { value: string; check: NicknameAvailabilityCheck }) {
  currentState = useNicknameValidation(value, { check, debounceMs: 20 });
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  currentState = null;
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('useNicknameValidation', () => {
  it('trims, preserves case, and enforces 1 to 100 characters', () => {
    expect(normalizeNickname('  MixedCase  ')).toEqual({ normalized: 'MixedCase', length: 9, valid: true });
    expect(normalizeNickname('   ').valid).toBe(false);
    expect(normalizeNickname('가'.repeat(100)).valid).toBe(true);
    expect(normalizeNickname('가'.repeat(101)).valid).toBe(false);
  });

  it('debounces checks and ignores an older response after the value changes', async () => {
    const resolvers = new Map<string, (result: { available: boolean }) => void>();
    const check = vi.fn(
      (nickname: string) =>
        new Promise<{ available: boolean }>((resolve) => {
          resolvers.set(nickname, resolve);
        }),
    );

    await act(async () => {
      root.render(<Harness value="Alpha" check={check} />);
    });
    expect(currentState?.status).toBe('checking');
    expect(check).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(check).toHaveBeenCalledWith('Alpha');

    await act(async () => {
      root.render(<Harness value="Beta" check={check} />);
    });
    await act(async () => vi.advanceTimersByTimeAsync(20));
    expect(check).toHaveBeenCalledWith('Beta');

    await act(async () => resolvers.get('Alpha')?.({ available: false }));
    expect(currentState?.status).toBe('checking');

    await act(async () => resolvers.get('Beta')?.({ available: true }));
    expect(currentState?.status).toBe('available');
  });
});
