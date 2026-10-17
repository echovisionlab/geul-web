import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconFile, IconFolder, IconMenu2 } from '@tabler/icons-react';
import { useStorybookText } from '@/.storybook/fixture-i18n';
import { LayoutStack, LayoutInline } from '../Layout';
import { Text } from '../Typography';
import { Checkbox } from '../Input';
import {
  SelectionGrid,
  SelectionSurface,
  SelectionThumbnail,
  SelectionRow,
  SelectionPath,
  SelectionViewport,
  type SelectionGridColumns,
} from './SelectionSurface';
const meta: Meta = { title: 'Core/Interaction/SelectionSurface', parameters: { layout: 'padded' } };
export default meta;
type Story = StoryObj;
function Preview() {
  const text = useStorybookText();
  const [selected, setSelected] = useState('one');
  return (
    <LayoutStack gap="md">
      <SelectionViewport inset="none">
        <SelectionGrid label={text('Files')} density="workspace" selectionStyle="checkbox">
          {['one', 'two', 'three'].map((id, index) => (
            <SelectionSurface
              key={id}
              label={['Monome', 'TX–6', 'T 1000'][index]}
              selected={selected === id}
              selectionStyle="checkbox"
              selectionControl={
                index !== 2 ? (
                  <Checkbox
                    aria-label={['Monome', 'TX–6', 'T 1000'][index]}
                    checked={selected === id}
                    onChange={() => setSelected(id)}
                  />
                ) : undefined
              }
              unavailable={index === 2}
              density="workspace"
              preview={<SelectionThumbnail size="workspace" icon={index === 0 ? <IconFolder /> : <IconFile />} />}
              onClick={() => index !== 2 && setSelected(id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && index !== 2) {
                  setSelected(id);
                }
              }}
            />
          ))}
        </SelectionGrid>
      </SelectionViewport>
    </LayoutStack>
  );
}
export const States: Story = { render: () => <Preview /> };
function RowStatesPreview() {
  const [enabled, setEnabled] = useState(true);
  const text = useStorybookText();
  return (
    <LayoutStack gap="md">
      <SelectionRow
        selected={enabled}
        onAction={() => setEnabled(!enabled)}
        leading={
          <Checkbox
            checked={enabled}
            onChange={(event) => setEnabled(event.currentTarget.checked)}
            aria-label={text('Active')}
          />
        }
      >
        {text('Active')}
      </SelectionRow>
      <SelectionRow disabled onAction={() => {}}>
        {text('Disabled')}
      </SelectionRow>
    </LayoutStack>
  );
}
export const RowStates: Story = { render: () => <RowStatesPreview /> };

function CompactRowsPreview() {
  const [selected, setSelected] = useState('Main navigation');
  return (
    <LayoutStack gap="none">
      {['Main navigation', 'Footer'].map((label) => (
        <SelectionRow
          key={label}
          density="compact"
          selected={selected === label}
          onAction={() => setSelected(label)}
          leading={<IconMenu2 aria-hidden />}
        >
          <Text size="xs">{label}</Text>
        </SelectionRow>
      ))}
    </LayoutStack>
  );
}
export const CompactRows: Story = { render: () => <CompactRowsPreview /> };

function PathPreview({ pageTitle = false }: { pageTitle?: boolean }) {
  const [path, setPath] = useState([
    { id: 'library', name: 'Library' },
    { id: 'recordings', name: 'Recordings' },
  ]);
  const text = useStorybookText();
  return (
    <LayoutStack gap="md">
      <LayoutInline justify="between" wrap="nowrap">
        <SelectionPath
          items={path}
          parentLabel={text('Back')}
          onOpen={(index) => setPath(path.slice(0, index + 1))}
          pageTitle={pageTitle}
        />
      </LayoutInline>
    </LayoutStack>
  );
}
export const FolderNavigation: Story = { render: () => <PathPreview /> };
/** A browser that is the whole page titles it with the current location (h1). */
export const PageTitleLocation: Story = { render: () => <PathPreview pageTitle /> };

function GridLayoutPreview({ columns = 'auto' }: { columns?: SelectionGridColumns }) {
  const text = useStorybookText();
  const [selected, setSelected] = useState(1);
  return (
    <SelectionViewport inset="none">
      <SelectionGrid label={text('Files')} density="workspace" columns={columns}>
        {Array.from({ length: 12 }, (_, index) => (
          <SelectionSurface
            key={index}
            label={index === 0 ? 'Recordings' : `recording-${index}.wav`}
            density="workspace"
            appearance="file"
            selected={selected === index}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                setSelected(index);
              }
            }}
            preview={
              <SelectionThumbnail
                size="workspace"
                icon={index === 0 ? <IconFolder aria-hidden /> : <IconFile aria-hidden />}
              />
            }
          />
        ))}
      </SelectionGrid>
    </SelectionViewport>
  );
}
export const GridColumns: StoryObj<{ columnsMode: 'automatic' | 'fixed' | 'responsive' }> = {
  args: { columnsMode: 'automatic' },
  argTypes: { columnsMode: { control: 'radio', options: ['automatic', 'fixed', 'responsive'] } },
  render: ({ columnsMode }) => (
    <GridLayoutPreview
      columns={columnsMode === 'fixed' ? 3 : columnsMode === 'responsive' ? { base: 3, sm: 6, lg: 'auto' } : 'auto'}
    />
  ),
};

function FileIconsPreview() {
  const text = useStorybookText();
  const [selected, setSelected] = useState<Record<string, number>>({ small: 1, medium: 1, large: 1 });
  return (
    <LayoutStack gap="lg">
      {(['small', 'medium', 'large'] as const).map((iconSize) => (
        <SelectionViewport key={iconSize} inset="none">
          <SelectionGrid label={text('Files')} density="workspace" iconSize={iconSize} spacing="standard">
            {Array.from({ length: 12 }, (_, index) => (
              <SelectionSurface
                key={index}
                label={`recording-${index + 1}.wav`}
                density="workspace"
                appearance="file"
                iconSize={iconSize}
                selected={selected[iconSize] === index}
                onClick={() => setSelected((value) => ({ ...value, [iconSize]: index }))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelected((value) => ({ ...value, [iconSize]: index }));
                  }
                }}
                preview={<SelectionThumbnail icon={index === 0 ? <IconFolder /> : <IconFile />} />}
              />
            ))}
          </SelectionGrid>
        </SelectionViewport>
      ))}
    </LayoutStack>
  );
}
export const FileIcons: Story = { render: () => <FileIconsPreview /> };
