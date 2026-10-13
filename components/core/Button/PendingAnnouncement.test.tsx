// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { announce, destroyAnnouncer } from 'react-aria/private/live-announcer/LiveAnnouncer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { IconButton } from '../IconButton';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  destroyAnnouncer();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  destroyAnnouncer();
  vi.useRealTimers();
});
const render = async (children: ReactNode) => {
  await act(async () => root.render(<I18nProvider locale="en-US">{children}</I18nProvider>));
};

it.each(['button', 'icon'] as const)(
  'retains the focused pending %s announcement after its owner unmounts',
  async (kind) => {
    const onClick = vi.fn();
    const fixture = (loading: boolean) => (
      <>
        <span id="delete-recording-label" aria-label="Delete recording">
          <span aria-hidden>Decorative content</span>Delete
        </span>
        {kind === 'button' ? (
          <Button
            aria-labelledby="delete-recording-label"
            loading={loading}
            loadingLabel="Deleting recording"
            onClick={onClick}
          >
            Delete
          </Button>
        ) : (
          <IconButton aria-labelledby="delete-recording-label" loading={loading} onClick={onClick}>
            <svg aria-hidden />
          </IconButton>
        )}
      </>
    );
    await render(fixture(false));
    const control = host.querySelector('button')!;
    await act(async () => control.focus());
    await render(fixture(true));
    expect(document.activeElement).toBe(control);
    expect(control).toHaveAccessibleName('Delete recording');
    expect(control).toHaveAttribute('aria-busy', 'true');
    await act(async () => control.click());
    expect(onClick).not.toHaveBeenCalled();
    const announcement = document.querySelector('[data-live-announcer] [role="img"]')!;
    expect(announcement).not.toBeNull();
    const expectedName = kind === 'button' ? 'Delete recording Deleting recording' : 'Delete recording';
    expect(announcement).toHaveAccessibleName(expectedName);
    await render(null);
    expect(document.getElementById('delete-recording-label')).toBeNull();
    expect(announcement).toHaveAccessibleName(expectedName);
  },
);

it('captures a referenced name before the initial browser delay and retains its urgency and cleanup', () => {
  vi.useFakeTimers();
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = environment.IS_REACT_ACT_ENVIRONMENT;
  const label = document.createElement('span');
  label.id = 'delayed-recording-label';
  label.setAttribute('aria-label', 'Recording saved');
  label.textContent = 'Visible copy';
  document.body.append(label);
  try {
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    announce({ 'aria-labelledby': label.id }, 'polite');
  } finally {
    environment.IS_REACT_ACT_ENVIRONMENT = previous;
    label.remove();
  }
  expect(document.querySelector('[data-live-announcer] [role="img"]')).toBeNull();
  vi.advanceTimersByTime(100);
  const log = document.querySelector('[data-live-announcer] [aria-live="polite"]')!;
  const announcement = log.querySelector('[role="img"]')!;
  expect(announcement).toHaveAccessibleName('Recording saved');
  expect(document.querySelector('[data-live-announcer] [aria-live="assertive"]')?.children).toHaveLength(0);
  vi.advanceTimersByTime(6999);
  expect(announcement.isConnected).toBe(true);
  vi.advanceTimersByTime(1);
  expect(announcement.isConnected).toBe(false);
});
