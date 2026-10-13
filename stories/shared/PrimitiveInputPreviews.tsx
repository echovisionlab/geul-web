import { Text as DsText } from '@/components/core/Typography';
import { localizeFixtureTree, useStorybookText } from '../../.storybook/fixture-i18n';
import { useState } from 'react';
import { Checkbox, Select, TextInput } from '@/components/core/Input';
import { PreviewFrame, type PreviewState } from './PreviewFrame';

export function TextInputPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [value, setValue] = useState('Field notes');
  return localizeFixtureTree(
    <PreviewFrame
      title="Text input · controlled value"
      description="Edit the input, then inspect its value or use State to show validation and disabled states."
    >
      <TextInput
        label="Name"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
        disabled={state === 'disabled' || state === 'pending'}
        error={state === 'error' ? 'This name is already in use.' : undefined}
      />
      <DsText role="status" size="sm">
        {fixtureText('Value')}: {value || fixtureText('Empty')}
      </DsText>
    </PreviewFrame>,
    fixtureText,
  );
}

export function SelectPreview({ state = 'ready' }: { state?: PreviewState }) {
  const fixtureText = useStorybookText();
  const [value, setValue] = useState<string | null>('private');
  return localizeFixtureTree(
    <PreviewFrame
      title="Select · controlled value"
      description="Choose an option with a pointer or keyboard. State exposes validation and disabled variants."
    >
      <Select
        label="Visibility"
        value={value}
        onChange={setValue}
        data={[
          { value: 'private', label: 'Private' },
          { value: 'unlisted', label: 'Unlisted' },
          { value: 'public', label: 'Public' },
        ]}
        disabled={state === 'disabled' || state === 'pending'}
        error={state === 'error' ? 'Choose an available visibility.' : undefined}
        allowDeselect={false}
      />
      <DsText role="status" size="sm">
        {fixtureText('Selected: {value}', {
          value: fixtureText(value === 'private' ? 'Private' : value === 'unlisted' ? 'Unlisted' : 'Public'),
        })}
      </DsText>
    </PreviewFrame>,
    fixtureText,
  );
}

export function CheckboxPreview({
  disabled = false,
  indeterminate = false,
}: {
  disabled?: boolean;
  indeterminate?: boolean;
}) {
  const fixtureText = useStorybookText();
  const [checked, setChecked] = useState(false);
  return localizeFixtureTree(
    <PreviewFrame
      title="Checkbox · controlled state"
      description="Toggle the checkbox with a pointer or Space. Controls expose disabled and indeterminate rendering."
    >
      <Checkbox
        label="Notify collaborators"
        checked={checked}
        indeterminate={indeterminate}
        disabled={disabled}
        onChange={(event) => setChecked(event.currentTarget.checked)}
      />
      <DsText role="status" size="sm">
        {fixtureText('Notify collaborators')}: {fixtureText(checked ? 'Enabled' : 'Disabled')}
      </DsText>
    </PreviewFrame>,
    fixtureText,
  );
}
