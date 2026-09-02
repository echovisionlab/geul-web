import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTime } from './formatDate';

describe('date formatting utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-25T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for empty date values', () => {
    expect(formatRelativeTime(null)).toBeNull();
    expect(formatRelativeTime(undefined)).toBeNull();
  });

  it.each([
    ['2026-06-25T11:59:30.000Z', '30 seconds ago'],
    ['2026-06-25T11:30:00.000Z', '30 minutes ago'],
    ['2026-06-25T09:00:00.000Z', '3 hours ago'],
    ['2026-06-23T12:00:00.000Z', '2 days ago'],
  ])('formats relative time for %s', (date, expected) => {
    expect(formatRelativeTime(date, 'en-US')).toBe(expected);
  });

  it('falls back to an absolute date after one week', () => {
    expect(formatRelativeTime('2026-06-10T12:00:00.000Z', 'en-US')).toBe('June 10, 2026');
  });

  it('uses the explicit request time zone for the absolute fallback', () => {
    expect(formatRelativeTime('2026-06-10T23:30:00.000Z', 'en-US', 'Asia/Seoul')).toBe('June 11, 2026');
  });
});
