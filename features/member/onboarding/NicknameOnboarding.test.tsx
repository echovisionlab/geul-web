// @vitest-environment jsdom

import { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/render';
import { NicknameOnboarding } from './NicknameOnboarding';

// useNicknameValidation's default debounce before the availability check.
const CHECK_DEBOUNCE_MS = 350;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

it('enables completion once the nickname is available and completes onboarding with it', async () => {
  const member = { id: 'member-1', nickname: 'June Han', avatarUrl: null, deleted: false };
  const checkAvailability = vi.fn(async () => ({ available: true }));
  const completeOnboarding = vi.fn(async () => ({ onboarded: true, member }));
  const onCompleted = vi.fn();
  render(
    <NicknameOnboarding
      initialNickname="June Han"
      checkAvailability={checkAvailability}
      completeOnboarding={completeOnboarding}
      onCompleted={onCompleted}
      onLogout={vi.fn()}
    />,
  );
  const submit = screen.getByRole('button', { name: 'Continue' });
  expect(submit).toBeDisabled();

  await act(() => vi.advanceTimersByTimeAsync(CHECK_DEBOUNCE_MS));

  expect(checkAvailability).toHaveBeenCalledWith('June Han');
  expect(submit).toBeEnabled();

  vi.useRealTimers();
  await userEvent.setup().click(submit);

  expect(completeOnboarding).toHaveBeenCalledWith('June Han');
  expect(onCompleted).toHaveBeenCalledWith(member);
});

it('keeps completion disabled for an unavailable nickname', async () => {
  const completeOnboarding = vi.fn();
  render(
    <NicknameOnboarding
      initialNickname="taken"
      checkAvailability={async () => ({ available: false })}
      completeOnboarding={completeOnboarding}
      onCompleted={vi.fn()}
      onLogout={vi.fn()}
    />,
  );

  await act(() => vi.advanceTimersByTimeAsync(CHECK_DEBOUNCE_MS));

  expect(screen.getByRole('textbox', { name: /Nickname/ })).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});
