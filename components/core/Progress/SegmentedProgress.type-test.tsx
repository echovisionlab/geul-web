import { SegmentedProgress } from './SegmentedProgress';
const segments = [{ id: 'done', value: 50, label: 'Delivered', tone: 'positive' as const }];
<SegmentedProgress label="Delivery" segments={segments} density="compact" />;
// @ts-expect-error Status tones use canonical roles.
<SegmentedProgress label="Delivery" segments={[{ id: 'done', value: 50, label: 'Done', tone: 'green' }]} />;
// @ts-expect-error Caller skins are rejected through variable spreads.
<SegmentedProgress label="Delivery" segments={segments} {...{ style: { height: 9 } }} />;
// @ts-expect-error Accessible labels are supplied by the localized consumer.
<SegmentedProgress segments={segments} />;
