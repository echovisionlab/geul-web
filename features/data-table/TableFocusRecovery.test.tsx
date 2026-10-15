// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { TableFocusRecovery } from './TableFocusRecovery';

let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render() {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <div data-datatable-root>
        <TableFocusRecovery />
        <input aria-label="Search posts" />
        <div data-datatable-desktop-row="one">
          <button type="button">Actions</button>
        </div>
        <button type="button" data-other>
          Other command
        </button>
      </div>,
    ),
  );
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
describe('table deletion focus recovery', () => {
  it('waits for the delete dialog to close before returning to the surviving search', async () => {
    render();
    host.querySelector<HTMLButtonElement>('[data-datatable-desktop-row] button')!.focus();
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const confirm = document.createElement('button');
    dialog.append(confirm);
    document.body.append(dialog);
    confirm.focus();
    host.querySelector('[data-datatable-desktop-row]')!.remove();
    await flush();
    expect(document.activeElement).toBe(confirm);
    dialog.remove();
    await flush();
    expect(document.activeElement).toBe(host.querySelector('input'));
  });
  it('preserves a user choosing another control after deletion', async () => {
    render();
    host.querySelector<HTMLButtonElement>('[data-datatable-desktop-row] button')!.focus();
    host.querySelector('[data-datatable-desktop-row]')!.remove();
    host.querySelector<HTMLButtonElement>('[data-other]')!.focus();
    await flush();
    expect(document.activeElement).toBe(host.querySelector('[data-other]'));
  });
  it('does not treat a row rerender with the same key as deletion', async () => {
    render();
    const row = host.querySelector('[data-datatable-desktop-row]')!;
    row.querySelector<HTMLButtonElement>('button')!.focus();
    row.innerHTML = '<button type="button">Refreshed actions</button>';
    await flush();
    expect(document.activeElement).not.toBe(host.querySelector('input'));
  });
});
