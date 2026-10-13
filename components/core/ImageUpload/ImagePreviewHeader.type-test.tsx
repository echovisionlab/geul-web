import { ImagePreviewHeader, type ImagePreviewHeaderProps } from './ImagePreviewHeader';

<ImagePreviewHeader label="OG Image" actions={<button type="button">Regenerate</button>} />;
// @ts-expect-error Shared media labels do not accept local visual overrides.
<ImagePreviewHeader label="OG Image" style={{ minHeight: 45 }} />;
const overridden = { label: 'OG Image', className: 'custom-header' };
// @ts-expect-error Visual overrides in typed spreads are also rejected.
const invalid: ImagePreviewHeaderProps = overridden;
void invalid;
