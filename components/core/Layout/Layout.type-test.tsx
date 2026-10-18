import { createRef } from 'react';
<LayoutBleed inline="md">Embedded editor</LayoutBleed>;
// @ts-expect-error Insets remain registered spacing, including compensation.
<LayoutBleed inline={16}>Embedded editor</LayoutBleed>;
const unsafeBleed = { inline: 'md' as const, children: 'Editor', style: { marginInline: -16 } };
// @ts-expect-error Typed spreads cannot replace shared layout geometry.
const invalidBleed: LayoutBleedProps = unsafeBleed;
void invalidBleed;
import {
  LayoutBleed,
  type LayoutBleedProps,
  LayoutContainer,
  LayoutGrid,
  LayoutGridItem,
  LayoutInline,
  LayoutInset,
  LayoutSpacer,
  LayoutStack,
  type LayoutStackProps,
  type Responsive,
  type Space,
} from './index';

/** Compile-time negative contract fixture; never mounted as application UI. */
export function LayoutTypeContract() {
  const ref = createRef<HTMLElement>();
  const spacing: Responsive<Space> = { base: 'xxs', md: 'lg' };
  const safe = (
    <LayoutStack ref={ref} as="section" gap={spacing} aria-label="Content" data-testid="content" onClick={() => {}} />
  );
  const equal = (
    <LayoutGrid columns={{ base: 1, sm: 2, lg: 3 }} gap="md" align="stretch">
      <div />
      <div />
    </LayoutGrid>
  );
  const event = (
    <LayoutGrid columns={12} gap="xl">
      <LayoutGridItem span={{ base: 12, md: 7 }} />
      <LayoutGridItem span={{ base: 12, md: 5 }} />
    </LayoutGrid>
  );
  const named = (
    <LayoutContainer size="compact">
      <LayoutInset space="sm" inline="md">
        <LayoutInline wrap="nowrap" justify="between">
          <span />
          <LayoutSpacer axis="inline" size="xxs" flexible />
        </LayoutInline>
      </LayoutInset>
    </LayoutContainer>
  );
  const relationships = (
    <LayoutStack gap="section">
      <LayoutInline gap="action-group">
        <span>Commands</span>
      </LayoutInline>
    </LayoutStack>
  );
  // @ts-expect-error internal label spacing belongs to the control, not composition API
  const internalGap = <LayoutInline gap="control-label" />;
  // @ts-expect-error no numeric physical gaps
  const numeric = <LayoutStack gap={7} />;
  // @ts-expect-error no arbitrary CSS lengths
  const length = <LayoutStack gap="7px" />;
  // @ts-expect-error every responsive value belongs to Space
  const responsive = <LayoutStack gap={{ md: 7 }} />;
  // @ts-expect-error breakpoints come from the shared registered authority
  const breakpoint = <LayoutStack gap={{ handheld: 'sm' }} />;
  // @ts-expect-error styles cannot become a second presentation authority
  const style = <LayoutInset style={{ opacity: 0.2 }} />;
  // @ts-expect-error CSS selectors cannot become a public presentation override
  const className = <LayoutStack className="alternate" />;
  // @ts-expect-error Mantine slots are private adapter details
  const classes = <LayoutStack classNames={{ root: 'alternate' }} />;
  // @ts-expect-error private variables are not public consumer APIs
  const vars = <LayoutStack vars={() => ({ root: {} })} />;
  // @ts-expect-error unstyled bypass is forbidden
  const unstyled = <LayoutStack unstyled />;
  // @ts-expect-error inherited Box visual props are absent
  const numericBox = <LayoutInline fw={900} p={7} />;
  // @ts-expect-error source geometry is separate from product layout spacing
  const inset = <LayoutInset inline={17} />;
  // @ts-expect-error grid presets are bounded
  const grid = <LayoutGrid columns={13} />;
  // @ts-expect-error grid spans are bounded
  const span = <LayoutGridItem span={13} />;
  // @ts-expect-error arbitrary custom renderers can reconstruct presentation
  const renderer = <LayoutStack as={() => <div />} />;
  // @ts-expect-error internal marker namespace is reserved
  const marker = <LayoutStack data-geul-layout="inline" />;
  // @ts-expect-error all internal geul metadata is reserved
  const state = <LayoutStack data-geul-layout-align="center" />;
  const override = { style: { opacity: 0.2 } };
  // @ts-expect-error an identified spread cannot hide a forbidden override
  const spread = <LayoutStack {...override} />;
  // @ts-expect-error helper-shaped type assignment also rejects an override
  const assignment: LayoutStackProps = { styles: { root: {} } };
  // @ts-expect-error Spacer is purely structural, not an interactive content host
  const spacer = <LayoutSpacer role="button">Content</LayoutSpacer>;
  return (
    <>
      {safe}
      {equal}
      {event}
      {named}
      {relationships}
      {internalGap}
      {numeric}
      {length}
      {responsive}
      {breakpoint}
      {style}
      {className}
      {classes}
      {vars}
      {unstyled}
      {numericBox}
      {inset}
      {grid}
      {span}
      {renderer}
      {marker}
      {state}
      {spread}
      {String(assignment)}
      {spacer}
    </>
  );
}

const responsiveFlow = (
  <LayoutInline
    direction={{ base: 'column', sm: 'row' }}
    wrap={{ base: 'wrap', md: 'nowrap' }}
    justify={{ base: 'start', sm: 'between' }}
    printFlow="stack"
    textAlign="center"
    order={2}
  />
);
const contentGrid = <LayoutGrid columns={{ base: 5, sm: 6 }} rows="stretch" flexible fill="both" />;
// @ts-expect-error orientation is a finite shared choice
const inventedFlow = <LayoutInline direction="diagonal" />;
// @ts-expect-error arbitrary CSS order is not a public layout contract
const inventedOrder = <LayoutStack order={11} />;
void [responsiveFlow, contentGrid, inventedFlow, inventedOrder];

const formContainer = <LayoutContainer size="form" />;
// @ts-expect-error form widths are shared presets, not local CSS lengths
const customFormWidth = <LayoutContainer size="420px" />;
void [formContainer, customFormWidth];
