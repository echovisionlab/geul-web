import { Fragment, useEffect, useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { expect, userEvent, within } from 'storybook/test';
import { ResizeHandle, type ResizeHandlePlacement, type ResizeHandleVisibility } from './ResizeHandle';

const mediaKinds = ['image', 'audio', 'video', 'file'] as const;

function ResizableMedia({
  kind,
  placement,
  visibility,
}: {
  kind: (typeof mediaKinds)[number];
  placement: ResizeHandlePlacement;
  visibility: ResizeHandleVisibility;
}) {
  const labels = useTranslations('common.labels');
  const resize = useTranslations('editorCommon.editor.runtimeLabels.p5');
  const [width, setWidth] = useState(64);
  const cleanupRef = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanupRef.current?.(), []);
  const clamp = (value: number) => Math.max(10, Math.min(100, value));
  return (
    <div
      data-resize-preview
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: `${width}%`,
        marginBottom: 'var(--geul-spacing-lg)',
      }}
    >
      {(['left', 'right'] as const).map((direction) => (
        <Fragment key={direction}>
          <ResizeHandle
            placement={placement}
            visibility={visibility}
            direction={direction}
            value={width}
            min={10}
            max={100}
            ariaLabel={`${labels(kind)}: ${resize(direction === 'left' ? 'resizeLeft' : 'resizeRight')}`}
            onPointerDown={(event) => {
              event.preventDefault();
              cleanupRef.current?.();
              event.currentTarget.focus();
              const pointerId = event.pointerId;
              const start = event.clientX;
              const availableWidth = event.currentTarget.parentElement?.parentElement?.clientWidth ?? 1;
              const move = (pointer: PointerEvent) => {
                if (pointer.pointerId !== pointerId) {
                  return;
                }
                setWidth(
                  clamp(width + ((pointer.clientX - start) / availableWidth) * 100 * (direction === 'right' ? 1 : -1)),
                );
              };
              const stop = () => {
                window.removeEventListener('pointermove', move);
                window.removeEventListener('pointerup', stop);
                window.removeEventListener('pointercancel', stop);
                cleanupRef.current = null;
              };
              cleanupRef.current = stop;
              window.addEventListener('pointermove', move);
              window.addEventListener('pointerup', stop);
              window.addEventListener('pointercancel', stop);
            }}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                return;
              }
              event.preventDefault();
              setWidth((value) =>
                event.key === 'Home'
                  ? 10
                  : event.key === 'End'
                    ? 100
                    : clamp(value + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1)),
              );
            }}
          />
          {direction === 'left' && (
            <div style={{ flex: 1, minHeight: 56, padding: 16, background: 'var(--geul-surface-muted)' }}>
              {labels(kind)} · {Math.round(width)}%
            </div>
          )}
        </Fragment>
      ))}
    </div>
  );
}
function MediaResizeHandles({
  placement = 'inline',
  visibility = 'always',
}: {
  placement?: ResizeHandlePlacement;
  visibility?: ResizeHandleVisibility;
}) {
  return (
    <div style={{ background: 'var(--geul-background)', color: 'var(--geul-text-primary)', padding: 24 }}>
      {mediaKinds.map((kind) => (
        <ResizableMedia key={kind} kind={kind} placement={placement} visibility={visibility} />
      ))}
    </div>
  );
}

const meta = {
  title: 'Core/Interaction/ResizeHandle',
  component: ResizeHandle,
  parameters: { layout: 'padded' },
  args: { direction: 'right', value: 64, min: 10, max: 100, ariaLabel: 'Resize preview' },
} satisfies Meta<typeof ResizeHandle>;

export default meta;
type Story = StoryObj<typeof meta>;

const resizeContract: NonNullable<Story['play']> = async ({ canvasElement }) => {
  const canvas = within(canvasElement);
  const handles = canvas.getAllByRole('slider');
  await expect(handles).toHaveLength(mediaKinds.length * 2);
  for (const handle of handles) {
    const target = handle.getBoundingClientRect();
    await expect(target.width).toBeGreaterThanOrEqual(24);
    await expect(target.height).toBeGreaterThanOrEqual(24);
    const marker = canvasElement.ownerDocument.defaultView!.getComputedStyle(handle, '::before');
    await expect(parseFloat(marker.width)).toBeLessThan(target.width);
    await expect(parseFloat(marker.height)).toBeLessThanOrEqual(target.height);
    if (handle.getAttribute('data-geul-resize-placement') === 'media-edge') {
      const media = handle.parentElement!.getBoundingClientRect();
      const boundary = handle.getAttribute('data-resize-direction') === 'left' ? media.left : media.right;
      await expect(Math.abs(target.left + target.width / 2 - boundary)).toBeLessThanOrEqual(1);
    }
  }

  const [left, right] = handles;
  left.focus();
  await expect(left).toHaveFocus();
  await userEvent.keyboard('{ArrowRight}');
  await expect(left).toHaveAttribute('aria-valuenow', '65');
  await expect(right).toHaveAttribute('aria-valuenow', '65');
  right.focus();
  await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
  await expect(right).toHaveAttribute('aria-valuenow', '55');
  await userEvent.keyboard('{Home}{ArrowLeft}');
  await expect(left).toHaveAttribute('aria-valuenow', '10');
  await userEvent.keyboard('{End}{ArrowRight}');
  await expect(right).toHaveAttribute('aria-valuenow', '100');

  await userEvent.keyboard('{Home}');
  const leftEdge = left.getBoundingClientRect();
  const leftStart = leftEdge.left + leftEdge.width / 2;
  await userEvent.pointer([
    { target: left, keys: '[MouseLeft>]', coords: { clientX: leftStart } },
    { target: left, coords: { clientX: leftStart - 20 } },
    { target: left, keys: '[/MouseLeft]', coords: { clientX: leftStart - 20 } },
  ]);
  const afterLeftDrag = Number(left.getAttribute('aria-valuenow'));
  await expect(afterLeftDrag).toBeGreaterThan(10);
  const rightEdge = right.getBoundingClientRect();
  const rightStart = rightEdge.left + rightEdge.width / 2;
  await userEvent.pointer([
    { target: right, keys: '[MouseLeft>]', coords: { clientX: rightStart } },
    { target: right, coords: { clientX: rightStart + 20 } },
    { target: right, keys: '[/MouseLeft]', coords: { clientX: rightStart + 20 } },
  ]);
  await expect(Number(right.getAttribute('aria-valuenow'))).toBeGreaterThan(afterLeftDrag);
};

export const MediaResizeMatrix: Story = {
  name: 'Media matrix',
  render: () => <MediaResizeHandles />,
  play: resizeContract,
};

export const ActiveMediaEdges: Story = {
  render: () => <MediaResizeHandles placement="media-edge" visibility="active" />,
  play: resizeContract,
};

export const HoverAndKeyboardMediaEdges: Story = {
  render: () => <MediaResizeHandles placement="media-edge" visibility="on-interaction" />,
  play: resizeContract,
};
