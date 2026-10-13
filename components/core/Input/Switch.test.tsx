// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { I18nProvider } from 'react-aria-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Switch } from './Switch';

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(node: React.ReactNode) {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<I18nProvider locale="en-US">{node}</I18nProvider>));
}
function pressLabel() {
  const label = host.querySelector('label')!;
  act(() => {
    label.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, detail: 1 }));
    label.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0, detail: 1 }));
    label.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0, detail: 1 }));
  });
}
describe('Core Switch event adapter', () => {
  it('connects its existing guidance and error copy to the actual switch input', () => {
    render(<Switch label="Public" description="Allow visitors" error="Permission denied" required />);
    const input = host.querySelector('input')!;
    expect(input).toHaveAccessibleName('Public');
    expect(input).toHaveAccessibleDescription('Allow visitors Permission denied');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(host.querySelector('label')).not.toHaveAttribute('aria-required');
    expect(host.querySelector('label')).not.toHaveAttribute('aria-invalid');
    act(() =>
      root.render(
        <I18nProvider locale="en-US">
          <Switch label="Public" />
        </I18nProvider>,
      ),
    );
    expect(input).not.toHaveAttribute('aria-required');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('delivers the new checked value once for a pointer press on the label', () => {
    const changed = vi.fn();
    function Controlled() {
      const [checked, setChecked] = useState(true);
      return (
        <Switch
          label="Active"
          checked={checked}
          onChange={(event) => {
            changed(event.currentTarget.checked);
            setChecked(event.currentTarget.checked);
          }}
        />
      );
    }
    render(<Controlled />);
    pressLabel();
    expect(changed.mock.calls).toEqual([[false]]);
    expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(false);
    pressLabel();
    expect(changed.mock.calls).toEqual([[false], [true]]);
  });
  it('delivers native input changes without duplicating callbacks', () => {
    const changed = vi.fn();
    render(<Switch label="Active" onChange={(event) => changed(event.currentTarget.checked)} />);
    act(() => host.querySelector<HTMLInputElement>('input')!.click());
    expect(changed.mock.calls).toEqual([[true]]);
  });
  it.each(['disabled', 'readOnly'] as const)('preserves %s controls when their label is pressed', (state) => {
    const changed = vi.fn();
    render(<Switch label="Active" checked onChange={changed} {...{ [state]: true }} />);
    pressLabel();
    expect(changed).not.toHaveBeenCalled();
    expect(host.querySelector<HTMLInputElement>('input')?.checked).toBe(true);
  });
});
