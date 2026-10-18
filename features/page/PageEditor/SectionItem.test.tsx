// @vitest-environment jsdom

import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import { SectionItem } from './SectionItem';
import type { SectionMeta } from './types';

vi.mock('./PageEditorContext', () => ({
  usePageEditor: () => ({ updateLocalizedSectionProps: vi.fn(), updateSection: vi.fn(), allowStructuralEdits: true }),
}));
// Rich text and columns edit inline: their definitions have no canvas preview or split settings.
vi.mock('../blocks/registry', () => ({ getBlockDefinition: () => undefined }));
vi.mock('./SectionContent', () => ({ SectionContent: () => <p>Section body</p> }));

describe('SectionItem', () => {
  // Inline bodies would otherwise start collapsed; expanded keeps the SSR-painted content visible.
  it.each<{ section: SectionMeta; label: string }>([
    { section: { id: 'copy', type: 'rich-text' }, label: 'Rich Text' },
    { section: { id: 'layout', type: 'columns', columns: [] }, label: 'Columns' },
  ])('starts the inline $label editor body expanded', ({ section, label }) => {
    render(
      <DndContext>
        <SortableContext items={[section.id]}>
          <SectionItem section={section} onDelete={vi.fn()} />
        </SortableContext>
      </DndContext>,
    );

    expect(screen.getByRole('button', { name: `Collapse ${label} section` })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Section body')).toBeVisible();
  });
});
