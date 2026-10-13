import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor } from 'storybook/test';
import { LayoutStack } from '../Layout';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { Button } from '../Button';
import { Text } from '../Typography';
import { ContentModal } from './ContentModal';
const meta: Meta<typeof ContentModal> = {
  title: 'Core/Overlays/ContentModal',
  component: ContentModal,
  parameters: { layout: 'centered' },
  args: {
    opened: true,
    onClose: () => {},
    id: 'audio-ingest-dialog',
    title: 'Add audio',
    closeLabel: 'Close dialog',
    centered: true,
    size: 'large',
    children: <Text size="sm">Upload a local file or import a direct audio file URL.</Text>,
  },
  render: localizedRender((args) => {
    const [opened, setOpened] = useState(args.opened);
    useEffect(() => setOpened(args.opened), [args.opened]);
    return (
      <>
        {!opened && <Button onClick={() => setOpened(true)}>{args.title}</Button>}
        <ContentModal {...args} opened={opened} onClose={() => setOpened(false)} />
      </>
    );
  }),
};
export default meta;
type Story = StoryObj<typeof ContentModal>;
export const Content: Story = {};
export const Compact: Story = { args: { size: 'compact', density: 'compact' } };

export const StandardDensity: Story = { args: { density: 'standard' } };
export const LongContent: Story = {
  args: {
    title: 'Long content',
    size: 'standard',
    children: (
      <LayoutStack gap="sm">
        {Array.from({ length: 60 }, (_, index) => (
          <Text key={index} size="sm">
            Review row {index + 1}
          </Text>
        ))}
      </LayoutStack>
    ),
  },
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
    expect(panel.getBoundingClientRect().bottom).toBeLessThanOrEqual(
      canvasElement.ownerDocument.defaultView!.innerHeight,
    );
    expect(close).toBeVisible();
    const headerBounds = header.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    const closeBounds = close.getBoundingClientRect();
    expect(closeBounds.top).toBeGreaterThanOrEqual(headerBounds.top);
    expect(closeBounds.bottom).toBeLessThanOrEqual(headerBounds.bottom);
    expect(closeBounds.left).toBeGreaterThanOrEqual(panelBounds.left);
    expect(closeBounds.right).toBeLessThanOrEqual(panelBounds.right);
  },
};
export const PhoneLongContent: Story = {
  ...LongContent,
  globals: { viewport: { value: 'phone', isRotated: false } },
};
