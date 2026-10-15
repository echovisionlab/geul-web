import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { EditorRuntimePreview } from '@/stories/shared/EditorRuntimePreview';
const meta = {
  title: 'Feature/Editor/Executables',
  component: EditorRuntimePreview,
  parameters: { canvasInset: 'none', layout: 'fullscreen' },
} satisfies Meta<typeof EditorRuntimePreview>;
export default meta;
export const CodeKeyboardSelection: StoryObj<typeof meta> = {
  args: { initialScenario: 'code' },
  play: async ({ canvasElement }) => {
    const selector = await waitFor(() => {
      const button = canvasElement.querySelector<HTMLButtonElement>('[data-editor-block-selector]');
      expect(button).not.toBeNull();
      return button!;
    });
    await userEvent.keyboard('{Tab}');
    selector.focus();
    await expect(selector).toHaveFocus();
    await waitFor(() => expect(selector.parentElement).toHaveAttribute('data-selected', 'true'));
  },
};
async function editExecutableTitle({ canvasElement }: { canvasElement: HTMLElement }) {
  const canvas = within(canvasElement);
  const input = await waitFor(() => {
    const title = canvasElement.querySelector<HTMLInputElement>('[data-executable-title-input]');
    expect(title).not.toBeNull();
    return title!;
  });
  const node = input.closest('[data-content-type]')!;
  const kind = node.getAttribute('data-content-type');
  const title = 'Edited executable title';
  await userEvent.clear(input);
  await expect(input).toHaveValue('');
  await userEvent.type(input, title);
  await expect(input).toHaveValue(title);
  await expect(input).toHaveFocus();
  await waitFor(() =>
    expect(
      canvasElement.ownerDocument.querySelector('[data-testid^="tiptap-"][data-testid$="-menu"][role="toolbar"]'),
    ).toBeNull(),
  );
  await expect(node).toHaveAttribute('data-content-type', kind);
  await expect(node).toBeInTheDocument();

  const [edit, preview] = canvas.getAllByRole('radio');
  await userEvent.click(preview);
  await waitFor(() => {
    const published = canvasElement.querySelector('[data-playground-view="published"]');
    expect(published?.querySelector('[data-executable-title]')).toHaveTextContent(title);
  });
  await userEvent.click(edit);
  await waitFor(() => expect(canvasElement.querySelector('[data-executable-title-input]')).toHaveValue(title));
}

export const P5: StoryObj<typeof meta> = { args: { initialScenario: 'p5' }, play: editExecutableTitle };
export const Three: StoryObj<typeof meta> = { args: { initialScenario: 'three' }, play: editExecutableTitle };
export const Shader: StoryObj<typeof meta> = { args: { initialScenario: 'shader' }, play: editExecutableTitle };
