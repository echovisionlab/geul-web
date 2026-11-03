import { IconButton } from './IconButton';
<IconButton interaction="drag-handle" label="Move" draggable={false} onKeyDown={() => {}} />;
<IconButton size="sm" label="Remove" />;
// @ts-expect-error Sensor geometry cannot be enlarged by a consumer.
<IconButton interaction="drag-handle" label="Move" size="sm" />;
const oversized = { size: 'touch' as const };
// @ts-expect-error Variable spreads cannot reintroduce action geometry.
<IconButton interaction="drag-handle" label="Move" {...oversized} />;
// @ts-expect-error A drag activator cannot be a navigation link.
<IconButton interaction="drag-handle" label="Move" href="/" />;

// @ts-expect-error A meaningful icon command needs an explicit accessible name.
<IconButton />;
// @ts-expect-error Accessible name channels are mutually exclusive.
<IconButton label="Edit" aria-label="Edit record" />;
// @ts-expect-error Reorder handles do not submit or reset forms.
<IconButton label="Move" interaction="drag-handle" type="submit" />;
// @ts-expect-error Navigation-only options require href even in a union prop object.
const actionNavigation: import('./IconButton').IconButtonProps = { label: 'Edit', target: '_blank' };
void actionNavigation;

<IconButton label="Edit" type="button" />;
<IconButton aria-label="Edit record" type="reset" loading />;
<IconButton aria-labelledby="external-label" href="/records" target="_blank" prefetch={false} />;

<IconButton label="Bold" pressed={false} />;
<IconButton label="Bold" pressed />;
// @ts-expect-error A toggle's selected appearance is owned by Core, not by caller tone.
<IconButton label="Bold" pressed tone="accent" />;
// @ts-expect-error A toggle's selected appearance is owned by Core, not by caller emphasis.
<IconButton label="Bold" pressed={false} emphasis="medium" />;
// @ts-expect-error Toggle state uses the pressed prop so Core owns its semantics and appearance.
<IconButton label="Bold" aria-pressed />;
// @ts-expect-error Navigation links are not toggles.
<IconButton label="Records" href="/records" pressed />;
// @ts-expect-error A reorder sensor is not a toggle.
<IconButton label="Move" interaction="drag-handle" pressed />;
<IconButton label="Move" interaction="drag-handle" aria-pressed={undefined} />;
// @ts-expect-error The duplicate geometry prop was removed; use size.
<IconButton label="Remove" controlSize="xs" />;

<IconButton
  label="Remove avatar"
  appearance="media-overlay"
  placement="overlay-end-inside"
  tone="danger"
  emphasis="strong"
/>;
// @ts-expect-error Small media visuals have fixed Core geometry, independent of action sizes.
<IconButton label="Remove avatar" appearance="media-overlay" placement="overlay-end-inside" size="xs" />;
// @ts-expect-error Media visuals are only offered within the media they act on.
<IconButton label="Remove avatar" appearance="media-overlay" placement="inline" />;
// @ts-expect-error The media overlay appearance is for commands, not navigation.
<IconButton label="Open image" appearance="media-overlay" placement="overlay-end-inside" href="/image" />;
// @ts-expect-error Media commands cannot be used as toggles.
<IconButton label="Select image" appearance="media-overlay" placement="overlay-end-inside" pressed />;
// @ts-expect-error Core owns the circular badge shape.
<IconButton label="Remove avatar" appearance="media-overlay" placement="overlay-end-inside" shape="square" />;
