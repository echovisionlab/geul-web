import type { Meta, StoryObj } from '@storybook/nextjs';
import { Hierarchy, HierarchyIndent } from './Hierarchy';
import { Disclosure } from '../Disclosure';
import { LayoutStack } from '../Layout';
import { SectionCard } from '../Section';
import { TextButton } from '../TextButton';
import { Text } from '../Typography';

function HierarchyExample({ spacing, longLabels = false }: { spacing?: 'md' | 'lg' | 'xl'; longLabels?: boolean }) {
  return (
    <div style={{ width: 320, maxWidth: '100%' }}>
      <Hierarchy spacing={spacing}>
        <LayoutStack gap="lg">
          <Disclosure
            label={longLabels ? 'Parent group with a long descriptive label' : 'Parent group'}
            density="compact"
            defaultOpened
            withDivider={false}
          >
            <Disclosure
              nested
              label={longLabels ? 'Child group with a long descriptive label' : 'Child group'}
              density="compact"
              defaultOpened
              withDivider={false}
            >
              <Disclosure
                nested
                label={longLabels ? 'Grandchild group with a long descriptive label' : 'Grandchild group'}
                density="compact"
                defaultOpened
                withDivider={false}
              >
                <Text size="xs">Details aligned with their title</Text>
              </Disclosure>
            </Disclosure>
          </Disclosure>
          <Disclosure label="Navigation group" density="compact" defaultOpened withDivider={false}>
            <TextButton nested href="#child" density="chrome" fullWidth display="flex">
              Child destination
            </TextButton>
          </Disclosure>
          <SectionCard padding="xs" withBorder>
            <Text size="xs">Parent condition group</Text>
            <SectionCard nested padding="xs" withBorder>
              <Text size="xs">Child condition group</Text>
            </SectionCard>
          </SectionCard>
          <LayoutStack gap="xxs">
            <Text size="xs">Parent content</Text>
            <HierarchyIndent>
              <Text id="child" size="xs">
                Child content
              </Text>
              <HierarchyIndent>
                <Text size="xs">Grandchild content</Text>
              </HierarchyIndent>
            </HierarchyIndent>
          </LayoutStack>
        </LayoutStack>
      </Hierarchy>
    </div>
  );
}

const meta = {
  title: 'Core/Layout/Hierarchy',
  component: HierarchyExample,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof HierarchyExample>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SystemDefault: Story = {};
export const NamedSpacing: Story = { args: { spacing: 'md' } };
export const LongLabels: Story = { args: { longLabels: true } };
