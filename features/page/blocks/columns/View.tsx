import { Fragment } from 'react';

import type { BlockViewProps } from '../types';
import { parseColumnsProps } from './schema';

// Forward declare to avoid circular dependency - will be passed via context or prop
interface SectionContentRenderer {
  (section: {
    id: string;
    type: string;
    props?: Record<string, unknown>;
    content?: unknown[];
    columns?: unknown[];
  }): React.ReactNode;
}

interface ColumnsViewInternalProps extends BlockViewProps {
  renderSection?: SectionContentRenderer;
}

export function ColumnsView({ props, columns, renderSection }: ColumnsViewInternalProps) {
  const parsedProps = parseColumnsProps(props);
  const { columnRatios, gap } = parsedProps;

  const ratios = columnRatios.split(':').map(Number);
  const gridTemplateColumns = ratios.map((r) => `${r}fr`).join(' ');

  if (!columns || columns.length === 0) {
    return null;
  }

  return (
    <div
      className="columns-section"
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap: `${gap}px`,
      }}
    >
      {columns.map((column) => (
        <div key={column.id} className="column-content">
          {column.sections.map((child) => (
            <Fragment key={child.id}>{renderSection ? renderSection(child) : null}</Fragment>
          ))}
        </div>
      ))}
    </div>
  );
}
