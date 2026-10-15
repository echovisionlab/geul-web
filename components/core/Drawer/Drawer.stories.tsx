import { useArgs } from 'storybook/preview-api';
import { Button } from '../Button';
import { Text as DsText } from '@/components/core/Typography';
import { LayoutStack as DsLayoutStack, LayoutInset as DsLayoutInset } from '@/components/core/Layout';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor } from 'storybook/test';

import { Spinner as Loader } from '@/components/core/Display';
import { Drawer } from './Drawer';
import { OnDemandDrawer } from './OnDemandDrawer';

const meta = {
  title: 'Core/Overlays/Drawer',
  component: Drawer,
  render: function OverlayPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <>
        {!args.opened && <Button onClick={() => updateArgs({ opened: true })}>{args.title}</Button>}
        <Drawer {...args} onClose={() => updateArgs({ opened: false })} />
      </>
    );
  },
  parameters: { layout: 'fullscreen' },
  args: {
    opened: true,
    onClose: () => {},
    title: 'Panel title',
    closeLabel: 'Close panel',
  },
} satisfies Meta<typeof Drawer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <DsText size="sm">Drawer content supplied by the owning feature.</DsText>,
  },
};

export const RightPlacement: Story = {
  args: {
    placement: 'right',
    size: 'compact',
    title: 'Version history',
    closeLabel: 'Close version history',
    children: <DsText size="sm">A compact panel anchored to the right edge.</DsText>,
  },
};

export const LeftPlacement: Story = {
  args: {
    placement: 'left',
    size: 'standard',
    title: 'Navigation',
    closeLabel: 'Close navigation',
    children: <DsText size="sm">A standard panel anchored to the left edge.</DsText>,
  },
};

export const LongContent: Story = {
  play: async ({ canvasElement }) => {
    const dialog = await waitFor(() => {
      const surface = canvasElement.ownerDocument.querySelector<HTMLElement>('[role="dialog"]');
      expect(surface).not.toBeNull();
      return surface!;
    });
    const close = dialog.querySelector<HTMLButtonElement>('button')!;
    await waitFor(() => expect(close).toBeVisible());
    const panel = dialog.closest<HTMLElement>('[data-body-layout]')!;
    const header = dialog.firstElementChild as HTMLElement;
    const body = dialog.lastElementChild as HTMLElement;
    expect(panel).toHaveAttribute('data-density', 'compact');
    expect(getComputedStyle(panel).overflow).toBe('hidden');
    expect(getComputedStyle(body).overflow).toBe('auto');
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    await waitFor(() => expect(body).toHaveAttribute('tabindex', '0'));
    expect(body).toHaveAttribute('role', 'region');
    expect(body).toHaveAttribute('aria-labelledby', dialog.getAttribute('aria-labelledby'));
    close.focus();
    await userEvent.tab();
    expect(body).toHaveFocus();
    const before = header.getBoundingClientRect().top;
    body.scrollTop = body.scrollHeight;
    await waitFor(() => expect(body.scrollTop).toBeGreaterThan(0));
    expect(Math.abs(header.getBoundingClientRect().top - before)).toBeLessThan(1);
    expect(close).toBeVisible();
    const headerBounds = header.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const closeBounds = close.getBoundingClientRect();
    expect(closeBounds.top).toBeGreaterThanOrEqual(headerBounds.top);
    expect(closeBounds.bottom).toBeLessThanOrEqual(headerBounds.bottom);
    expect(closeBounds.left).toBeGreaterThanOrEqual(panelBounds.left);
    expect(closeBounds.right).toBeLessThanOrEqual(panelBounds.right);
  },
  args: {
    placement: 'right',
    size: 'standard',
    title: 'Activity',
    closeLabel: 'Close activity',
    children: (
      <DsLayoutStack gap="md">
        {Array.from({ length: 60 }, (_, index) => (
          <DsText key={index} size="sm">
            Activity item {index + 1}
          </DsText>
        ))}
      </DsLayoutStack>
    ),
  },
};

export const LoadingNonDismissible: Story = {
  args: {
    loading: true,
    closePolicy: 'non-dismissible',
    title: 'Publishing changes',
    closeLabel: 'Close publishing status',
    children: (
      <DsLayoutInset block="xl">
        <DsLayoutStack align="center">
          <Loader size="sm" />
          <DsText size="sm">Publishing changes...</DsText>
        </DsLayoutStack>
      </DsLayoutInset>
    ),
  },
};

export const NarrowMobile: Story = {
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: {
    placement: 'bottom',
    size: 'large',
    title: 'Block settings',
    closeLabel: 'Close block settings',
    children: (
      <DsLayoutStack gap="sm">
        <DsText size="sm">Settings remain usable in a narrow viewport.</DsText>
        <DsText size="sm">The large bottom preset preserves the mobile editing area.</DsText>
      </DsLayoutStack>
    ),
  },
};

export const StandardDensity: Story = {
  args: { density: 'standard', children: <DsText size="sm">Standard dialog spacing.</DsText> },
};
export const PhoneLongContent: Story = {
  ...LongContent,
  globals: { viewport: { value: 'phone', isRotated: false } },
  args: { ...LongContent.args, placement: 'bottom', size: 'large' },
};

/**
 * `OnDemandDrawer` (used by the site navigation and account drawers): same props; a closed drawer
 * renders nothing and its surface loads on first open or trigger hover/focus. Storybook preloads it.
 */
export const OnDemandSiteDrawer: Story = {
  render: function OnDemandDrawerPreview(args) {
    const [, updateArgs] = useArgs();
    return (
      <>
        {!args.opened && <Button onClick={() => updateArgs({ opened: true })}>{args.title}</Button>}
        <OnDemandDrawer {...args} onClose={() => updateArgs({ opened: false })} />
      </>
    );
  },
  args: {
    placement: 'left',
    size: 'compact',
    title: 'Site navigation',
    closeLabel: 'Close navigation',
    children: <DsText size="sm">Navigation links supplied by the shell.</DsText>,
  },
};
