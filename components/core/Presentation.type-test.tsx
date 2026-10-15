import { Text, Heading } from './Typography';
import { SectionCard } from './Section';
import { Alert } from './Alert';
import { LabelBadge } from './Badge';
import { Progress } from './Progress';
/** These assertions prove that unsafe variable spreads are rejected as well as direct JSX props. */
export function PresentationContract() {
  const safe = (
    <SectionCard padding={{ base: 'none', sm: 'md' }} layout="stack" grow>
      <Heading level={1} scale={2}>
        Title
      </Heading>
      <Text size="sm" weight="medium" tone="secondary">
        Body
      </Text>
    </SectionCard>
  );
  const unsafe = { style: { color: 'pink' }, className: 'override' };
  // @ts-expect-error Typography cannot override its own presentation.
  const text = <Text {...unsafe} />;
  // @ts-expect-error Heading uses a bounded scale rather than a font literal.
  const heading = <Heading scale={24} />;
  // @ts-expect-error Surfaces consume registered spacing only.
  const surface = <SectionCard padding="12px" />;
  // @ts-expect-error Responsive insets also consume registered spacing only.
  const responsiveSurface = <SectionCard padding={{ base: 12 }} />;
  // @ts-expect-error Shared surface colors are finite appearances.
  const color = <SectionCard bg="red" />;
  // @ts-expect-error Alert runtime projection also excludes variable style overrides.
  const alert = <Alert {...unsafe} />;
  // @ts-expect-error Badge sizes are finite.
  const badge = <LabelBadge size={11} />;
  // @ts-expect-error Dismiss controls always require an accessible label.
  const dismiss = <LabelBadge onDismiss={() => {}} />;
  // @ts-expect-error Progress exposes semantic tone rather than arbitrary colors.
  const progress = <Progress value={20} color="red" />;
  return (
    <>
      {safe}
      {text}
      {heading}
      {surface}
      {responsiveSurface}
      {color}
      {alert}
      {badge}
      {dismiss}
      {progress}
    </>
  );
}
