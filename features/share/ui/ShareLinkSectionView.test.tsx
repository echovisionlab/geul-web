// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TestProviders } from '@/test/TestProviders';
import { ShareLinkSectionView, type ShareLinkSectionViewProps } from './ShareLinkSectionView';
import meta from './ShareLinkSectionView.stories';

let host: HTMLDivElement;
let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function render(props: Partial<ShareLinkSectionViewProps> = {}) {
  if (!host?.isConnected) {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
  }
  act(() =>
    root.render(
      <TestProviders>
        <ShareLinkSectionView {...meta.args} {...props} />
      </TestProviders>,
    ),
  );
}
describe('share link keyboard and target context', () => {
  it('moves focus into the opened form, exposes its relationship and returns focus after close', () => {
    render();
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="New link"]')!;
    expect(trigger).toHaveAccessibleName('New link');
    expect(trigger.textContent).toBe('');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    render({ formOpened: true });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const form = document.getElementById(trigger.getAttribute('aria-controls')!);
    expect(form).toHaveAttribute('role', 'group');
    expect(form).toHaveAttribute('aria-label', 'New link');
    expect(document.activeElement).toBe(form?.querySelector('input'));
    render({ formOpened: false });
    expect(document.activeElement).toBe(trigger);
    expect(trigger).not.toHaveAttribute('aria-controls');
  });
  it('keeps the compact icon creation command connected and preserves the permission boundary', () => {
    const toggle = vi.fn();
    render({ onToggleForm: toggle });
    const trigger = host.querySelector<HTMLButtonElement>('button[aria-label="New link"]')!;
    act(() => trigger.click());
    expect(toggle).toHaveBeenCalledOnce();
    render({ onToggleForm: toggle, disabled: true });
    expect(trigger).toBeDisabled();
    act(() => trigger.click());
    expect(toggle).toHaveBeenCalledOnce();
  });
  it('retains the custom-date creation guard and pending form state in compact composition', () => {
    const create = vi.fn();
    render({ formOpened: true, preset: 'custom', customDateTimestamp: null, onCreate: create });
    const button = Array.from(host.querySelectorAll<HTMLButtonElement>('button')).find(
      (element) => element.textContent === 'Create',
    )!;
    expect(button).toBeDisabled();
    act(() => button.click());
    expect(create).not.toHaveBeenCalled();
    render({ formOpened: true, isCreating: true, onCreate: create });
    expect(host.querySelector('[role="group"][aria-label="New link"]')).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    act(() => button.click());
    expect(create).not.toHaveBeenCalled();
  });
  it('keeps repeated command names concise and describes each actual target, including expired links', () => {
    render({
      links: [
        meta.args.links[0],
        {
          ...meta.args.links[0],
          id: 'two',
          label: 'Archive',
          displayUrl: 'https://studio.example.com/share/two',
          openUrl: null,
          expired: true,
        },
      ],
      totalLinkCount: 2,
    });
    for (const id of ['one', 'two']) {
      const copy = host.querySelector(`[data-testid="share-link-copy-${id}"]`)!;
      const context = document.getElementById(copy.getAttribute('aria-describedby')!);
      expect(copy).toHaveAttribute('aria-label', meta.args.labels.copyAria);
      expect(context).toHaveTextContent(id === 'one' ? 'Review' : 'Archive');
      expect(context).toHaveTextContent(`https://studio.example.com/share/${id}`);
      expect(host.querySelector(`[data-testid="share-link-delete-${id}"]`)).toHaveAttribute(
        'aria-describedby',
        context!.id,
      );
    }
    expect(host.querySelector('[data-testid="share-link-copy-two"]')).toBeDisabled();
    expect(host.querySelector('[data-testid="share-link-open-two"]')).toBeDisabled();
    expect(host.querySelector('[data-testid="share-link-open-one"]')).toHaveAttribute(
      'href',
      'https://studio.example.com/share/one',
    );
  });
});
