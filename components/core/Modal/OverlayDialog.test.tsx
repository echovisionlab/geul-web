// @vitest-environment jsdom
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OverlayDialog } from './OverlayDialog';
import { BlockingAlertDialog } from './BlockingAlertDialog';
import classes from '../Overlay.module.css';

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}
function outsidePress() {
  const backdrop = document.querySelector(`.${classes.backdrop}`)!;
  if (typeof PointerEvent !== 'undefined') {
    backdrop.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
    backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
  } else {
    backdrop.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    backdrop.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
  }
}
it.each([{ busy: true }, { dismissible: false }])(
  'locks Escape, outside press and close control for %j',
  async (policy) => {
    const close = vi.fn();
    await render(
      <OverlayDialog opened onClose={close} title="Save changes" closeLabel="Close" {...policy}>
        <button type="button">Inside</button>
      </OverlayDialog>,
    );
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog).toHaveAccessibleName('Save changes');
    expect(dialog).toHaveAttribute('data-close-policy', 'non-dismissible');
    expect(dialog.querySelector('[aria-label="Close"]')).toBeNull();
    await act(async () => {
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      outsidePress();
    });
    expect(close).not.toHaveBeenCalled();
  },
);
it('unlocks close and Escape after an owned operation settles', async () => {
  const close = vi.fn();
  const example = (busy: boolean) => (
    <OverlayDialog opened busy={busy} onClose={close} title="Save changes" closeLabel="Close">
      <button type="button">Inside</button>
    </OverlayDialog>
  );
  await render(example(true));
  await render(example(false));
  const dialog = document.querySelector('[role="dialog"]')!;
  await act(async () => dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(close).toHaveBeenCalledOnce();
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Close"]')!.click());
  expect(close).toHaveBeenCalledTimes(2);
});
it('dismisses an available modal through a completed outside press', async () => {
  const close = vi.fn();
  await render(
    <OverlayDialog opened onClose={close} title="Details" closeLabel="Close">
      <button type="button">Inside</button>
    </OverlayDialog>,
  );
  await act(async () => outsidePress());
  expect(close).toHaveBeenCalledOnce();
});
it('contains boundary Tab movement and restores focus to the actual opener after close', async () => {
  function Example() {
    const [opened, setOpened] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpened(true)}>
          Open details
        </button>
        <OverlayDialog opened={opened} onClose={() => setOpened(false)} title="Details" closeLabel="Close">
          <button type="button">Last</button>
        </OverlayDialog>
      </>
    );
  }
  await render(<Example />);
  const opener = host.querySelector<HTMLButtonElement>('button')!;
  await act(async () => opener.focus());
  expect(document.activeElement).toBe(opener);
  await act(async () => opener.click());
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const dialog = document.querySelector('[role="dialog"]')!;
  expect(dialog.contains(document.activeElement)).toBe(true);
  const buttons = [...dialog.querySelectorAll<HTMLButtonElement>('button')];
  await act(async () => {
    buttons.at(-1)!.focus();
    buttons.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  });
  expect(document.activeElement).toBe(buttons[0]);
  await act(async () => {
    buttons[0].dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }),
    );
  });
  expect(document.activeElement).toBe(buttons.at(-1));
  await act(async () => buttons[0].click());
  await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => new Promise<void>((resolve) => setTimeout(resolve, 50)));
  expect(document.activeElement).toBe(opener);
});
it('requires an active alertdialog message relationship', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() =>
    act(() =>
      root.render(
        <OverlayDialog opened onClose={() => {}} title="Alert" role="alertdialog" descriptionId=" ">
          <p>Message</p>
        </OverlayDialog>,
      ),
    ),
  ).toThrow(/descriptionId/);
});
it('gives the blocking alert its title, message, action and immutable dismissal policy', async () => {
  const action = vi.fn();
  await render(
    <BlockingAlertDialog
      opened
      title="Permission revoked"
      message="Return to a safe page."
      actionLabel="Continue"
      onAction={action}
    />,
  );
  const dialog = document.querySelector('[role="alertdialog"]')!;
  expect(dialog).toHaveAccessibleName('Permission revoked');
  expect(dialog).toHaveAccessibleDescription('Return to a safe page.');
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  const button = dialog.querySelector<HTMLButtonElement>('button')!;
  expect(document.activeElement).toBe(button);
  await act(async () => {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    outsidePress();
  });
  expect(action).not.toHaveBeenCalled();
  await act(async () => button.click());
  expect(action).toHaveBeenCalledOnce();
});
it('rejects a blank active blocking action name', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(() =>
    act(() =>
      root.render(<BlockingAlertDialog opened title="Attention" message="Read" actionLabel=" " onAction={() => {}} />),
    ),
  ).toThrow(/nonempty/);
});

