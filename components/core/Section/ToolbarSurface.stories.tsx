import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { ToolbarSurface } from './ToolbarSurface';
import { IconAlignLeft, IconBold, IconItalic } from '@tabler/icons-react';
import { IconButton } from '../IconButton';
import { TextInput } from '../Input/TextInput';
import { localizedRender } from '../../../.storybook/fixture-i18n';
const meta = {
  title: 'Core/Layout/ToolbarSurface',
  component: ToolbarSurface,
  args: { label: 'Formatting' },
} satisfies Meta<typeof ToolbarSurface>;
export default meta;
export const Formatting: StoryObj<typeof meta> = {
  render: localizedRender((args) => {
    const [bold, setBold] = useState(false);
    const [italic, setItalic] = useState(false);
    const [left, setLeft] = useState(false);
    return (
      <ToolbarSurface {...args}>
        <IconButton label="Bold" pressed={bold} onClick={() => setBold(!bold)}>
          <IconBold />
        </IconButton>
        <IconButton label="Italic" pressed={italic} onClick={() => setItalic(!italic)}>
          <IconItalic />
        </IconButton>
        <IconButton label="Align left" pressed={left} onClick={() => setLeft(!left)}>
          <IconAlignLeft />
        </IconButton>
      </ToolbarSurface>
    );
  }),
};

export const Compact: StoryObj<typeof meta> = { ...Formatting, args: { density: 'compact' } };
export const Embedded: StoryObj<typeof meta> = {
  ...Formatting,
  args: { density: 'compact', appearance: 'embedded', width: 'full' },
};

export const HeaderCommands: StoryObj<typeof meta> = {
  ...Formatting,
  args: { appearance: 'inline' },
};

export const NavigationStates: StoryObj<typeof meta> = {
  args: { label: 'Document actions', density: 'compact', appearance: 'embedded', width: 'full' },
  render: localizedRender((args) => (
    <ToolbarSurface {...args}>
      <TextInput aria-label="Search document" placeholder="Search document" />
      <IconButton label="Bold">
        <IconBold />
      </IconButton>
      <IconButton label="Updating alignment" loading>
        <IconAlignLeft />
      </IconButton>
      <IconButton label="Unavailable italic" disabled>
        <IconItalic />
      </IconButton>
      <span hidden>
        <IconButton label="Hidden command">
          <IconItalic />
        </IconButton>
      </span>
      <ToolbarSurface label="Secondary actions" appearance="inline" density="comfortable">
        <IconButton label="Align left">
          <IconAlignLeft />
        </IconButton>
      </ToolbarSurface>
    </ToolbarSurface>
  )),
};
