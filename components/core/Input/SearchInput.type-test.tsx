import { SearchInput } from './SearchInput';

<SearchInput aria-label="Search" placeholder="Search" size="xs" density="compact" grow />;
// @ts-expect-error SearchInput owns search semantics.
<SearchInput aria-label="Search" type="text" />;
// @ts-expect-error SearchInput owns the leading glyph.
<SearchInput aria-label="Search" leftSection={<span />} />;
// @ts-expect-error Visual overrides remain closed.
<SearchInput aria-label="Search" className="search" />;
