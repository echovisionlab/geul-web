// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ParameterPanel, type ParameterPanelProps } from './ParameterPanel';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
function render(props: ParameterPanelProps) {
  act(() => root.render(<ParameterPanel {...props} />));
}
describe('ParameterPanel Core contract', () => {
  it('uses actual common inputs and dispatches domain actions without initial replay', () => {
    const change = vi.fn();
    const action = vi.fn();
    render({
      title: 'Settings',
      model: {
        Enabled: { kind: 'checkbox', value: false, onChange: change },
        Reset: { kind: 'action', onAction: action },
      },
    });
    expect(change).not.toHaveBeenCalled();
    const checkbox = host.querySelector<HTMLInputElement>('input[type=checkbox]')!;
    act(() => checkbox.click());
    expect(change).toHaveBeenCalledWith(true);
    const reset = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Reset')!;
    act(() => reset.click());
    expect(action).toHaveBeenCalledOnce();
  });
  it('dispatches numeric camera changes through the Core step control and reconciles external values', () => {
    const change = vi.fn();
    const props = { title: 'Settings', model: { Zoom: { kind: 'number' as const, value: 12, onEditEnd: change } } };
    render(props);
    const increment = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === '+')!;
    act(() => increment.click());
    expect(change).toHaveBeenCalledWith(13);
    change.mockClear();
    render({ ...props, model: { Zoom: { kind: 'number', value: 15, onEditEnd: change } } });
    expect(host.querySelector<HTMLInputElement>('input')!.value).toBe('15');
    expect(change).not.toHaveBeenCalled();
  });
  it('copies the authored RGBA including alpha through a labelled Core action', () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render({
      title: 'Settings',
      copyLabel: (label) => `Copy ${label}`,
      model: { Water: { kind: 'color', value: { r: 17, g: 34, b: 51, a: 0.5 } } },
    });
    const button = host.querySelector<HTMLButtonElement>('button[aria-label="Copy Water"]')!;
    act(() => button.click());
    expect(writeText).toHaveBeenCalledWith('rgba(17, 34, 51, 0.5)');
  });
  it('projects styling escape props out of the runtime boundary', () => {
    render({
      title: 'Settings',
      model: {},
      style: { background: 'red' },
      className: 'foreign',
    } as unknown as ParameterPanelProps);
    const panel = host.querySelector('[data-geul-parameter-placement]') as HTMLElement;
    expect(panel.style.cssText).toBe('');
    expect(panel.className).not.toContain('foreign');
  });
  it('fails closed for an unregistered schema control', () => {
    expect(() =>
      render({ title: 'Settings', model: { Wrong: { kind: 'slider', value: 1 } } } as unknown as ParameterPanelProps),
    ).toThrow('Unknown parameter kind');
  });
});
