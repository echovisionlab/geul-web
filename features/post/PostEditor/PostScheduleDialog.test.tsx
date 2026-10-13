// @vitest-environment jsdom

import { DesignSystemProvider } from '@/lib/providers/DesignSystemProvider';
import { act } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enMessages from '@/messages/en.json';
import { RequestTimeZoneProvider } from '@/lib/providers/RequestTimeZoneProvider';
import { PostScheduleDialog, type PostScheduleDialogProps } from './PostScheduleDialog';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-10-11T00:00:00.000Z').getTime());
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function renderSchedule({
  initialInstant = '2026-10-18T08:30:00.000Z',
  initialTimeZone = 'Asia/Seoul',
  requestTimeZone = 'UTC',
}: {
  initialInstant?: string | null;
  initialTimeZone?: string | null;
  requestTimeZone?: string;
} = {}) {
  const onSubmit = vi.fn<PostScheduleDialogProps['onSubmit']>();
  await act(async () => {
    root?.render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <DesignSystemProvider locale="en" forceColorScheme="light">
          <RequestTimeZoneProvider timeZone={requestTimeZone}>
            <PostScheduleDialog
              opened
              onClose={vi.fn()}
              onSubmit={onSubmit}
              initialInstant={initialInstant}
              initialTimeZone={initialTimeZone}
            />
          </RequestTimeZoneProvider>
        </DesignSystemProvider>
      </NextIntlClientProvider>,
    );
  });
  return onSubmit;
}

function getDialog() {
  return document.body.querySelector<HTMLElement>('[role="dialog"]')!;
}

async function submitSchedule() {
  await act(async () => {
    getDialog()
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

describe('PostScheduleDialog', () => {
  it('restores the saved IANA zone and submits the same UTC instant', async () => {
    const onSubmit = await renderSchedule();
    const dialog = getDialog();
    const resolution = dialog.querySelector<HTMLElement>('[data-testid="post-schedule-resolution"]');
    expect(dialog.textContent).toContain('Reschedule post');
    // The selected zone is displayed in a combobox input value, not textContent.
    expect(dialog.querySelector<HTMLInputElement>('[role="combobox"]')?.value).toBe('Asia/Seoul');
    expect(resolution?.textContent).toContain('2026-10-18T08:30:00.000Z');
    expect(resolution?.textContent).toContain('daylight-saving');
    expect(dialog.querySelector('[role="spinbutton"][data-type="hour"]')?.getAttribute('aria-valuenow')).toBe('17');
    expect(dialog.querySelector('[role="spinbutton"][data-type="minute"]')?.getAttribute('aria-valuenow')).toBe('30');
    expect(dialog.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);

    await submitSchedule();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'Asia/Seoul',
        instant: new Date('2026-10-18T08:30:00.000Z'),
        utcLabel: '2026-10-18T08:30:00.000Z',
      }),
    );
  });

  it('initializes a new schedule one hour ahead in the request time zone', async () => {
    const onSubmit = await renderSchedule({
      initialInstant: null,
      initialTimeZone: null,
      requestTimeZone: 'Asia/Seoul',
    });
    const dialog = getDialog();
    expect(dialog.querySelector<HTMLInputElement>('[role="combobox"]')?.value).toBe('Asia/Seoul');
    expect(dialog.querySelector('[data-type="hour"]')?.getAttribute('aria-valuenow')).toBe('10');
    await submitSchedule();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'Asia/Seoul',
        instant: new Date('2026-10-11T01:00:00.000Z'),
      }),
    );
  });

  it('restores a wall time that is valid in the saved zone but is a DST gap in another browser zone', async () => {
    const onSubmit = await renderSchedule({ initialInstant: '2027-03-13T17:30:00.000Z' });
    expect(getDialog().querySelector('[data-type="hour"]')?.getAttribute('aria-valuenow')).toBe('2');
    await submitSchedule();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'Asia/Seoul',
        instant: new Date('2027-03-13T17:30:00.000Z'),
      }),
    );
  });

  it('converts the entered wall time using the newly selected zone', async () => {
    const onSubmit = await renderSchedule();
    const input = getDialog().querySelector<HTMLInputElement>('[role="combobox"]')!;
    await act(async () => {
      input.focus();
    });
    const option = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]')).find(
      (element) => element.textContent === 'America/New York',
    )!;
    expect(option).toBeDefined();
    await act(async () => option.click());
    expect(input.value).toBe('America/New York');
    expect(getDialog().querySelector('[data-testid="post-schedule-resolution"]')?.textContent).toContain(
      '2026-10-18T21:30:00.000Z',
    );

    await submitSchedule();
    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        timeZone: 'America/New_York',
        instant: new Date('2026-10-18T21:30:00.000Z'),
      }),
    );
  });
});
