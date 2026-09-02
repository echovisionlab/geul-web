// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DateTime } from './DateTime';

describe('DateTime', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    if (root) {
      act(() => root?.unmount());
    }
    container?.remove();
    root = null;
    container = null;
  });

  it('uses the request-provided time zone and emits a semantic instant', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DateTime
          value="2026-03-06T07:24:00.000Z"
          locale="en"
          timeZone="Asia/Seoul"
          display="dateTime"
          options={{
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }}
        />,
      );
    });

    expect(container.textContent).toBe('Mar 6, 2026, 04:24 PM');
    expect(container.querySelector('time')?.dateTime).toBe('2026-03-06T07:24:00.000Z');
  });

  it('allows a domain-owned time zone to override the request time zone', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DateTime
          value="2026-03-06T07:24:00.000Z"
          locale="en"
          timeZone="America/New_York"
          display="time"
          options={{ hour: '2-digit', minute: '2-digit' }}
        />,
      );
    });

    expect(container.textContent).toBe('02:24 AM');
  });

  it('renders the fallback for absent or invalid values', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(<DateTime value="not-a-date" locale="en" timeZone="UTC" fallback="Unknown" />);
    });

    expect(container.textContent).toBe('Unknown');
    expect(container.querySelector('time')).toBeNull();
  });
});
