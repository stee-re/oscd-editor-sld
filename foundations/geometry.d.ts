/**
 * Pure rectangle and point math.
 *
 * All functions here operate on numeric tuples (Rect, Point) with no
 * knowledge of DOM Elements or SCL structure.
 */
export type Point = [number, number];
export type Rect = [number, number, number, number];
export declare function contains([x1, y1, w1, h1]: Rect, [x2, y2, w2, h2]: Rect): boolean;
export declare function overlaps([x1, y1, w1, h1]: Rect, [x2, y2, w2, h2]: Rect): boolean;
export declare function distance([x1, y1]: Point, [x2, y2]: Point): number;
export declare function findIntersection(p1: Point, p2: Point, lp1: Point, lp2: Point): Point;
export declare function cleanPath(path: Point[]): void;
