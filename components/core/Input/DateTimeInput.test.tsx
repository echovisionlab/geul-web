// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MantineProvider } from '@mantine/core';
import { dateTimeValueToDate, dateToDateTimeValue, DateTimeInput } from './DateTimeInput';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('DateTimeInput', () => {
  it('round-trips a local wall-clock value without applying a time zone', () => {
    const date = new Date(2026, 7, 5, 20, 46, 30);
    const value = dateToDateTimeValue(date);

    expect(value).toEqual({ date: '2026-08-05', time: '20:46' });
    expect(dateTimeValueToDate(value)?.getTime()).toBe(new Date(2026, 7, 5, 20, 46).getTime());
    expect(dateTimeValueToDate({ date: '2026-02-31', time: '20:46' })).toBeNull();
    expect(dateTimeValueToDate({ date: '2026-08-05', time: '' })).toBeNull();
  });

  it('renders a localized date input and a dropdown-free 24-hour time input', () => {
    act(() => {
      root.render(
        <MantineProvider env="test">
          <DateTimeInput
            locale="ko"
            dateLabel="날짜"
            timeLabel="시각"
            previousLabel="이전 달"
            nextLabel="다음 달"
            hoursLabel="시간"
            minutesLabel="분"
            value={{ date: '2026-08-05', time: '20:46' }}
            onChange={vi.fn()}
          />
        </MantineProvider>,
      );
    });

    const input = container.querySelector<HTMLButtonElement>('[data-dates-input]');
    expect(input).not.toBeNull();
    expect(input?.textContent).toContain('2026. 08. 05.');
    const hoursInput = container.querySelector<HTMLInputElement>('input[aria-label="시간"]');
    const minutesInput = container.querySelector<HTMLInputElement>('input[aria-label="분"]');
    expect(hoursInput?.value).toBe('20');
    expect(minutesInput?.value).toBe('46');
    expect(container.querySelector('input[aria-label*="AM"]')).toBeNull();
    expect(container.querySelector('select')).toBeNull();

    act(() => input?.click());

    expect(document.body.querySelector('[data-dates-dropdown]')).not.toBeNull();
    expect(document.body.textContent).toContain('2026년 8월');
    expect(document.body.querySelector('button[aria-label="이전 달"]')).not.toBeNull();
    expect(document.body.querySelector('button[aria-label="다음 달"]')).not.toBeNull();
  });
});
