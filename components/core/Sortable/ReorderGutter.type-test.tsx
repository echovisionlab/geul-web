import { ReorderGutter } from './ReorderGutter';
<ReorderGutter visibility="active" handle={<button type="button" aria-label="Move block" />}>
  Editor content
</ReorderGutter>;
// @ts-expect-error Gutter geometry and visibility rules belong to Core.
<ReorderGutter style={{ left: -80 }}>Handle</ReorderGutter>;
// @ts-expect-error A caller cannot enlarge the compact track.
<ReorderGutter size="xl">Handle</ReorderGutter>;
