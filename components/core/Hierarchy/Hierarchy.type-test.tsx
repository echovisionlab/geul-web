import { Hierarchy, HierarchyIndent } from './Hierarchy';
import { SectionCard } from '../Section';
import { TextButton } from '../TextButton';
<SectionCard nested padding="xs" />;
<TextButton nested density="chrome" href="/child">
  Child
</TextButton>;
// @ts-expect-error Nested is semantic, not arbitrary geometry.
<SectionCard nested={20} />;
// @ts-expect-error Nested is semantic, not arbitrary geometry.
<TextButton nested="md">Child</TextButton>;
<Hierarchy>
  <HierarchyIndent>Child</HierarchyIndent>
</Hierarchy>;
<Hierarchy spacing="md">
  <HierarchyIndent alignment="parent-label" />
</Hierarchy>;
// @ts-expect-error Geometry must use a named system spacing.
<Hierarchy spacing={24} />;
// @ts-expect-error Pixel overrides are not a hierarchy contract.
<Hierarchy spacing="24px" />;
// @ts-expect-error Private geometry cannot be supplied through a typed spread.
<HierarchyIndent {...{ style: { paddingLeft: 24 } }} />;
// @ts-expect-error The alignment role is closed.
<HierarchyIndent alignment="sidebar" />;
// @ts-expect-error State markers belong to Core.
<HierarchyIndent data-geul-hierarchy-indent="content" />;
