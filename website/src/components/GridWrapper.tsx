// src/components/GridWrapper.tsx
import React from 'react';
import { Grid as MuiGrid, GridProps as MuiGridProps } from '@mui/material';

// Define our extended GridProps interface
interface GridProps extends Omit<MuiGridProps, 'item'> {
  item?: boolean;
  container?: boolean;
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

// Create a wrapper component for Grid
const Grid: React.FC<GridProps> = ({ item, container, children, xs, sm, md, lg, xl, ...props }) => {
  // Create a cleaned props object without the 'item' prop
  const gridProps: any = { ...props };
  
  // Add sizes to the props
  if (xs !== undefined) gridProps.xs = xs;
  if (sm !== undefined) gridProps.sm = sm;
  if (md !== undefined) gridProps.md = md;
  if (lg !== undefined) gridProps.lg = lg;
  if (xl !== undefined) gridProps.xl = xl;
  
  // Only add container prop if it's true (this is still supported in v7)
  if (container) gridProps.container = true;
  
  return (
    <MuiGrid {...gridProps}>
      {children}
    </MuiGrid>
  );
};

export default Grid;