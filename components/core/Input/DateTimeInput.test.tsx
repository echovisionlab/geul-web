// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

  it('renders localized calendar and 24-hour segmented time controls', () => {
    act(() =>
      root.render(
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
        />,
      ),
    );
    expect(container.querySelector('[data-type="year"]')?.textContent).toContain('2026');
    expect(container.querySelector('[data-type="month"]')?.textContent).toContain('8');
    expect(container.querySelector('[data-type="day"]')?.textContent).toContain('5');
    expect(container.querySelector('[data-type="hour"]')?.getAttribute('aria-valuenow')).toBe('20');
    expect(container.querySelector('[data-type="minute"]')?.getAttribute('aria-valuenow')).toBe('46');
    expect(container.querySelector('[data-type="dayPeriod"]')).toBeNull();
    const calendarButton = container.querySelector('button');
    act(() => calendarButton?.click());
    expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.textContent).toContain('2026년 8월');
    expect(document.body.querySelector('button[aria-label="이전 달"]')).not.toBeNull();
    expect(document.body.querySelector('button[aria-label="다음 달"]')).not.toBeNull();
  });
});
