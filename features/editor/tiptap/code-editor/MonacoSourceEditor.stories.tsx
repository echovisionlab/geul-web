import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { useTranslations } from 'next-intl';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { LayoutInset } from '@/components/core/Layout';
import { MonacoSourceEditor, type MonacoSourceEditorProps } from './MonacoSourceEditor';
import { getThemeDefinition, getThemeTokens } from '@/lib/theme/themes';
import { sourceEditorTheme } from './source-editor-presentation';

function SourceEditorPreview(props: Pick<MonacoSourceEditorProps, 'density' | 'readOnly'>) {
  const labels = useTranslations('editorCommon.editor.runtimeLabels.p5');
  const [source, setSource] = useState(
    '// Theme colors keep source notation readable.\nconst answer = 42;\nconst values = [0x2a, 0.5];\nconst greeting = "Hello";\nconst pattern = /answer\\d+/;\nif (values.length > 0) {\n  console.log(greeting, Math.round(answer), pattern);\n}',
  );
  return (
    <LayoutInset space="md">
      <MonacoSourceEditor
        {...props}
        value={source}
        onChange={setSource}
        language="javascript"
        ariaLabel={labels('source')}
        modelPath="kit/source-presentation.js"
        markers={[
          { message: 'Fixture diagnostic', severity: 'warning', startLineNumber: 2, startColumn: 7, endColumn: 13 },
        ]}
      />
    </LayoutInset>
  );
}

const meta = {
  title: 'Feature/Editor/Source Editor',
  component: SourceEditorPreview,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SourceEditorPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Standard: Story = {
  args: { density: 'standard' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const editor = canvasElement.querySelector('.monaco-editor');
      expect(editor).not.toBeNull();
      expect(getComputedStyle(editor!).direction).toBe('ltr');
    });
    const input = await waitFor(() => canvas.getByRole('textbox', { name: /.+/ }));
    expect(input).toHaveAttribute('aria-multiline', 'true');
    expect(input.getAttribute('aria-label')?.trim()).toBeTruthy();
    input.focus();
    expect(input).toHaveFocus();
    await userEvent.keyboard('{Tab}');
    expect(input).not.toHaveFocus();
  },
};
export const Compact: Story = { args: { density: 'compact' } };
export const SyntaxContrast: Story = {
  args: { density: 'standard' },
  parameters: {
    docs: {
      description: {
        story:
          'Actual rendered JavaScript notation is measured against the selected preset’s editor, line-highlight and selection surfaces. The sample includes comment, numbers, keyword, type, string, regexp and bracket categories. Change the header theme to review the same source; no authored source is recolored outside the shared editor adapter.',
      },
    },
  },
  play: async ({ canvasElement, globals }) => {
    const document = canvasElement.ownerDocument;
    const { id } = getThemeDefinition(globals.theme);
    const theme = sourceEditorTheme(id);
    const roles = getThemeTokens(id);
    const rgb = (value: string) => {
      if (value.startsWith('#')) {
        const hex =
          value.length === 4
            ? value
                .slice(1)
                .split('')
                .map((channel) => channel + channel)
                .join('')
            : value.slice(1);
        return [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
      }
      return value
        .match(/[\d.]+/g)!
        .slice(0, 3)
        .map(Number);
    };
    const luminance = (value: string) =>
      rgb(value)
        .map((channel) => {
          const normalized = channel / 255;
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
    await waitFor(async () => {
      // A toolbar switch projects the document preset and Monaco theme asynchronously.
      // Check the requested preset and re-read the current render on every retry.
      await expect(document.documentElement.dataset.geulThemeId).toBe(id);
      const editor = canvasElement.querySelector('.monaco-editor');
      await expect(editor).not.toBeNull();
      await expect(rgb(getComputedStyle(editor!).backgroundColor)).toEqual(rgb(theme.colors['editor.background']));
      const tokens = [...canvasElement.querySelectorAll<HTMLElement>('.monaco-editor .view-lines span')].filter(
        (element) => element.children.length === 0 && element.textContent?.trim(),
      );
      await expect(tokens.length).toBeGreaterThan(10);
      const comment = tokens.find((token) =>
        token.textContent?.replace(/\s+/gu, ' ').includes('Theme colors keep source notation'),
      );
      const number = tokens.find((token) => token.textContent === '42');
      await expect(comment).toBeDefined();
      await expect(number).toBeDefined();
      await expect(rgb(getComputedStyle(comment!).color)).toEqual(rgb(roles['document-text-green']));
      await expect(rgb(getComputedStyle(number!).color)).toEqual(rgb(roles['document-text-green']));
      for (const token of tokens) {
        const ink = luminance(getComputedStyle(token).color);
        for (const surface of ['editor.background', 'editor.lineHighlightBackground', 'editor.selectionBackground']) {
          const background = luminance(theme.colors[surface]);
          const ratio = (Math.max(ink, background) + 0.05) / (Math.min(ink, background) + 0.05);
          await expect(ratio, `${id} ${token.textContent} on ${surface}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
  },
};
export const ReadOnly: Story = {
  args: { readOnly: true },
  play: async ({ canvasElement }) => {
    const input = await waitFor(() => within(canvasElement).getByRole('textbox', { name: /.+/ }));
    expect(input).toHaveAttribute('aria-autocomplete', 'none');
    input.focus();
    await userEvent.keyboard('{Tab}');
    expect(input).not.toHaveFocus();
  },
};
