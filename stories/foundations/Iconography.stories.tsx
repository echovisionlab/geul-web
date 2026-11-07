import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs';
import { IconX, IconMenu2, IconPlus, IconChevronDown, IconGripVertical, IconSearch } from '@tabler/icons-react';
import { IconButton } from '@/components/core/IconButton';
import { LayoutGrid, LayoutInline, LayoutStack } from '@/components/core/Layout';
import { Text } from '@/components/core/Typography';
import { primitiveTokens } from '@echovisionlab/design-system/tokens';
import {
  CodeExample,
  DocSection,
  DocTable,
  FoundationDoc,
  LocalizedSpecimen,
  SourceNote,
  StoryLink,
  useFoundationUI,
} from './FoundationDocs';
import classes from './FoundationDocs.module.css';

const glyphs = [
  ['Close', '닫기', IconX],
  ['Menu', '메뉴', IconMenu2],
  ['Add', '추가', IconPlus],
  ['Expand', '펼치기', IconChevronDown],
  ['Drag', '이동', IconGripVertical],
  ['Search', '검색', IconSearch],
] as const;
function Iconography() {
  const ui = useFoundationUI();
  const [count, setCount] = useState(0);
  return (
    <FoundationDoc
      title="Iconography: glyph and target"
      description="Visible glyph bounds, the SVG frame, control target and parent gap are separate measurements. Review each before changing shared icon geometry."
    >
      <DocSection title="Production contract">
        <DocTable
          caption="Different dimensions, different owners"
          columns={['Measurement', 'Current contract', 'Owner']}
          rows={[
            ['Source viewBox', 'Tabler outline icons preserve their 24 × 24 source geometry.', '@tabler/icons-react'],
            ['SVG frame', primitiveTokens.chrome['icon-size'], 'Core Control.module.css'],
            [
              'Visible path',
              'Varies by glyph; do not assume that every shape fills the frame.',
              'Original glyph; review optically per consumer.',
            ],
            ['IconButton padding', '0', 'Core Control.module.css'],
            ['Fine target', 'xs/sm/md/lg/xl + compact/chrome', 'IconButton / row and density context'],
            ['Coarse minimum', primitiveTokens.interaction.touch, 'any-pointer: coarse → interaction minimum'],
            ['External distance', 'Layout gap="action-group" / named spacing', 'Composition'],
          ]}
        />
        <Text size="sm">
          A 16px SVG can contain an 8px close path. Its internal empty area is not button padding. Preserve the source
          aspect ratio, path and optical center; do not crop or uniformly enlarge all glyphs to hide target clearance.
        </Text>
        <SourceNote>
          components/core/Control.module.css · components/core/IconButton/IconButton.tsx ·
          components/core/design-tokens.ts
        </SourceNote>
      </DocSection>
      <DocSection title="Same glyph, separate frames">
        <Text size="sm">
          Left: the 16px SVG frame. Right: the actual xs IconButton target, with zero padding. The outlines belong only
          to this review fixture. Add increments the local count; the remaining controls are disabled geometry samples.
        </Text>
        <LocalizedSpecimen>
          <LayoutGrid columns={{ base: 1, sm: 2, md: 3 }} gap="lg">
            {glyphs.map(([english, korean, Glyph]) => (
              <LayoutStack key={english} gap="xs">
                <Text size="sm" weight="medium">
                  {english}
                </Text>
                <LayoutInline gap="action-group" align="center">
                  <span className={classes.glyphFrame} aria-hidden>
                    <Glyph />
                  </span>
                  <span className={classes.targetFrame}>
                    <IconButton
                      size="xs"
                      label={ui(english, korean)}
                      disabled={english !== 'Add'}
                      onClick={english === 'Add' ? () => setCount((value) => value + 1) : undefined}
                    >
                      <Glyph />
                    </IconButton>
                  </span>
                </LayoutInline>
              </LayoutStack>
            ))}
          </LayoutGrid>
        </LocalizedSpecimen>
        <LocalizedSpecimen>
          <Text role="status" size="sm">
            {ui(`Local add count: ${count}`, `로컬 추가 개수: ${count}`)}
          </Text>
        </LocalizedSpecimen>
        <CodeExample>{`<IconButton label={addLabel} size="xs" onClick={add}>\n  <IconPlus />\n</IconButton>`}</CodeExample>
      </DocSection>
      <DocSection title="Use and review">
        <Text size="sm">
          Icon-only commands require a contextual accessible name. Decorative glyphs do not repeat that name.
          Disclosure/menu chevrons follow the label; drag handles precede the row and connect to real drag behavior and
          keyboard alternatives. Pending state replaces the glyph and badge with the Core progress indicator while
          preserving the command name.
        </Text>
        <Text size="sm">
          Compare CSS frame, path bounds, stroke, target, padding and external gap in an actual consumer. Path bounding
          rectangles do not certify painted ink area. Carbon icon usage is a reference for separating live area and
          target clearance; its dimensions are not automatically Geul defaults.
        </Text>
        <StoryLink id="core-actions-iconbutton--optical-glyph-comparison">Core optical glyph comparison</StoryLink>
        <StoryLink id="core-actions-iconbutton--pending-transition">Actual pending transition</StoryLink>
        <StoryLink id="foundations-size-and-density--reference">Targets and density</StoryLink>
      </DocSection>
    </FoundationDoc>
  );
}
const meta = {
  title: 'Foundations/Iconography',
  component: Iconography,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta<typeof Iconography>;
export default meta;
export const GlyphAndTarget: StoryObj<typeof meta> = {};
