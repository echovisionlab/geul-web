import { SupportingText } from './SupportingText';
const helper = (
  <SupportingText as="p" role="status" aria-live="polite" tone="positive">
    Saved
  </SupportingText>
);
// @ts-expect-error Supporting typography has one shared size on every viewport.
const size = <SupportingText size="sm" />;
// @ts-expect-error Supporting typography uses regular weight.
const weight = <SupportingText weight="medium" />;
// @ts-expect-error Supporting copy does not expose CSS overrides.
const style = <SupportingText style={{ fontSize: 14 }} />;
void [helper, size, weight, style];
