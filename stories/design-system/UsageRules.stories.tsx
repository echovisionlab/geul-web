import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '@/components/core/Button';
import { LayoutGrid, LayoutInline, LayoutStack } from '@/components/core/Layout';
import { SectionCard } from '@/components/core/Section';
import { Heading, Text } from '@/components/core/Typography';
import { ActionRowSizeProvider } from '@/components/core/control-context';
import { PreviewFrame } from '../shared/PreviewFrame';
import { StorybookLink } from '../shared/StorybookLink';
import { LocalizedSpecimen } from '../foundations/FoundationDocs';
import { useStorybookText } from '../../.storybook/fixture-i18n';

function ActionEmphasisComparison() {
  const uiText = useStorybookText();
  const [action, setAction] = useState<{ correct: boolean; kind: 'cancel' | 'save' }>();
  const examples = [
    {
      title: 'Correct usage',
      reason: 'An ordinary save uses neutral/medium; cancel uses neutral/low. Both consume the row owner’s sm size.',
      correct: true,
    },
    {
      title: 'Incorrect usage',
      reason:
        'Accent/strong on both ordinary commands makes them compete. The props are supported, but their use does not match this task’s contract.',
      correct: false,
    },
  ];
  return (
    <PreviewFrame
      title="Usage rules · action emphasis"
      description="Compare the same ordinary save task using actual Core controls. Clicks only update the local record."
    >
      <div lang="en" dir="ltr">
        <LayoutStack gap="lg">
          <LayoutGrid columns={{ base: 1, md: 2 }} gap="section">
            {examples.map((example) => (
              <SectionCard key={example.title}>
                <LayoutStack gap="md">
                  <Heading level={2} scale={4}>
                    {example.title}
                  </Heading>
                  <Text size="sm">{example.reason}</Text>
                  <ActionRowSizeProvider size="sm">
                    <LocalizedSpecimen>
                      <LayoutInline gap="xs" justify="end">
                        <Button
                          tone={example.correct ? 'neutral' : 'accent'}
                          emphasis={example.correct ? 'low' : 'strong'}
                          onClick={() => setAction({ correct: example.correct, kind: 'cancel' })}
                        >
                          {uiText('Cancel')}
                        </Button>
                        <Button
                          tone={example.correct ? 'neutral' : 'accent'}
                          emphasis={example.correct ? 'medium' : 'strong'}
                          onClick={() => setAction({ correct: example.correct, kind: 'save' })}
                        >
                          {uiText('Save')}
                        </Button>
                      </LayoutInline>
                    </LocalizedSpecimen>
                  </ActionRowSizeProvider>
                </LayoutStack>
              </SectionCard>
            ))}
          </LayoutGrid>
          <div role="status">
            <Text size="sm">
              {'Local action: '}
              {action
                ? `${action.correct ? 'Correct usage' : 'Incorrect usage'} · ${action.kind === 'cancel' ? 'Cancel' : 'Save'}`
                : 'Not executed'}
            </Text>
          </div>
          <Text size="sm">
            FormModal and confirmation Dialogs consume the strong primary-action exception owned by their Core. This
            comparison concerns ordinary commands.
          </Text>
          <StorybookLink href="/?path=/docs/core-actions-button--documentation">
            Button API, states and usage
          </StorybookLink>
          <StorybookLink href="/?path=/story/foundations-spacing--relationships">
            Control padding and external gap ownership
          </StorybookLink>
          <StorybookLink href="/?path=/story/foundations-iconography--glyph-and-target">
            Icon glyph and actual control target
          </StorybookLink>
        </LayoutStack>
      </div>
    </PreviewFrame>
  );
}

const meta = {
  title: 'Design System/Usage Rules',
  component: ActionEmphasisComparison,
  parameters: { canvasInset: 'none', controls: { disable: true } },
} satisfies Meta<typeof ActionEmphasisComparison>;
export default meta;
export const ActionEmphasis: StoryObj<typeof meta> = {};
