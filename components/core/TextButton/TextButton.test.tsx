// @vitest-environment jsdom

import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@/test/render';
import { mockBrowserNavigation } from '../testing/browser-navigation';
import { DropdownMenu } from '../DropdownMenu';
import { TextButton } from './TextButton';

const browserNavigation = mockBrowserNavigation();

describe('TextButton', () => {
  it('retains descriptions on actions and links without changing their names', () => {
    render(
      <>
        <span id="control-help" hidden>
          Opens preferences
        </span>
        <TextButton aria-description="Cookie settings" aria-describedby="control-help">
          Settings
        </TextButton>
        <TextButton href="/terms" aria-description="Current terms">
          Terms
        </TextButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAccessibleDescription(
      'Opens preferences Cookie settings',
    );
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAccessibleDescription('Current terms');
  });

  it('preserves native button type and disabled behavior', async () => {
    const onClick = vi.fn();
    const { user } = render(
      <TextButton type="submit" appearance="accent" disabled onClick={onClick}>
        Submit
      </TextButton>,
    );
    const button = screen.getByRole('button', { name: 'Submit' });
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('forwards native anchor props and refs', () => {
    const ref = createRef<HTMLAnchorElement>();
    render(
      <TextButton
        ref={ref}
        href="/about"
        prefetch={false}
        target="_blank"
        rel="noopener"
        download="about.txt"
        aria-current="page"
        appearance="accent"
      >
        About
      </TextButton>,
    );
    const link = screen.getByRole('link', { name: 'About' });
    expect(link).toBe(ref.current);
    expect(link).toHaveAttribute('href', '/about');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener');
    expect(link).toHaveAttribute('download', 'about.txt');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).toHaveAttribute('data-appearance', 'accent');
  });

  it('keeps navigation native for Space and runs the callback on activation', async () => {
    const onNavigate = vi.fn();
    const { user, container } = render(
      <TextButton href="#target" onNavigate={onNavigate}>
        Target
      </TextButton>,
    );
    browserNavigation.attach(container);
    await user.tab();
    await user.keyboard(' ');
    expect(onNavigate).not.toHaveBeenCalled();
    await user.click(screen.getByRole('link', { name: 'Target' }));
    expect(onNavigate).toHaveBeenCalledWith('#target');
  });

  it('distinguishes current navigation, toggle state and selected ancestry', () => {
    const { rerender } = render(
      <TextButton href="#current" selected aria-current="page">
        Current
      </TextButton>,
    );
    const link = screen.getByRole('link', { name: 'Current' });
    expect(link).toHaveAttribute('data-selected', 'true');
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).not.toHaveAttribute('aria-pressed');
    rerender(
      <TextButton selected aria-haspopup="menu" aria-expanded={false}>
        Section
      </TextButton>,
    );
    expect(screen.getByRole('button', { name: 'Section' })).not.toHaveAttribute('aria-pressed');
    expect(screen.getByRole('button', { name: 'Section' })).toHaveAttribute('aria-expanded', 'false');
    rerender(<TextButton aria-pressed>Bold</TextButton>);
    expect(screen.getByRole('button', { name: 'Bold' })).toHaveAttribute('aria-pressed', 'true');
  });

  it.each([false, true])('retains a long menu name and trigger semantics with nowrap=%s', async (nowrap) => {
    const name = 'Language and regional formatting preferences';
    const { user } = render(
      <DropdownMenu portal={false}>
        <DropdownMenu.Target>
          <TextButton indicator="menu" fullWidth display="flex" nowrap={nowrap}>
            {name}
          </TextButton>
        </DropdownMenu.Target>
        <DropdownMenu.Dropdown>
          <DropdownMenu.Item>English</DropdownMenu.Item>
        </DropdownMenu.Dropdown>
      </DropdownMenu>,
    );
    const button = screen.getByRole('button', { name });
    expect(button.hasAttribute('data-nowrap')).toBe(nowrap);
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await user.click(button);
    expect(await screen.findByRole('menu')).toBeVisible();
    expect(button).toHaveAccessibleName(name);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('forwards native advisory text on actions and links', () => {
    render(
      <>
        <TextButton title="Opens preferences">Settings</TextButton>
        <TextButton href="/help" title="Opens help">
          Help
        </TextButton>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Settings' })).toHaveAttribute('title', 'Opens preferences');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('title', 'Opens help');
  });

  it.each([
    { nameProps: {}, name: 'Save preferences', progressName: 'Save preferences' },
    {
      nameProps: { 'aria-label': 'Save cookie preferences', loadingLabel: 'Saving preferences' },
      name: 'Save cookie preferences',
      progressName: 'Saving preferences',
    },
    { nameProps: { 'aria-labelledby': 'save-name' }, name: 'Save settings', progressName: 'Save settings' },
  ])(
    'keeps the pending command name and blocks repeated activation: $name',
    async ({ nameProps, name, progressName }) => {
      const onClick = vi.fn();
      const example = (loading: boolean) => (
        <>
          <span id="save-name">Save settings</span>
          <TextButton {...nameProps} loading={loading} onClick={onClick}>
            Save preferences
          </TextButton>
        </>
      );
      const { user, rerender } = render(example(false));
      const button = screen.getByRole('button', { name });
      await user.tab();
      rerender(example(true));
      expect(button).toHaveFocus();
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(button).toHaveTextContent('Save preferences');
      expect(screen.getByRole('progressbar', { name: progressName })).toBeVisible();
      expect(button).toHaveAccessibleName(name);
      await user.keyboard('{Enter} ');
      await user.click(button);
      act(() => button.click());
      expect(onClick).not.toHaveBeenCalled();
      rerender(example(false));
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      await user.keyboard('{Enter}');
      expect(onClick).toHaveBeenCalledOnce();
    },
  );

  it.each(['submit', 'reset'] as const)('blocks native %s while pending and restores it afterwards', async (type) => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onReset = vi.fn();
    const example = (loading: boolean) => (
      <form onSubmit={onSubmit} onReset={onReset}>
        <TextButton type={type} loading={loading}>
          Apply
        </TextButton>
      </form>
    );
    const { user, rerender } = render(example(true));
    const button = screen.getByRole('button', { name: 'Apply' });
    await user.click(button);
    act(() => button.click());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onReset).not.toHaveBeenCalled();
    rerender(example(false));
    await user.click(button);
    expect(type === 'submit' ? onSubmit : onReset).toHaveBeenCalledOnce();
  });
});
