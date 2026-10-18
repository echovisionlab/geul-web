import { Disclosure, DisclosureRegion } from './Disclosure';
<Disclosure label="Details" actions={<button type="button">Delete</button>} density="compact" />;
<Disclosure label="Sortable section" chevronPosition="start" withDivider={false} />;
<Disclosure label="Parent" contentIndent="label" leadingActions={<button type="button">Reorder</button>} />;
<Disclosure label="Child" nested />;
<Disclosure label="Navigation group" density="chrome" contentIndent="none" withDivider={false} />;
// @ts-expect-error Density is a closed Core contract.
<Disclosure label="Navigation group" density="dense" />;
// @ts-expect-error Nested is a semantic state, not a pixel override.
<Disclosure label="Child" nested="20px" />;
// @ts-expect-error Content alignment is owned by the closed Core contract.
<Disclosure label="Parent" contentIndent="24px" />;
// @ts-expect-error Chevron placement is a closed Core contract.
<Disclosure label="Details" chevronPosition="top" />;
<DisclosureRegion expanded id="details" labelledBy="trigger">
  <input />
</DisclosureRegion>;
// @ts-expect-error Arbitrary geometry belongs to Core, not a disclosure consumer.
<DisclosureRegion expanded transitionDuration={220} />;
// @ts-expect-error Private CSS overrides are forbidden through typed spreads too.
<DisclosureRegion expanded {...{ style: { padding: 7 } }} />;
// @ts-expect-error Core state markers are reserved.
<DisclosureRegion expanded data-geul-disclosure-region="override" />;
// @ts-expect-error Native hydration does not accept arbitrary color.
const invalidRegion = <Disclosure label="Details" color="red" />;
void invalidRegion;
