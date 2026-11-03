import { ImageUploadField } from './ImageUploadField';

const preview = { mode: 'circle' as const };
const quietRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="medium" />;
const strongRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="strong" />;
const asyncRemoval = <ImageUploadField alt="Profile image" preview={preview} onRemove={async () => {}} />;
// @ts-expect-error Removal exposes only the default medium and explicit strong contract.
const foreignRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="low" />;

void [quietRemoval, strongRemoval, foreignRemoval, asyncRemoval];

<ImageUploadField
  alt="Profile image"
  preview={preview}
  removeButtonPlacement="inside"
  removeButtonAppearance="avatar"
/>;
// @ts-expect-error Removal does not accept per-use badge sizes.
<ImageUploadField alt="Profile image" preview={preview} removeButtonSize={16} />;
// @ts-expect-error Unsupported appearances cannot shrink unrelated image actions.
<ImageUploadField alt="Artwork" preview={{ mode: 'fixed' }} removeButtonAppearance="small" />;
