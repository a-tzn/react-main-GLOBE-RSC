/**
 * Component: VirtualizedTable
 * Reusable virtualized table using react-window
 * Handles large datasets with automatic scrolling and height calculation
 */

import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';

/**
 * Row renderer wrapper - handles dark mode via CSS variables
 */
const Row = ({ index, style, data }) => {
  const rowData = data.rows[index];

  return (
    <div
      style={style}
      className="virtualized-row"
      onClick={() => data.onRowClick?.(rowData, index)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') data.onRowClick?.(rowData, index);
      }}
    >
      {data.renderRow(rowData, index)}
    </div>
  );
};

/**
 * VirtualizedTable Component
 * Props:
 *   rows: Array<Object> - Data rows
 *   renderRow: (row, index) => ReactNode - Function to render each row
 *   onRowClick: (row, index) => void - Click handler
 *   itemSize: number - Height of each row in pixels (default: 50)
 *   height: number - Total visible height (default: 600)
 *   width: number|string - Total width (default: '100%')
 *   className: string - CSS class for container
 *   overscanCount: number - Number of items to overscan (default: 5)
 */
export function VirtualizedTable({
  rows = [],
  renderRow,
  onRowClick,
  itemSize = 50,
  height = 600,
  width = '100%',
  className = '',
  overscanCount = 5
}) {
  const itemCount = rows.length;

  const itemData = useMemo(
    () => ({
      rows,
      renderRow,
      onRowClick
    }),
    [rows, renderRow, onRowClick]
  );

  if (itemCount === 0) {
    return (
      <div
        className={`virtualized-table-empty ${className}`}
        style={{
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--bg-secondary)'
        }}
      >
        No data available
      </div>
    );
  }

  return (
    <div className={`virtualized-table-container ${className}`}>
      <List
        height={height}
        itemCount={itemCount}
        itemSize={itemSize}
        width={width}
        itemData={itemData}
        overscanCount={overscanCount}
      >
        {Row}
      </List>
    </div>
  );
}

export default VirtualizedTable;
