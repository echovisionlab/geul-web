// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { userEvent, waitFor, within } from 'storybook/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { SocialLinkInputView, type SocialLinkInputViewProps } from './SocialLinkInputView';

let host: HTMLDivElement;
let root: Root;
const observers: { callback: ResizeObserverCallback; target?: Element; instance: ResizeObserver }[] = [];
beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class implements ResizeObserver {
      record: (typeof observers)[number];
      constructor(callback: ResizeObserverCallback) {
        this.record = { callback, instance: this };
        observers.push(this.record);
      }
      observe(target: Element) {
        this.record.target = target;
      }
      unobserve() {}
      disconnect() {}
    },
  );
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});
function render(overrides: Partial<SocialLinkInputViewProps> = {}) {
  const props: SocialLinkInputViewProps = {
    platform: 'github',
    value: 'https://github.com/monome',
    platformOptions: [
      { value: 'github', label: 'GitHub' },
      { value: 'bandcamp', label: 'Bandcamp' },
    ],
    selectedPlatform: 'github',
    selectedValuePlaceholder: 'https://github.com/username',
    labels: { platformPlaceholder: 'Platform', valuePlaceholder: 'URL', remove: 'Remove' },
    platformId: 'social-platform',
    valueId: 'social-url',
    onPlatformChange: vi.fn(),
    onValueChange: vi.fn(),
    onValueBlur: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  act(() =>
    root.render(
      <TestProviders>
        <SocialLinkInputView {...props} />
      </TestProviders>,
    ),
  );
  return props;
}
describe('responsive social platform picker', () => {
  it('names the URL with its selected platform and keeps editing, blur and removal callbacks', async () => {
    const props = render();
    const input = host.querySelector<HTMLInputElement>('#social-url')!;
    expect(input).toHaveAccessibleName('GitHub: URL');
    await userEvent.type(input, '/edit');
    expect(props.onValueChange).toHaveBeenCalled();
    await userEvent.tab();
    expect(props.onValueBlur).toHaveBeenCalled();
    act(() => within(host).getByRole('button', { name: 'Remove' }).click());
    expect(props.onRemove).toHaveBeenCalledOnce();
  });
  it('opens a named icon picker with searchable options, selects a platform and restores trigger focus', async () => {
    const props = render();
    const trigger = host.querySelector<HTMLButtonElement>('#social-platform-picker')!;
    expect(trigger).toHaveAccessibleName('Platform: GitHub');
    expect(trigger.textContent).toBe('');
    await userEvent.click(trigger);
    const dialog = within(document.body).getByRole('dialog', { name: 'Platform: GitHub' });
    const search = within(dialog).getByRole('combobox', { name: 'Platform' });
    expect(search).toHaveFocus();
    await userEvent.clear(search);
    await userEvent.type(search, 'Bandcamp');
    const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const option = within(document.body).getByRole('option', { name: 'Bandcamp' });
    await userEvent.click(option);
    expect(props.onPlatformChange).toHaveBeenCalledWith('bandcamp');
    expect(dialog).not.toBeInTheDocument();
    // React Aria restores trigger focus on the next animation frame.
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(host.querySelector('#social-url')).toHaveValue('https://github.com/monome');
  });
  it('dismisses nested search before the picker and keeps permission changes effective', async () => {
    render();
    const trigger = host.querySelector<HTMLButtonElement>('#social-platform-picker')!;
    await userEvent.click(trigger);
    await userEvent.keyboard('{ArrowDown}');
    expect(within(document.body).getByRole('listbox')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(within(document.body).queryByRole('listbox')).not.toBeInTheDocument();
    expect(within(document.body).getByRole('dialog', { name: 'Platform: GitHub' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
    // The focus restoration also updates the trigger's React Aria focus state.
    await waitFor(() => expect(trigger).toHaveFocus());
    await userEvent.click(trigger);
    render({ disabled: true });
    // Closing the picker restores focus on the next frame.
    await act(async () => {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toBeDisabled();
    expect(host.querySelector('#social-url')).toBeDisabled();
    expect(within(host).getByRole('button', { name: 'Remove' })).toBeDisabled();
  });
  it('closes the compact popup and focuses the full picker when the row becomes wider', async () => {
    render();
    const trigger = host.querySelector<HTMLButtonElement>('#social-platform-picker')!;
    await userEvent.click(trigger);
    const compactWrapper = trigger.closest('div')!;
    const observer = observers.find((entry) => entry.target === host.firstElementChild)!;
    expect(observer).toBeDefined();
    compactWrapper.style.display = 'none';
    act(() => observer.callback([], observer.instance));
    expect(within(document.body).queryByRole('dialog')).not.toBeInTheDocument();
    // The responsive focus hand-off is scheduled with requestAnimationFrame.
    await waitFor(() => expect(host.querySelector('#social-platform')).toHaveFocus());
    expect(host.querySelector('#social-url')).toHaveValue('https://github.com/monome');
  });
});
