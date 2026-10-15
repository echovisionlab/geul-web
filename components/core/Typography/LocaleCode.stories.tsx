import type { Meta, StoryObj } from '@storybook/nextjs';
import { LocaleCode } from './LocaleCode';
import { Text } from './Typography';
import { LayoutInline, LayoutStack } from '../Layout';

const meta = {
  title: 'Core/Typography/LocaleCode',
  component: LocaleCode,
  args: { code: 'en' },
} satisfies Meta<typeof LocaleCode>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {};
export const Regional: Story = { args: { code: 'zh-CN' } };
export const LanguageRows: Story = {
  render: () => (
    <LayoutStack gap="xs">
      {[
        ['English', 'en'],
        ['한국어', 'ko'],
        ['简体中文', 'zh-CN'],
        ['Português (Brasil)', 'pt_BR'],
        ['العربية', 'ar'],
      ].map(([name, code]) => (
        <LayoutInline key={code} gap="xxs">
          <Text size="sm" weight="medium">
            {name}
          </Text>
          <LocaleCode code={code} />
        </LayoutInline>
      ))}
    </LayoutStack>
  ),
};
