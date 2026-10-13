import { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { Button } from '@/components/core/Button';
import { TextInput } from '@/components/core/Input';
import { LayoutGrid, LayoutInline } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { TextButton } from '@/components/core/TextButton';
import { primitiveTokens } from '@/components/core/design-tokens';
import { theme } from '@/theme';
import {
  DocSection,
  DocTable,
  FoundationDoc,
  LocalizedSpecimen,
  SourceNote,
  StoryLink,
  useFoundationUI,
} from './FoundationDocs';

function AccessibilityMotion() {
  const ui = useFoundationUI();
  const [value, setValue] = useState('');
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return (
    <FoundationDoc
      title="Accessibility and motion"
      description="The target is WCAG 2.2 AA. Criteria guide implementation and task review; this page does not claim product conformance."
    >
      <DocSection title="Review criteria">
        <DocTable
          caption="Applicable criteria and product policy"
          columns={['Area', 'Requirement', 'Reference']}
          rows={[
            [
              'Text contrast',
              '4.5:1 for normal text; 3:1 for qualifying large text. Apply stated exceptions.',
              '1.4.3',
            ],
            ['Non-text contrast', '3:1 for applicable identifying controls and states.', '1.4.11'],
            [
              'Targets',
              'AA: 24×24 CSS px or stated exception; Geul coarse-input minimum: 44px at 16px root.',
              '2.5.8 / Core policy',
            ],
            [
              'Focus and keyboard',
              'Visible focus, logical order, no traps and no complete focus obscuration.',
              '2.1.1 / 2.1.2 / 2.4.7 / 2.4.11',
            ],
            [
              'Content resize',
              'Review 320px reflow, 200% text resize and user text spacing; applicable 2D exceptions remain explicit.',
              '1.4.4 / 1.4.10 / 1.4.12',
            ],
            [
              'Semantics',
              'Name, role, value, state, label relations, errors and status feedback.',
              '1.3.1 / 3.3.1 / 4.1.2 / 4.1.3',
            ],
          ]}
        />
        <TextButton href="https://www.w3.org/TR/WCAG22/" appearance="accent" size="sm" target="_blank" rel="noreferrer">
          W3C · WCAG 2.2
        </TextButton>
        <Text size="sm">
          Keep names and explanations separate. Visible labels remain part of the accessible name. Color alone cannot
          communicate state. Required names and relations belong in Core contracts; a11y fixes do not authorize changing
          product copy or layout.
        </Text>
      </DocSection>
      <DocSection title="Availability states are different">
        <LocalizedSpecimen>
          <LayoutGrid columns={{ base: 1, sm: 2 }} gap="lg">
            <TextInput
              label={ui('Editable draft', '편집 가능한 초안')}
              description={ui('The value can change.', '값을 변경할 수 있습니다.')}
              value={value}
              onChange={(event) => setValue(event.currentTarget.value)}
            />
            <TextInput
              label={ui('Read-only draft', '읽기 전용 초안')}
              description={ui(
                'Readable and selectable; editing is blocked.',
                '읽기·선택이 가능하고 편집은 차단됩니다.',
              )}
              value={ui('Published draft', '게시한 초안')}
              readOnly
            />
            <TextInput
              label={ui('Unavailable draft', '사용할 수 없는 초안')}
              description={ui('Unavailable in this context.', '현재 맥락에서 사용할 수 없습니다.')}
              value=""
              disabled
            />
            <TextInput
              label={ui('Draft title with error', '오류가 있는 초안 제목')}
              value={value}
              onChange={(event) => setValue(event.currentTarget.value)}
              error={ui('Enter a title before publishing.', '게시 전에 제목을 입력하세요.')}
            />
          </LayoutGrid>
        </LocalizedSpecimen>
        <LocalizedSpecimen>
          <LayoutInline gap="action-group" wrap="wrap">
            <Button disabled>{ui('Unavailable action', '사용 불가 동작')}</Button>
            <Button loading>{ui('Saving draft', '초안 저장 중')}</Button>
          </LayoutInline>
        </LocalizedSpecimen>
        <Text size="sm">
          These are live state specimens. Pending blocks duplicate execution and reports progress; it is not the same as
          an unavailable action. Review keyboard behavior and announcements in the actual user flow.
        </Text>
      </DocSection>
      <DocSection title="Motion source and reduced motion">
        <DocTable
          caption="primitiveTokens.motion / theme"
          columns={['Role', 'Value']}
          rows={[
            ...Object.entries(primitiveTokens.motion),
            ['respectReducedMotion', String(theme.respectReducedMotion)],
            [
              'prefers-reduced-motion: reduce',
              reducedMotion === null ? 'Reading browser setting' : String(reducedMotion),
            ],
          ]}
        />
        <Text size="sm">
          Motion communicates change, not decoration. Core controls use the shared durations and stop their indicator
          transitions/spinner animation under reduced motion. Essential state and progress text remain readable. Review
          other media and feature animations separately.
        </Text>
        <SourceNote>components/core/design-tokens.ts · theme.ts · components/core/Control.module.css</SourceNote>
      </DocSection>
      <DocSection title="Public page playback">
        <Text size="sm">
          Marquee pause reveals every resolved item in a wrapping static group. Immersive pause stops owned playback,
          canvas frames, rotation and pointer effects. Its information disclosure provides every authored title,
          description and attribution; reduced motion opens that path by default. Authored copy must still explain
          meaningful visual assets. The renderer does not infer an equivalent description from a mesh or texture.
        </Text>
        <StoryLink id="feature-page-motion--marquee">Marquee pause and static items</StoryLink>
        <StoryLink id="feature-page-motion--immersive-autoplay">Immersive autoplay and complete information</StoryLink>
        <StoryLink id="feature-page-motion--immersive-scroll">Immersive scroll and reduced motion</StoryLink>
        <SourceNote>
          features/page/blocks/marquee/MarqueeView.tsx · features/page/blocks/immersive-scene/SceneRenderer.tsx
        </SourceNote>
      </DocSection>
      <DocSection title="Execution and limits">
        <Text size="sm">
          Use the a11y panel for rule findings and interaction stories for reproducible keyboard flows. Manually check
          focus, reading order, error recovery, zoom, touch and assistive technology. Automated results cover only their
          executed assertions; VoiceOver/Orca review is separate.
        </Text>
        <StoryLink id="core-interaction-accessibility--keyboard-form-submission">Keyboard form submission</StoryLink>
        <StoryLink id="core-interaction-accessibility--keyboard-menu-navigation">Keyboard menu navigation</StoryLink>
        <StoryLink id="core-interaction-accessibility--keyboard-dialog-focus">Dialog focus management</StoryLink>
        <StoryLink id="core-actions-iconbutton--pending-transition">IconButton pending transition</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Accessibility and Motion',
  component: AccessibilityMotion,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof AccessibilityMotion>;
export default meta;
export const Criteria: StoryObj<typeof meta> = {};
