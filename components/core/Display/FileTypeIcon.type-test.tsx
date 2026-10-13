import { FileTypeIcon } from './FileTypeIcon';
const inline = <FileTypeIcon file={{ mimeType: 'audio/wav' }} size="inline" />;
const preview = <FileTypeIcon file={{ mimeType: 'application/pdf' }} size="preview" />;
// @ts-expect-error File icon dimensions belong to the Core size contract.
const arbitrarySize = <FileTypeIcon file={{ mimeType: 'audio/wav' }} size={17} />;
// @ts-expect-error Consumers cannot override icon appearance.
const styledIcon = <FileTypeIcon file={{ mimeType: 'audio/wav' }} style={{ color: 'red' }} />;
void [inline, preview, arbitrarySize, styledIcon];
