import { LayoutInline as DsLayoutInline } from '@/components/core/Layout';
import { Text as DsText } from '@/components/core/Typography';
import { localizeFixtureTree, useStorybookText } from '@/.storybook/fixture-i18n';
import { useState } from 'react';
import { Button, type ControlTone, type ControlEmphasis } from '@/components/core/Button';
import { PreviewFrame, type PreviewState } from '@/stories/shared/PreviewFrame';

export function ButtonPreview({
  state = 'ready',
  tone = 'neutral',
  emphasis = 'medium',
}: {
  state?: PreviewState;
  tone?: ControlTone;
  emphasis?: ControlEmphasis;
}) {
  const fixtureText = useStorybookText();
  const [count, setCount] = useState(0);
  return localizeFixtureTree(
    <PreviewFrame
      title="Button · intent and state"
      description="Activate with a pointer, Enter, or Space. Controls expose the semantic tone, emphasis, and loading / disabled states."
    >
      <DsLayoutInline>
        <Button
          tone={tone}
          emphasis={emphasis}
          loading={state === 'pending'}
          disabled={state === 'disabled'}
          onClick={() => setCount((value) => value + 1)}
        >
          Add marker
        </Button>
        <Button tone="neutral" emphasis="low" onClick={() => setCount(0)}>
          Reset
        </Button>
      </DsLayoutInline>
      <DsText size="sm" role="status" aria-live="polite">
        {fixtureText('{count} markers added', { count })}
      </DsText>
    </PreviewFrame>,
    fixtureText,
  );
}
