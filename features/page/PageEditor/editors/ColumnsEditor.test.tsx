// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@/test/render';
import { ColumnsEditor } from './ColumnsEditor';
import type { ColumnsSection } from '../types';

const state = vi.hoisted(() => ({
  editable: false,
  allowStructuralEdits: false,
  updateSection: vi.fn(),
  updateLocalizedSectionProps: vi.fn(),
}));
vi.mock('../PageEditorContext', () => ({ usePageEditor: () => state }));
vi.mock('next-intl', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next-intl')>()),
  useTranslations: () => (key: string, values?: { index: number }) => (values ? `${key} ${values.index}` : key),
}));
vi.mock('../usePageSectionTypeLabels', () => ({
  usePageSectionTypeLabels: () => ({ 'rich-text': 'Text', embed: 'Embed' }),
}));

beforeEach(() => {
  state.updateSection.mockClear();
});

function setup(section: ColumnsSection) {
  const editor = (value: ColumnsSection) => (
    <ColumnsEditor section={value} SectionRenderer={() => <p>Child content</p>} />
  );
  const view = render(editor(section));
  return { ...view, refresh: (value: ColumnsSection) => view.rerender(editor(value)) };
}

async function openEmbed(user: ReturnType<typeof render>['user']) {
  await user.click(screen.getByRole('button', { name: 'columnsEditor.actions.addSectionToColumn 1' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Embed' }));
  return screen.findByRole('dialog', { name: 'Embed' });
}

describe('ColumnsEditor authority', () => {
  const section = {
    id: 'columns',
    type: 'columns',
    props: { columns: '2' },
    columns: [
      { id: 'column-a', sections: [{ id: 'text', type: 'rich-text' }] },
      { id: 'column-b', sections: [] },
    ],
  } as ColumnsSection;
  it('configures Embed before adding a column child and leaves cancelled input unsaved', async () => {
    state.editable = true;
    state.allowStructuralEdits = true;
    const { user } = setup(section);
    const cancelled = within(await openEmbed(user));
    expect(state.updateSection).not.toHaveBeenCalled();
    const cancelledUrl = cancelled.getByRole('textbox', { name: 'embed.urlLabel' });
    await user.clear(cancelledUrl);
    await user.paste('https://embed.example/cancelled');
    expect(cancelledUrl).toHaveValue('https://embed.example/cancelled');
    expect(cancelled.getByRole('button', { name: 'add' })).toBeEnabled();
    await user.click(cancelled.getByRole('button', { name: 'cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Embed' })).not.toBeInTheDocument();
    expect(state.updateSection).not.toHaveBeenCalled();
    const insertion = within(await openEmbed(user));
    const url = insertion.getByRole('textbox', { name: 'embed.urlLabel' });
    expect(url).toHaveValue('');
    expect(insertion.getByRole('button', { name: 'add' })).toBeDisabled();
    await user.clear(url);
    await user.paste('https://embed.example/app');
    expect(url).toHaveValue('https://embed.example/app');
    expect(insertion.getByRole('button', { name: 'add' })).toBeEnabled();
    await user.click(insertion.getByRole('button', { name: 'add' }));
    expect(screen.queryByRole('dialog', { name: 'Embed' })).not.toBeInTheDocument();
    expect(state.updateSection).toHaveBeenCalledExactlyOnceWith('columns', {
      columns: [
        expect.objectContaining({
          id: 'column-a',
          sections: [
            section.columns[0]!.sections[0],
            expect.objectContaining({
              type: 'embed',
              props: expect.objectContaining({ uri: 'https://embed.example/app' }),
            }),
          ],
        }),
        section.columns[1],
      ],
    });
  });

  it.each(['reorder', 'remove'] as const)(
    'keeps pending Embed insertion attached to its column after remote %s',
    async (change) => {
      state.editable = true;
      state.allowStructuralEdits = true;
      const { user, refresh } = setup(section);
      const insertion = within(await openEmbed(user));
      const url = insertion.getByRole('textbox', { name: 'embed.urlLabel' });
      await user.clear(url);
      await user.paste('https://embed.example/app');
      expect(url).toHaveValue('https://embed.example/app');
      expect(insertion.getByRole('button', { name: 'add' })).toBeEnabled();
      expect(state.updateSection).not.toHaveBeenCalled();
      refresh({
        ...section,
        columns: change === 'reorder' ? [section.columns[1]!, section.columns[0]!] : [section.columns[1]!],
      });
      expect(url).toHaveValue('https://embed.example/app');
      expect(insertion.getByRole('button', { name: 'add' })).toBeEnabled();
      await user.click(insertion.getByRole('button', { name: 'add' }));
      expect(screen.queryByRole('dialog', { name: 'Embed' })).not.toBeInTheDocument();
      if (change === 'remove') {
        expect(state.updateSection).not.toHaveBeenCalled();
      } else {
        expect(state.updateSection).toHaveBeenCalledExactlyOnceWith('columns', {
          columns: [
            section.columns[1],
            expect.objectContaining({
              id: 'column-a',
              sections: [
                section.columns[0]!.sections[0],
                expect.objectContaining({
                  type: 'embed',
                  props: expect.objectContaining({ uri: 'https://embed.example/app' }),
                }),
              ],
            }),
          ],
        });
      }
    },
  );

  it.each([
    [false, true],
    [true, false],
  ])('disables topology controls with editable=%s and structural authority=%s', (editable, allowStructuralEdits) => {
    state.editable = editable;
    state.allowStructuralEdits = allowStructuralEdits;
    setup(section);
    expect(screen.getByText('Child content')).toBeInTheDocument();
    for (const role of ['radio', 'combobox', 'textbox', 'switch'] as const) {
      for (const control of screen.getAllByRole(role)) {
        expect(control).toBeDisabled();
      }
    }
    const previewToggles = screen.getAllByRole('button', { name: /^sectionItem\.actions\.(expand|collapse)/ });
    for (const control of screen.getAllByRole('button')) {
      if (!previewToggles.includes(control)) {
        expect(control).toBeDisabled();
      }
    }
    for (const toggle of previewToggles) {
      expect(toggle).toBeEnabled();
    }
  });
});
