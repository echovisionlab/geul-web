import { ImageUploadField } from './ImageUploadField';

const preview = { mode: 'circle' as const };
const quietRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="medium" />;
const strongRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="strong" />;
// @ts-expect-error Removal exposes only the default medium and explicit strong contract.
const foreignRemoval = <ImageUploadField alt="Profile image" preview={preview} removeButtonEmphasis="low" />;

void [quietRemoval, strongRemoval, foreignRemoval];
