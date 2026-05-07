import type { TransformerKind } from './transformer.js';

export type Style = {
  fill?: string;
  fillOpacity?: number | string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeOpacity?: number | string;
  rx?: string | number;
};

export type Point = [number, number];

export type Attrs = {
  pos: Point;
  dim: Point;
  label: Point;
  flip: boolean;
  rot: 0 | 1 | 2 | 3;
  bus: boolean;
  weight: number;
  color: string;
  kind: TransformerKind;
};
