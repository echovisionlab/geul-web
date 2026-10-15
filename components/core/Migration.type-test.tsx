import { ImageUploadField, ImagePreviewFrame, UploadPlaceholder } from './ImageUpload';
import { Carousel } from './Carousel';
import { CommandPalette } from './CommandPalette';
import { notifications } from './Notification';
const unsafe = { style: { color: 'pink' }, className: 'private' };
const safe = (
  <ImageUploadField alt="Artwork" preview={{ mode: 'fixed', aspectRatio: '16 / 9' }} onFileSelect={() => {}} />
);
// @ts-expect-error Upload controls reject styling even through a variable spread.
const upload = <ImageUploadField {...unsafe} alt="Artwork" preview={{ mode: 'fixed' }} />;
// @ts-expect-error Media geometry does not authorize independent frame colors.
const frame = <ImagePreviewFrame alt="Artwork" background="pink" />;
// @ts-expect-error Placeholder icon sizes use shared variants.
const placeholder = <UploadPlaceholder icon={null} iconSize={26} />;
const labels = { region: 'Content', previous: 'Previous', next: 'Next', slide: (page: number) => String(page) };
const gallery = (
  <Carousel labels={labels} slideSize={{ base: '100%', md: '33.333%' }}>
    {safe}
  </Carousel>
);
const wrong = (
  // @ts-expect-error Carousel column fractions are closed.
  <Carousel labels={labels} slideSize="31%">
    {safe}
  </Carousel>
);
const palette = (
  // @ts-expect-error Search controls reject caller skins.
  <CommandPalette
    {...unsafe}
    opened
    onClose={() => {}}
    title="Search"
    closeLabel="Close"
    placeholder="Search"
    query=""
    onQueryChange={() => {}}
  >
    {safe}
  </CommandPalette>
);
// @ts-expect-error Notifications use common status roles instead of arbitrary colors or styling.
notifications.show({ message: 'Saved', ...unsafe });
export const proof = [safe, upload, frame, placeholder, gallery, wrong, palette];
