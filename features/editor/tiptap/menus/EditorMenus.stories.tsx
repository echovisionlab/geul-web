import { EditorRuntimePreview } from '../../../../stories/shared/EditorRuntimePreview';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor } from 'storybook/test';
import {
  ContextualMenuPreview,
  EditorSelectionPreview,
  BlockMenuPreview,
} from '../../../../stories/shared/EditorMenusPreview';
const meta = {
  title: 'Feature/Editor/Menus',
  component: EditorSelectionPreview,
  args: { kind: 'bubble', floating: false },
  parameters: { canvasInset: 'none', layout: 'padded' },
} satisfies Meta<typeof EditorSelectionPreview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const FormattingBubble: Story = {
  play: async ({ canvasElement }) => {
    const toolbar = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-testid="tiptap-selection-menu"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(toolbar).toHaveAttribute('role', 'toolbar');
    expect(toolbar.getAttribute('aria-label')?.trim()).toBeTruthy();
    const actions = [...toolbar.querySelectorAll<HTMLElement>('[data-selection-toolbar-action]')].filter(
      (action) => !action.matches(':disabled, [aria-disabled="true"]') && action.getClientRects().length > 0,
    );
    expect(actions.filter((action) => action.tabIndex === 0)).toHaveLength(1);
    actions[0]!.focus();
    await userEvent.keyboard('{End}');
    expect(actions.at(-1)).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(actions[0]).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    expect(toolbar.contains(document.activeElement)).toBe(false);
  },
};
export const SelectionBubble: Story = {
  args: { floating: true },
  play: async ({ canvasElement }) => {
    const more = await waitFor(() => {
      const target = canvasElement.ownerDocument.querySelector<HTMLButtonElement>(
        '[data-testid="tiptap-selection-more"]',
      );
      expect(target).not.toBeNull();
      return target!;
    });
    const toolbar = more.closest('[role="toolbar"]')!;
    await userEvent.click(more);
    const menu = await waitFor(() => {
      const target = canvasElement.ownerDocument.querySelector<HTMLElement>('[role="menu"]');
      expect(target).not.toBeNull();
      return target!;
    });
    expect(toolbar.contains(menu)).toBe(false);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    expect(more).toHaveAttribute('aria-controls', menu.id);
    for (const item of menu.querySelectorAll<HTMLElement>('[role="menuitem"]')) {
      expect(item).toBeVisible();
      const bounds = item.getBoundingClientRect();
      expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.bottom).toBeLessThanOrEqual(canvasElement.ownerDocument.defaultView!.innerHeight);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(more).toHaveFocus());
    expect(more).toHaveAttribute('aria-expanded', 'false');
    expect(toolbar).toBeVisible();
  },
};
export const SlashInsertion: Story = {
  args: { kind: 'slash' },
  play: async ({ canvasElement }) => {
    const menu = await waitFor(() => {
      const element = canvasElement.querySelector<HTMLElement>('[data-testid="tiptap-slash-menu"]');
      expect(element).not.toBeNull();
      return element!;
    });
    const input = canvasElement.querySelector<HTMLElement>('.ProseMirror')!;
    expect(input).toHaveAttribute('aria-controls', menu.id);
    const initial = input.getAttribute('aria-activedescendant');
    expect(initial).toBeTruthy();
    expect(document.getElementById(initial!)).toHaveAttribute('aria-selected', 'true');
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(input.getAttribute('aria-activedescendant')).not.toBe(initial));
    const active = input.getAttribute('aria-activedescendant');
    expect(document.getElementById(active!)).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(canvasElement.querySelector('[data-testid="tiptap-slash-menu"]')).toBeNull());
    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(input).toHaveFocus();
    expect(input.textContent).toBe('/');
  },
};
async function compactContextualToolbar({ canvasElement }: { canvasElement: HTMLElement }) {
  const toolbar = await waitFor(() => {
    const element = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[role="toolbar"][data-geul-toolbar-density="compact"]',
    );
    expect(element).not.toBeNull();
    return element!;
  });
  const buttons = [...toolbar.querySelectorAll<HTMLElement>('[data-control-kind="icon"]')];
  expect(buttons.length).toBeGreaterThan(0);
  const rootFontSize = Number.parseFloat(getComputedStyle(canvasElement.ownerDocument.documentElement).fontSize);
  const pixels = (property: string) => {
    const value = getComputedStyle(toolbar).getPropertyValue(property).trim();
    return Number.parseFloat(value) * (value.endsWith('rem') ? rootFontSize : 1);
  };
  const height = Math.max(pixels('--geul-control-height-compact'), pixels('--geul-interaction-minimum'));
  for (const button of buttons) {
    expect(button).toHaveAttribute('data-control-size', 'compact');
    const box = button.getBoundingClientRect();
    expect(Math.abs(box.height - height)).toBeLessThan(1);
    const glyph = button.querySelector('svg')?.getBoundingClientRect();
    if (glyph) {
      expect(Math.abs((glyph.top + glyph.bottom) / 2 - (box.top + box.bottom) / 2)).toBeLessThan(1);
    }
  }
  const statusGlyph = toolbar.querySelector('[role="status"] svg')?.getBoundingClientRect();
  const command = buttons[0]!.getBoundingClientRect();
  if (statusGlyph) {
    expect(Math.abs((statusGlyph.top + statusGlyph.bottom) / 2 - (command.top + command.bottom) / 2)).toBeLessThan(1);
  }
  // Establish pointer movement outside the trigger before entering it, as a real hover does.
  await userEvent.hover(canvasElement);
  await userEvent.hover(buttons[0]!);
  await waitFor(() => {
    const tooltip = canvasElement.ownerDocument.querySelector('[role="tooltip"]');
    expect(tooltip).toHaveTextContent(buttons[0]!.getAttribute('aria-label')!);
  });
  await userEvent.unhover(buttons[0]!);
}

export const MapControls: Story = {
  render: () => <ContextualMenuPreview kind="map" />,
  play: compactContextualToolbar,
};
export const ExternalVideoControls: Story = {
  render: () => <ContextualMenuPreview kind="external-video" />,
  play: compactContextualToolbar,
};

export const BlockActions: Story = { render: () => <BlockMenuPreview /> };

export const TableSelection: Story = {
  render: () => <EditorRuntimePreview initialScenario="table" />,
  play: async ({ canvasElement }) => {
    await compactContextualToolbar({ canvasElement });
    const toolbar = canvasElement.ownerDocument.querySelector('[data-testid="tiptap-table-menu"]')!;
    const boxes = [...toolbar.querySelectorAll<HTMLElement>('[data-control-kind="icon"]')].map((el) =>
      el.getBoundingClientRect(),
    );
    expect(Math.max(...boxes.map((box) => box.top)) - Math.min(...boxes.map((box) => box.top))).toBeLessThan(1);
  },
};
export const CodeSelection: Story = { render: () => <EditorRuntimePreview initialScenario="code" /> };