it('makes an overflowing body a named keyboard target and removes the stop when it no longer scrolls', async () => {
  const observers: Array<{ targets: Set<Element>; update: () => void }> = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      targets = new Set<Element>();
      constructor(callback: () => void) {
        observers.push({ targets: this.targets, update: callback });
      }
      observe(target: Element) {
        this.targets.add(target);
      }
      unobserve(target: Element) {
        this.targets.delete(target);
      }
      disconnect() {
        this.targets.clear();
      }
    },
  );
  try {
    const view = (bodyLayout: 'scroll' | 'fit' = 'scroll') => (
      <OverlayDialog opened onClose={vi.fn()} title="History" closeLabel="Close history" bodyLayout={bodyLayout}>
        <p>History entries</p>
      </OverlayDialog>
    );
    await render(view());
    const dialog = document.querySelector('[role="dialog"]')!;
    const body = document.querySelector<HTMLDivElement>(`.${classes.body}`)!;
    expect(body).not.toHaveAttribute('tabindex');
    let contentHeight = 500;
    body.style.overflowX = 'auto';
    body.style.overflowY = 'auto';
    Object.defineProperties(body, {
      scrollHeight: { configurable: true, get: () => contentHeight },
      clientHeight: { configurable: true, get: () => 100 },
    });
    const observer = observers.find(({ targets }) => targets.has(body))!;
    await act(async () => observer.update());
    expect(body).toHaveAttribute('tabindex', '0');
    expect(body).toHaveAttribute('role', 'region');
    expect(body).toHaveAttribute('aria-labelledby', dialog.getAttribute('aria-labelledby'));
    expect(body).toHaveAccessibleName('History');
    await act(async () => body.focus());
    expect(document.activeElement).toBe(body);
    for (const key of ['ArrowDown', 'PageDown', 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      await act(async () => body.dispatchEvent(event));
      expect(event.defaultPrevented).toBe(false);
    }
    contentHeight = 80;
    await act(async () => observer.update());
    expect(body).not.toHaveAttribute('tabindex');
    expect(body).not.toHaveAttribute('role');
    contentHeight = 500;
    body.style.overflowX = 'hidden';
    body.style.overflowY = 'hidden';
    await act(async () => observer.update());
    expect(body).not.toHaveAttribute('tabindex');
    body.style.overflowX = 'auto';
    body.style.overflowY = 'auto';
    await render(view('fit'));
    expect(body).not.toHaveAttribute('tabindex');
    expect(body).not.toHaveAttribute('aria-labelledby');
  } finally {
    vi.unstubAllGlobals();
  }
});

it('updates keyboard scroll access when content changes without resizing the body viewport', async () => {
  let contentHeight = 80;
  const view = (message: string) => (
    <OverlayDialog opened onClose={vi.fn()} title="Activity" closeLabel="Close activity">
      <p>{message}</p>
    </OverlayDialog>
  );
  await render(view('First entry'));
  const body = document.querySelector<HTMLDivElement>(`.${classes.body}`)!;
  body.style.overflowX = 'auto';
  body.style.overflowY = 'auto';
  Object.defineProperties(body, {
    scrollHeight: { configurable: true, get: () => contentHeight },
    clientHeight: { configurable: true, get: () => 100 },
  });
  expect(body).not.toHaveAttribute('tabindex');
  contentHeight = 500;
  await render(view('Additional entries have arrived'));
  expect(body).toHaveAttribute('tabindex', '0');
  expect(body).toHaveAccessibleName('Activity');
  contentHeight = 80;
  await render(view('Filtered to one entry'));
  expect(body).not.toHaveAttribute('tabindex');
});
