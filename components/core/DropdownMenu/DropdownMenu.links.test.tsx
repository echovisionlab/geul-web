// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider, RouterProvider } from 'react-aria-components';
import { describe, expect, it, vi } from 'vitest';
import { NavigationIntentProvider } from '../Navigation';
import { mockBrowserNavigation } from '../testing/browser-navigation';
import { DropdownMenu, type DropdownMenuItemProps } from './DropdownMenu';

const browserNavigation = mockBrowserNavigation();

function MenuLink({ disabled, ...props }: DropdownMenuItemProps) {
  return (
    <I18nProvider locale="en-US">
      <div data-testid="browser-navigation-boundary">
        <DropdownMenu defaultOpened portal={false}>
          <DropdownMenu.Target>
            <button type="button">Theme actions</button>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Item
              href="/themes/edit"
              disabled={disabled}
              selected
              title="Another default change is pending"
              {...props}
            >
              Edit
            </DropdownMenu.Item>
            <DropdownMenu.Item>Help</DropdownMenu.Item>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      </div>
    </I18nProvider>
  );
}

describe('DropdownMenu disabled links', () => {
  it('blocks pointer, keyboard and native activation without invoking navigation or closing the menu', async () => {
    const user = userEvent.setup();
    const navigate = vi.fn();
    const guard = vi.fn();
    const action = vi.fn();
    render(
      <RouterProvider navigate={navigate}>
        <NavigationIntentProvider onNavigationIntent={guard}>
          <MenuLink disabled onClick={action} />
        </NavigationIntentProvider>
      </RouterProvider>,
    );
    browserNavigation.attach(screen.getByTestId('browser-navigation-boundary'));
    await user.click(screen.getByRole('button', { name: 'Theme actions' }));
    await user.keyboard('{ArrowDown}');
    const item = screen.getByRole('menuitem', { name: 'Edit' });

    await user.click(item);
    fireEvent.keyDown(item, { key: 'Enter', code: 'Enter' });
    fireEvent.keyUp(item, { key: 'Enter', code: 'Enter' });
    fireEvent.keyDown(item, { key: ' ', code: 'Space' });
    fireEvent.keyUp(item, { key: ' ', code: 'Space' });
    fireEvent.click(item);

    expect(action).not.toHaveBeenCalled();
    expect(guard).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(browserNavigation.navigate).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeVisible();
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).not.toHaveAttribute('href');
    expect(item).toHaveAttribute('title', 'Another default change is pending');
    expect(item).toHaveAttribute('aria-current', 'true');

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Theme actions' })).toHaveFocus());
  });

  it.each([
    { name: 'modified click', props: {}, click: { ctrlKey: true } },
    { name: 'new tab', props: { target: '_blank', rel: 'noopener' }, click: {} },
    { name: 'download', props: { download: 'theme.json' }, click: {} },
    { name: 'external destination', props: { href: 'https://example.com/theme' }, click: {} },
  ])('removes the disabled native destination and restores $name behavior when enabled', ({ props, click }) => {
    const { rerender } = render(<MenuLink disabled {...props} />);
    const item = screen.getByRole('menuitem', { name: 'Edit' });
    browserNavigation.attach(item);
    fireEvent.click(item, click);
    expect(browserNavigation.navigate).not.toHaveBeenCalled();
    expect(item).not.toHaveAttribute('href');

    rerender(<MenuLink {...props} />);
    const enabled = screen.getByRole('menuitem', { name: 'Edit' });
    expect(enabled).toBe(item);
    expect(enabled).toHaveAttribute('href', props.href ?? '/themes/edit');
    expect(enabled).not.toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(enabled, click);
    expect(browserNavigation.navigate).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        href: props.href ?? 'http://localhost:3000/themes/edit',
        target: props.target ?? '',
        download: props.download ?? null,
        ctrlKey: 'ctrlKey' in click,
      }),
    );
  });

  it.each(['pointer', 'keyboard'] as const)(
    'restores ordinary %s routing and action after a focused link is disabled and re-enabled',
    async (activation) => {
      const user = userEvent.setup();
      const navigate = vi.fn();
      const guard = vi.fn();
      const action = vi.fn();
      const example = (disabled: boolean) => (
        <RouterProvider navigate={navigate}>
          <NavigationIntentProvider onNavigationIntent={guard}>
            <MenuLink disabled={disabled} onClick={action} />
          </NavigationIntentProvider>
        </RouterProvider>
      );
      const { rerender } = render(example(false));
      browserNavigation.attach(screen.getByTestId('browser-navigation-boundary'));
      await user.click(screen.getByRole('button', { name: 'Theme actions' }));
      await user.keyboard('{ArrowDown}');
      const item = screen.getByRole('menuitem', { name: 'Edit' });
      expect(item).toHaveFocus();

      rerender(example(true));
      expect(screen.getByRole('menuitem', { name: 'Edit' })).toBe(item);
      expect(screen.getByRole('menu')).toHaveFocus();
      await user.keyboard('{Enter}');
      fireEvent.click(item);
      expect(action).not.toHaveBeenCalled();
      expect(guard).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(browserNavigation.navigate).not.toHaveBeenCalled();

      rerender(example(false));
      await user.keyboard('{ArrowDown}');
      expect(item).toHaveFocus();
      expect(item).toHaveAttribute('href', '/themes/edit');
      if (activation === 'pointer') {
        await user.click(item);
      } else {
        await user.keyboard('{Enter}');
      }
      expect(action).toHaveBeenCalledOnce();
      expect(guard).toHaveBeenCalledExactlyOnceWith(
        { href: 'http://localhost:3000/themes/edit' },
        { preventDefault: expect.any(Function) },
      );
      expect(navigate).toHaveBeenCalledExactlyOnceWith('/themes/edit', undefined);
      expect(browserNavigation.navigate).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    },
  );
});
