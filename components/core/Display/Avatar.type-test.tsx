import { Avatar } from './Display';

<Avatar name="June Han" size="sm" />;
<Avatar src={null} name={null} alt="June Han" />;
// @ts-expect-error The fallback name is text; Core derives the glyph.
<Avatar name={<span>J</span>} />;
// @ts-expect-error Avatar presentation remains closed.
<Avatar name="June" style={{ fontSize: 12 }} />;
