import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { LayoutContainer, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { EmbedFrame } from '../blocks/embed/EmbedFrame';
import { EmbedSettingsForm } from '../blocks/embed/SettingsForm';
import { parseEmbedProps } from '../blocks/embed/schema';
import { SectionItemView } from './SectionItemView';
import { DEFAULT_SECTION_SETTINGS, type SectionMeta } from './types';
import type { BlockSettingsEditorProps, BlockCanvasPreviewProps } from '../blocks/types';

function EmbedSettings({ props, allowSharedEdits, updateSharedProps }: BlockSettingsEditorProps) {
  return (
    <EmbedSettingsForm
      props={parseEmbedProps(props)}
      allowSharedEdits={allowSharedEdits}
      updateSharedProps={updateSharedProps}
      updateLocalizedProps={updateSharedProps}
    />
  );
}
function EmbedPreview({ props }: BlockCanvasPreviewProps) {
  return <EmbedFrame props={parseEmbedProps(props)} preview />;
}

function EditorBlocks({
  editable = true,
  allowStructuralEdits = true,
}: {
  editable?: boolean;
  allowStructuralEdits?: boolean;
}) {
  const [sections, setSections] = useState<SectionMeta[]>([
    { id: 'intro', type: 'rich-text' },
    { id: 'embed', type: 'embed', props: {}, settings: { ...DEFAULT_SECTION_SETTINGS, maxWidth: 'narrow' } },
    { id: 'closing', type: 'rich-text' },
  ]);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  return (
    <LayoutContainer size="compact">
      <LayoutStack gap="md">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!editable || !allowStructuralEdits || !over) {
              return;
            }
            setSections((current) =>
              arrayMove(
                current,
                current.findIndex((section) => section.id === active.id),
                current.findIndex((section) => section.id === over.id),
              ),
            );
          }}
        >
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => (
              <SectionItemView
                key={section.id}
                section={section}
                editable={editable}
                allowStructuralEdits={allowStructuralEdits}
                definition={
                  section.type === 'embed'
                    ? { CanvasPreview: EmbedPreview, SettingsEditor: EmbedSettings, parse: parseEmbedProps }
                    : undefined
                }
                onDelete={() => setSections((current) => current.filter((item) => item.id !== section.id))}
                updateSection={(id, updates) =>
                  setSections((current) =>
                    current.map((item) =>
                      item.id === id
                        ? ({
                            ...item,
                            props: { ...item.props, ...updates.props },
                            settings: { ...item.settings, ...updates.settings },
                          } as SectionMeta)
                        : item,
                    ),
                  )
                }
                updateLocalizedSectionProps={(id, props) =>
                  setSections((current) =>
                    current.map((item) => (item.id === id ? { ...item, props: { ...item.props, ...props } } : item)),
                  )
                }
                content={<Text>Field recordings, artists and independent releases from Seoul.</Text>}
              />
            ))}
          </SortableContext>
        </DndContext>
      </LayoutStack>
    </LayoutContainer>
  );
}
const meta = {
  title: 'Feature/Page/Editor Blocks',
  component: EditorBlocks,
  parameters: { canvasInset: 'none', layout: 'padded' },
} satisfies Meta<typeof EditorBlocks>;
export default meta;
type Story = StoryObj<typeof meta>;
export const ReorderAndSettings: Story = {};
export const TranslationMode: Story = { args: { allowStructuralEdits: false } };
export const Readonly: Story = { args: { editable: false } };
export const Narrow: Story = {
  render: () => (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <EditorBlocks />
    </div>
  ),
};
