import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { expect, userEvent, within } from 'storybook/test';
import { Text } from '@/components/core/Typography';
import { ColumnsEditorView } from './ColumnsEditor';
import type { ColumnsSection } from '../types';

function ColumnsCanvas({ readOnly = false }: { readOnly?: boolean }) {
  const [section, setSection] = useState<ColumnsSection>({
    id: 'columns',
    type: 'columns',
    props: { columns: '2', columnRatios: '1:1', gap: '24', mobileStack: 'true' },
    columns: [
      {
        id: 'left',
        sections: [
          { id: 'a', type: 'rich-text' },
          { id: 'b', type: 'rich-text' },
        ],
      },
      { id: 'right', sections: [] },
    ],
  });
  return (
    <ColumnsEditorView
      section={section}
      editable={!readOnly}
      allowStructuralEdits={!readOnly}
      updateSection={(id, updates) => {
        if (id === section.id) {
          setSection(
            (current) => ({ ...current, ...updates, props: { ...current.props, ...updates.props } }) as ColumnsSection,
          );
        }
      }}
      updateLocalizedSectionProps={(id, props) => {
        if (id === section.id) {
          setSection((current) => ({ ...current, props: { ...current.props, ...props } }));
        }
      }}
      SectionRenderer={({ section: child }) => (
        <Text>{child.id === 'a' ? 'Field recordings from Seoul.' : 'Artists and independent releases.'}</Text>
      )}
    />
  );
}
const meta = {
  title: 'Feature/Page/Editor Columns',
  component: ColumnsCanvas,
  parameters: { canvasInset: 'none', layout: 'padded' },
} satisfies Meta<typeof ColumnsCanvas>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReorderBetweenColumns: Story = {
  tags: ['a11y-author'],
  play: async ({ canvasElement, step }) => {
    await step(
      'Keyboard moves an authored section into an empty column without exposing collaboration IDs',
      async () => {
        const handle = canvasElement.querySelector<HTMLButtonElement>(
          '[data-page-section-id="b"] [data-page-section-drag-handle]',
        )!;
        for (let index = 0; index < 100 && canvasElement.ownerDocument.activeElement !== handle; index += 1) {
          await userEvent.tab();
        }
        await expect(handle).toHaveFocus();
        await expect(handle.getAttribute('aria-describedby')).toBeTruthy();
        await userEvent.keyboard(' {ArrowRight} ');
        const columns = canvasElement.querySelectorAll('[aria-labelledby^="page-column-"]');
        await expect(columns).toHaveLength(2);
        await expect(columns[0]!.querySelectorAll('[data-page-section-id]')).toHaveLength(1);
        await expect(columns[1]!.querySelector('[data-page-section-id="b"]')).not.toBeNull();
        const target = columns[1]!.querySelector('[data-page-section-toggle]')!;
        await expect(target).toHaveFocus();
        await expect(within(columns[1] as HTMLElement).getByText('Artists and independent releases.')).toBeVisible();
      },
    );
  },
};
export const Readonly: Story = { args: { readOnly: true } };
