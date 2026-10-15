import { MenuPreview } from '@/stories/shared/ControlPreviews';
import { localizedRender } from '@/.storybook/fixture-i18n';
import { forwardRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { IconArchive, IconDownload, IconFile, IconFolder } from '@tabler/icons-react';
import type { Meta, StoryObj } from '@storybook/nextjs';

import { Button, type ButtonActionProps } from '../Button';
import { DropdownMenu } from './DropdownMenu';
import { OnDemandDropdownMenu } from './OnDemandDropdownMenu';
import { DOCUMENT_COLOR_VALUES, type DocumentColor } from '../DocumentColorPreview';
import { LayoutInline } from '../Layout';

const DropdownMenuTrigger = forwardRef<HTMLButtonElement, ButtonActionProps>(({ children, ...props }, ref) => {
  return (
    <Button ref={ref} {...props} size="sm" tone="neutral" emphasis="medium">
      {children}
    </Button>
  );
});

DropdownMenuTrigger.displayName = 'DropdownMenuTrigger';

const meta: Meta<typeof DropdownMenu> = {
  title: 'Core/Navigation/DropdownMenu',
  component: DropdownMenu,
  tags: ['core-dropdown-menu'],
  parameters: { layout: 'centered' },
};

export default meta;
type Story = StoryObj<typeof DropdownMenu>;

function ChoiceMenu({
  icons = false,
  disabled = false,
  long = false,
}: {
  icons?: boolean;
  disabled?: boolean;
  long?: boolean;
}) {
  const [selected, setSelected] = useState('');
  const options = long
    ? [
        'Quarterly planning and operational review workspace',
        'Customer delivery acceptance requirements and sign-off checklist',
      ]
    : ['Private', 'Unlisted', 'Public'];
  return (
    <DropdownMenu defaultOpened={!icons && !disabled && !long} size={long ? 'expanded' : 'standard'} portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>{selected || (long ? 'Workspace' : 'Visibility')}</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        {options.map((label, index) => (
          <DropdownMenu.Item
            key={label}
            selected={selected === label}
            icon={
              icons
                ? [<IconFile key="file" />, <IconFolder key="folder" />, <IconArchive key="archive" />][index]
                : undefined
            }
            onClick={() => setSelected(label)}
          >
            {label}
          </DropdownMenu.Item>
        ))}
        {disabled && <DropdownMenu.Item disabled>Organization only</DropdownMenu.Item>}
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
export const DefaultCommandDropdownMenu: Story = { render: localizedRender(() => <ChoiceMenu />) };
export const IconItems: Story = { render: localizedRender(() => <ChoiceMenu icons />) };
function DocumentColorMenu() {
  const t = useTranslations('editorCommon.editor');
  const [selected, setSelected] = useState<Record<'text' | 'background', DocumentColor>>({
    text: 'default',
    background: 'default',
  });
  return (
    <LayoutInline gap="xxs">
      {(['text', 'background'] as const).map((kind) => (
        <DropdownMenu key={kind} portal={false} size="compact">
          <DropdownMenu.Target>
            <DropdownMenuTrigger>{t(`colors.${kind}`)}</DropdownMenuTrigger>
          </DropdownMenu.Target>
          <DropdownMenu.Dropdown>
            <DropdownMenu.Section label={t(`colors.${kind}`)}>
              {DOCUMENT_COLOR_VALUES.map((color) => (
                <DropdownMenu.Item
                  key={color}
                  colorPreview={{ kind, color }}
                  selected={selected[kind] === color}
                  onClick={() => setSelected((value) => ({ ...value, [kind]: color }))}
                >
                  {t(`colors.names.${color}`)}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Section>
          </DropdownMenu.Dropdown>
        </DropdownMenu>
      ))}
    </LayoutInline>
  );
}

export const DocumentColors: Story = { render: () => <DocumentColorMenu /> };

export const DisabledItems: Story = { render: localizedRender(() => <ChoiceMenu disabled />) };
function FormatMenu() {
  const [format, setFormat] = useState('Plain text');
  return (
    <DropdownMenu size="wide" portal={false}>
      <DropdownMenu.Target>
        <DropdownMenuTrigger>{format}</DropdownMenuTrigger>
      </DropdownMenu.Target>
      <DropdownMenu.Dropdown>
        <DropdownMenu.Item selected={format === 'Plain text'} onClick={() => setFormat('Plain text')}>
          Plain text
        </DropdownMenu.Item>
        <DropdownMenu.Sub size="wide">
          <DropdownMenu.Sub.Target icon={<IconDownload />}>Document format</DropdownMenu.Sub.Target>
          <DropdownMenu.Sub.Dropdown>
            {['Portable Document Format (PDF)', 'OpenDocument Text'].map((label) => (
              <DropdownMenu.Item key={label} selected={format === label} onClick={() => setFormat(label)}>
                {label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Sub.Dropdown>
        </DropdownMenu.Sub>
      </DropdownMenu.Dropdown>
    </DropdownMenu>
  );
}
export const NestedDropdownMenu: Story = { render: localizedRender(() => <FormatMenu />) };
export const LongLabels: Story = { render: localizedRender(() => <ChoiceMenu long />) };

// Stateful examples share this component's catalog entry with its fixed states.
type PlaygroundStory = StoryObj<typeof MenuPreview>;
export const Playground: PlaygroundStory = {
  render: () => <MenuPreview />,
  args: {},
  argTypes: {},
  parameters: { layout: 'fullscreen', canvasInset: 'none' },
};

function OnDemandChromeMenuPreview() {
  const [locale, setLocale] = useState('English');
  return (
    <OnDemandDropdownMenu size="wide" placement="bottom-end" defaultOpened portal={false}>
      <OnDemandDropdownMenu.Target>
        <DropdownMenuTrigger>{locale}</DropdownMenuTrigger>
      </OnDemandDropdownMenu.Target>
      <OnDemandDropdownMenu.Dropdown>
        {['English', '한국어', '日本語'].map((label) => (
          <OnDemandDropdownMenu.Item key={label} selected={label === locale} onClick={() => setLocale(label)}>
            {label}
          </OnDemandDropdownMenu.Item>
        ))}
      </OnDemandDropdownMenu.Dropdown>
    </OnDemandDropdownMenu>
  );
}

/**
 * `OnDemandDropdownMenu` for always-present chrome (site header language and account menus): same
 * props, members and markup as `DropdownMenu`; React Aria Menu/Popover load on first hover, focus or
 * press. Storybook preloads the surface, so this preview opens synchronously.
 */
export const OnDemandChromeMenu: Story = { render: localizedRender(() => <OnDemandChromeMenuPreview />) };
