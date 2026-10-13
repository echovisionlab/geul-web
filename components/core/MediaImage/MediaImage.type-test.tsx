import { MediaImage, type MediaImageProps } from './MediaImage';
<MediaImage src="/cover.png" alt="Cover" width={72} height={72} fit="contain" />;
<MediaImage src="/cover.png" alt="Cover" fill />;
// @ts-expect-error Media interface skins remain Core owned.
<MediaImage src="/cover.png" alt="Cover" style={{ opacity: 0.5 }} />;
// @ts-expect-error Slot classes cannot override media presentation.
<MediaImage src="/cover.png" alt="Cover" className="skin" />;
// @ts-expect-error Interface radius is not authored media geometry.
<MediaImage src="/cover.png" alt="Cover" radius="md" />;
// @ts-expect-error Media geometry cannot carry arbitrary CSS expressions.
<MediaImage src="/cover.png" alt="Cover" width="calc(100% - 10px)" />;
// @ts-expect-error Reserved state marker cannot be overridden through typed props.
const reserved: MediaImageProps = { alt: 'Cover', 'data-geul-media-fill': true };
void reserved;
