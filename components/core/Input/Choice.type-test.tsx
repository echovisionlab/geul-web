import { Checkbox } from './Checkbox';
import { Radio } from './Radio';
import { Switch } from './Switch';
import { SegmentedControl } from './SegmentedControl';

export const supportedChoices = (
  <>
    <Checkbox aria-label="Approve" checked indeterminate readOnly />
    <Radio.Group label="Visibility" readOnly error="Choose an option" required>
      <Radio value="public" label="Public" />
    </Radio.Group>
    <Switch label="Notifications" defaultChecked onLabel="On" offLabel="Off" />
    <SegmentedControl
      aria-label="View"
      readOnly
      data={[{ value: 'grid', label: 'Grid', accessibleLabel: 'Grid view' }]}
    />
  </>
);
// @ts-expect-error Radio options require an explicit group value.
export const missingRadioValue = <Radio label="Public" />;
// @ts-expect-error Consumer styling cannot replace the shared radio affordance.
export const radioSkin = <Radio value="public" className="other" />;
// @ts-expect-error Switch sizing uses the shared closed scale.
export const switchSize = <Switch size="tiny" />;
// @ts-expect-error Segmented controls do not expose framework styling slots.
export const segmentedSkin = <SegmentedControl data={['Grid']} styles={{ root: { padding: 1 } }} />;
// @ts-expect-error Reserved state markers are controlled by Core.
export const checkboxState: import('./Checkbox').CheckboxProps = { 'data-geul-input-size': 'xl' };

<SegmentedControl aria-label="View" data={[{ value: 'grid', icon: <svg />, accessibleLabel: 'Grid view' }]} />;
// @ts-expect-error Icon-only options require an accessible label.
<SegmentedControl aria-label="View" data={[{ value: 'grid', icon: <svg /> }]} />;
// @ts-expect-error An option is either visible text or an icon, not both.
<SegmentedControl aria-label="View" data={[{ value: 'g', icon: <svg />, label: 'G', accessibleLabel: 'G' }]} />;
