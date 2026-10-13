import { ReorderRow } from './ReorderRow';
<ReorderRow indent="parent-label" handle="Handle" actions="Actions" onDragOver={() => {}}>
  Fields
</ReorderRow>;
// @ts-expect-error Row geometry belongs to Core.
<ReorderRow style={{ gap: 30 }} />;
// @ts-expect-error Arbitrary track widths cannot enter via size props.
<ReorderRow handleWidth={50} />;
// @ts-expect-error Private state is owned by the component.
<ReorderRow data-geul-reorder-indent="parent-label" />;
