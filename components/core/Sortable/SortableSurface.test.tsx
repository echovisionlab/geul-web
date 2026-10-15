import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SortableSurface } from './SortableSurface';
import { ReorderRow } from './ReorderRow';
import { IconButton } from '../IconButton';
import { Button } from '../Button';
import { TextButton } from '../TextButton';
describe('Core reorder surface', () => {
  it('translates the complete renderer without applying the sensor scale', () => {
    const html = renderToStaticMarkup(
      <SortableSurface
        motion={{ transform: { x: 14, y: 29, scaleX: 0.5, scaleY: 0.7 }, transition: undefined, isDragging: true }}
      >
        <ReorderRow
          handle={<IconButton label="Move" interaction="drag-handle" />}
          actions={<IconButton label="Delete" size="sm" />}
        >
          <Button size="lg">Expanded fields</Button>
          <TextButton controlSize="md">Row label</TextButton>
        </ReorderRow>
      </SortableSurface>,
    );
    expect(html).toContain('translate3d(14px, 29px, 0)');
    expect(html).not.toContain('scale');
    expect(html).toContain('Expanded fields');
    expect(html).toContain('data-size="compact"');
    expect(html.match(/data-control-size="compact"/g)).toHaveLength(4);
  });
});
