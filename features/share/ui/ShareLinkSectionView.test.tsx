// @vitest-environment jsdom
import { act, render as rtlRender, screen } from '@/test/render';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert } from '@/components/core/Alert';
import { ShareLinkSectionView, type ShareLinkSectionViewProps } from './ShareLinkSectionView';
import meta from './ShareLinkSectionView.stories';
let view: ReturnType<typeof rtlRender> | undefined;
afterEach(() => {
  view = undefined;
});
function render(props: Partial<ShareLinkSectionViewProps> = {}) {
  const element = <ShareLinkSectionView {...meta.args} {...props} />;
  if (view) {
    view.rerender(element);
  } else {
    view = rtlRender(element);
  }
}
describe('share link keyboard and target context', () => {
  it('moves focus into the opened form, exposes its relationship and returns focus after close', () => {
    render();
    const trigger = screen.getByRole('button', { name: 'New link' });
    expect(trigger).toHaveAccessibleName('New link');
    expect(trigger.textContent).toBe('');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    render({ formOpened: true });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const form = screen.getByRole('group', { name: 'New link' });
    expect(form).toHaveAttribute('id', trigger.getAttribute('aria-controls'));
    expect(form).toHaveAttribute('role', 'group');
    expect(form).toHaveAttribute('aria-label', 'New link');
    expect(screen.getByRole('textbox', { name: 'Label (optional)' })).toHaveFocus();
    render({ formOpened: false });
    expect(trigger).toHaveFocus();
    expect(trigger).not.toHaveAttribute('aria-controls');
  });
  it('keeps the compact icon creation command connected and preserves the permission boundary', () => {
    const toggle = vi.fn();
    render({ onToggleForm: toggle });
    const trigger = screen.getByRole('button', { name: 'New link' });
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
    const button = screen.getByRole('button', { name: 'Create' });
    expect(button).toBeDisabled();
    act(() => button.click());
    expect(create).not.toHaveBeenCalled();
    render({ formOpened: true, isCreating: true, onCreate: create });
    expect(screen.getByRole('group', { name: 'New link' })).toHaveAttribute('aria-busy', 'true');
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
    const copies = screen.getAllByRole('button', { name: meta.args.labels.copyAria });
    const deletes = screen.getAllByRole('button', { name: meta.args.labels.deleteAria });
    for (const [index, id] of ['one', 'two'].entries()) {
      expect(copies[index]).toHaveAccessibleDescription(
        new RegExp(`${index === 0 ? 'Review' : 'Archive'}.*https://studio.example.com/share/${id}`),
      );
      expect(deletes[index]).toHaveAttribute('aria-describedby', copies[index].getAttribute('aria-describedby'));
    }
    expect(copies[1]).toBeDisabled();
    expect(screen.getByRole('button', { name: meta.args.labels.openAria })).toBeDisabled();
    expect(screen.getByRole('link', { name: meta.args.labels.openAria })).toHaveAttribute(
      'href',
      'https://studio.example.com/share/one',
    );
  });
});

it('uses the shared loading surface and keeps failed initial reads distinct from an empty list', () => {
  render({ isLoading: true, links: [], totalLinkCount: 0 });
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  expect(screen.queryByText(meta.args.labels.noLinks)).not.toBeInTheDocument();
  render({
    links: [],
    totalLinkCount: 0,
    errorContent: (
      <Alert role="alert" tone="danger">
        List unavailable
      </Alert>
    ),
  });
  expect(screen.getByRole('alert')).toHaveTextContent('List unavailable');
  expect(screen.queryByText(meta.args.labels.noLinks)).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
