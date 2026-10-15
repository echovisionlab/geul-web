// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolbarCommand, type ToolbarCommandProps } from './ToolbarCommand';
const media = vi.hoisted(() => ({ mobile: false, touch: false }));
vi.mock('@mantine/hooks', () => ({
  useMediaQuery: (query: string) => (query === '(any-pointer: coarse)' ? media.touch : media.mobile),
}));
afterEach(() => {
  media.mobile = false;
  media.touch = false;
});
describe('ToolbarCommand', () => {
  it('switches only presentation at mobile widths and preserves accessible names and activation', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const click = vi.fn();
    const command = (
      <ToolbarCommand presentation="responsive" label="Edit translation" icon={<svg />} onClick={click} />
    );
    media.mobile = false;
    await act(async () => root.render(command));
    expect(host.querySelector('button')?.textContent).toBe('Edit translation');
    media.mobile = true;
    await act(async () =>
      root.render(<ToolbarCommand presentation="responsive" label="Edit translation" icon={<svg />} onClick={click} />),
    );
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBe('Edit translation');
    expect(button.dataset.controlSize).toBe('xs');
    await act(async () => button.click());
    expect(click).toHaveBeenCalledOnce();
    await act(async () =>
      root.render(
        <ToolbarCommand presentation="icon" label="Edit translation" icon={<svg />} onClick={click} disabled />,
      ),
    );
    await act(async () => host.querySelector('button')!.click());
    expect(click).toHaveBeenCalledOnce();
    await act(async () => root.unmount());
    host.remove();
  });
  it('projects native props without leaking style or changing the owned size', async () => {
    const host = document.createElement('div');
    const root = createRoot(host);
    const hostile = {
      style: { padding: 900 },
      className: 'foreign',
      size: 'xl',
      rightSection: <span>Foreign</span>,
    } as unknown as ToolbarCommandProps;
    await act(async () => root.render(<ToolbarCommand {...hostile} label="Edit" />));
    const button = host.querySelector('button')!;
    expect(button.style.padding).toBe('');
    expect(button.classList.contains('foreign')).toBe(false);
    expect(button.dataset.controlSize).toBe('xs');
    expect(button.textContent).toBe('Edit');
    await act(async () => root.unmount());
  });

  it('retains a long visible label on touch at mobile widths', async () => {
    media.mobile = true;
    media.touch = true;
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const label = 'Review this publication and all translated content';
    await act(async () => root.render(<ToolbarCommand label={label} presentation="responsive" icon={<svg />} />));
    const button = host.querySelector('button')!;
    expect(button.textContent).toBe(label);
    expect(button.getAttribute('aria-label')).toBe(label);
    expect(button.dataset.labelWrap).toBe('wrap');
    expect(button.dataset.controlSize).toBe('xs');
    await act(async () => root.unmount());
    host.remove();
  });

  it('keeps pending commands named and prevents duplicate activation', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const click = vi.fn();
    await act(async () => root.render(<ToolbarCommand label="Save translation" loading onClick={click} />));
    const button = host.querySelector('button')!;
    expect(button.getAttribute('aria-label')).toBe('Save translation');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.dataset.pending).toBe('true');
    await act(async () => button.click());
    expect(click).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    host.remove();
  });

  it('owns toggle semantics and appearance in both presentations', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const unsafe = { tone: 'accent', emphasis: 'strong' } as unknown as { tone?: never; emphasis?: never };
    await act(async () =>
      root.render(<ToolbarCommand {...unsafe} label="Bold" presentation="icon" icon={<svg />} pressed />),
    );
    let button = host.querySelector('button')!;
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.dataset.tone).toBe('neutral');
    expect(button.dataset.emphasis).toBe('low');
    await act(async () => root.render(<ToolbarCommand {...unsafe} label="Bold" pressed={false} />));
    button = host.querySelector('button')!;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.dataset.tone).toBe('neutral');
    expect(button.textContent).toBe('Bold');
    await act(async () => root.unmount());
    host.remove();
  });
});
