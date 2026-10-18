// @vitest-environment jsdom

import { DndContext } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@/test/render';
import type { BlockSettingsSurfaceProps } from '../blocks/types';
import { SectionItemView, type SectionItemViewProps } from './SectionItemView';
import type { SectionMeta } from './types';

function renderSection({
  section,
  ...props
}: Partial<Omit<SectionItemViewProps, 'section'>> & { section: SectionMeta }) {
  const updateSection = vi.fn();
  return {
    updateSection,
    ...render(
      <DndContext>
        <SortableContext items={[section.id]}>
          <SectionItemView
            section={section}
            onDelete={vi.fn()}
            allowStructuralEdits
            updateSection={updateSection}
            updateLocalizedSectionProps={vi.fn()}
            content={<p>Preview body</p>}
            {...props}
          />
        </SortableContext>
      </DndContext>,
    ),
  };
}

function SceneCanvas() {
  return <p>Scene canvas</p>;
}

function SceneSettingsEditor() {
  return <p>Scene settings editor</p>;
}

function SettingsSurface({ opened, title, onClose }: BlockSettingsSurfaceProps) {
  return opened ? (
    <div role="dialog" aria-label={`${title} workspace`}>
      <button type="button" onClick={onClose}>
        Close workspace
      </button>
    </div>
  ) : null;
}

describe('SectionItemView', () => {
  it('applies the section style to expanded editor preview content', () => {
    renderSection({
      section: {
        id: 'styled',
        type: 'rich-text',
        settings: {
          backgroundColor: '#123456',
          paddingTop: '12',
          paddingBottom: '16',
          paddingLeft: '20',
          paddingRight: '24',
          maxWidth: 'narrow',
        },
      },
      initialExpanded: true,
    });

    expect(screen.getByRole('button', { name: 'Collapse Rich Text section' })).toHaveAttribute('aria-expanded', 'true');
    // The section style sits on the preview wrapper, which has no role of its own.
    // eslint-disable-next-line testing-library/no-node-access
    expect(screen.getByRole('region', { name: 'Rich Text' }).firstElementChild).toHaveStyle({
      paddingTop: '12px',
      paddingBottom: '16px',
      paddingLeft: '20px',
      paddingRight: '24px',
      maxWidth: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
    });
    expect(screen.getByText('Preview body')).toBeVisible();
  });

  it('keeps the enabled section drag handle out of native browser dragging', () => {
    renderSection({ section: { id: 'handle', type: 'rich-text' } });

    const handle = screen.getByRole('button', { name: 'Drag Rich Text section' });
    expect(handle).toHaveAttribute('draggable', 'false');
    expect(handle).toBeEnabled();
  });

  it('disables structural actions while allowing section previews in translation mode', async () => {
    const { user, updateSection } = renderSection({
      section: { id: 'translation', type: 'rich-text' },
      allowStructuralEdits: false,
      initialExpanded: true,
    });

    expect(screen.getByRole('button', { name: 'Drag Rich Text section' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete Rich Text section' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Open settings for Rich Text section' })).toBeNull();
    expect(screen.getByText('Preview body')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Collapse Rich Text section' }));

    expect(screen.queryByText('Preview body')).toBeNull();
    expect(updateSection).not.toHaveBeenCalled();
  });

  it('opens a block-specific settings workspace when one is registered', async () => {
    const { user } = renderSection({
      section: { id: 'scene', type: 'immersive-scene', props: {} },
      definition: {
        parse: (props) => props,
        CanvasPreview: SceneCanvas,
        SettingsEditor: SceneSettingsEditor,
        SettingsSurface,
      },
    });

    await user.click(screen.getByRole('button', { name: 'Open settings for Immersive Scene section' }));

    expect(screen.getByRole('dialog', { name: 'Immersive Scene workspace' })).toBeInTheDocument();
    expect(screen.queryByText('Scene settings editor')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Close workspace' }));

    expect(screen.queryByRole('dialog', { name: 'Immersive Scene workspace' })).toBeNull();
  });
});
