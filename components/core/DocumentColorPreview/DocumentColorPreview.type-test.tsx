import { DocumentColorPreview } from './DocumentColorPreview';
import { DropdownMenu } from '../DropdownMenu';

<DocumentColorPreview kind="text" textColor="purple" />;
<DocumentColorPreview kind="pair" size="compact" textColor="red" backgroundColor="yellow" />;
<DropdownMenu.Item colorPreview={{ kind: 'background', color: 'pink' }}>Pink</DropdownMenu.Item>;
// @ts-expect-error Arbitrary colors cannot bypass the document palette.
<DocumentColorPreview kind="text" textColor="#ff0000" />;
// @ts-expect-error Feature CSS cannot override Core sample geometry.
<DocumentColorPreview kind="text" style={{ width: 4 }} />;
// @ts-expect-error Typed spreads must preserve the closed visual contract.
<DocumentColorPreview kind="text" {...{ className: 'override' }} />;
// @ts-expect-error Menu samples also use durable document colors.
<DropdownMenu.Item colorPreview={{ kind: 'text', color: '#ff0000' }}>Red</DropdownMenu.Item>;
