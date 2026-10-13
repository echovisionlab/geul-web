import type { Meta, StoryObj } from '@storybook/nextjs';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import { expect, userEvent, waitFor } from 'storybook/test';
import { Button } from '@/components/core/Button';
import { LayoutStack } from '@/components/core/Layout';
import { EditorRuntimePreview as Playground } from '../../../stories/shared/EditorRuntimePreview';
const meta = {
  title: 'Feature/Editor/Tiptap Playground',
  component: Playground,
  parameters: { layout: 'fullscreen' },
  args: { initialView: 'edit' },
} satisfies Meta<typeof Playground>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Editor: Story = {
  play: async ({ canvasElement }) => {
    const content = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-testid="tiptap-editor-content"]');
      expect(element).not.toBeNull();
      expect(element).toHaveAttribute('role', 'textbox');
      return element!;
    });
    const before = content.textContent;
    expect(content).toHaveAttribute('aria-keyshortcuts', 'Shift+F10 ContextMenu');
    content.focus();
    await userEvent.keyboard('{Shift>}{F10}{/Shift}');
    await waitFor(() => expect(canvasElement.querySelector('[data-testid="tiptap-block-menu"]')).not.toBeNull());
    await waitFor(() => expect(document.activeElement?.closest('[role="menu"]')).not.toBeNull());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvasElement.querySelector('[data-testid="tiptap-block-menu"]')).toBeNull());
    expect(content.textContent).toBe(before);
    expect(content.querySelector('[data-testid="tiptap-block-drag-handle"]')).toHaveFocus();
    content.focus();
  },
};
export const Published: Story = { args: { initialView: 'preview' } };

export const Callout: Story = { args: { initialScenario: 'callout' } };

/** Controlled preview of the real native Dropcursor; production drag behavior is unchanged. */
function DropGuidePreview() {
  const locale = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const release = useRef<(() => void) | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const stop = () => {
    release.current?.();
    release.current = null;
    setPreviewing(false);
  };
  useEffect(() => () => release.current?.(), []);
  const preview = () => {
    const editor = host.current?.querySelector<HTMLElement>('[data-testid="tiptap-editor-content"]');
    const blocks = editor?.querySelectorAll<HTMLElement>('[data-node-type="blockContainer"]');
    const handle = blocks?.[0]?.querySelector<HTMLElement>('[data-drag-handle]');
    const target = blocks?.[blocks.length - 1];
    if (!editor || !handle || !target) {
      return;
    }
    const dataTransfer = new DataTransfer();
    const start = handle.getBoundingClientRect();
    handle.dispatchEvent(
      new DragEvent('dragstart', {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: start.x + start.width / 2,
        clientY: start.y + start.height / 2,
      }),
    );
    const showBoundary = () => {
      const bounds = target.getBoundingClientRect();
      editor.dispatchEvent(
        new DragEvent('dragover', {
          bubbles: true,
          cancelable: true,
          dataTransfer,
          clientX: bounds.x + bounds.width / 2,
          clientY: bounds.y + bounds.height / 2,
        }),
      );
    };
    showBoundary();
    const timer = window.setInterval(showBoundary, 1000);
    release.current = () => {
      window.clearInterval(timer);
      handle.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer }));
    };
    setPreviewing(true);
  };
  return (
    <div
      ref={host}
      onPointerDownCapture={(event) => {
        if (
          release.current &&
          !(event.target instanceof Element && event.target.closest('[data-testid="tiptap-drop-guide-preview"]'))
        ) {
          stop();
        }
      }}
    >
      <LayoutStack gap="sm">
        <Button
          data-testid="tiptap-drop-guide-preview"
          tone="neutral"
          emphasis="medium"
          onClick={() => (release.current ? stop() : preview())}
        >
          {locale === 'ko'
            ? previewing
              ? '가이드 미리보기 닫기'
              : '삽입 위치 미리보기'
            : previewing
              ? 'Close guide preview'
              : 'Preview insertion point'}
        </Button>
        <Playground />
      </LayoutStack>
    </div>
  );
}

export const DropGuide: Story = {
  render: () => <DropGuidePreview />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('div[role="img"][data-mermaid-status="ready"]')).not.toBeNull(),
    );
    const button = canvasElement.querySelector<HTMLButtonElement>('[data-testid="tiptap-drop-guide-preview"]');
    await userEvent.click(button!);
    await waitFor(() => {
      const guide = canvasElement.querySelector<HTMLElement>('.prosemirror-dropcursor-block');
      expect(guide).not.toBeNull();
      expect(guide?.style.backgroundColor).toBe('var(--geul-focus)');
      expect(guide?.style.height).toBe('2px');
    });
  },
};
