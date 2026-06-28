/**
 * Pure rectangle and point math.
 *
 * All functions here operate on numeric tuples (Rect, Point) with no
 * knowledge of DOM Elements or SCL structure.
 */

export type Point = [number, number];

export type Rect = [number, number, number, number];

export function contains(
  [x1, y1, w1, h1]: Rect,
  [x2, y2, w2, h2]: Rect,
): boolean {
  return x1 <= x2 && y1 <= y2 && x1 + w1 >= x2 + w2 && y1 + h1 >= y2 + h2;
}

export function overlaps(
  [x1, y1, w1, h1]: Rect,
  [x2, y2, w2, h2]: Rect,
): boolean {
  if (x1 >= x2 + w2 || x2 >= x1 + w1) {
    return false;
  }

  if (y1 >= y2 + h2 || y2 >= y1 + h1) {
    return false;
  }

  return true;
}

function between(a: number, x: number, b: number): boolean {
  return (a <= x && x <= b) || (b <= x && x <= a);
}

function liesOn([x, y]: Point, [x1, y1]: Point, [x2, y2]: Point): boolean {
  return (
    (x === x1 && x === x2 && between(y1, y, y2)) ||
    (y === y1 && y === y2 && between(x1, x, x2))
  );
}

function pointsOnLine(p1: Point, p2: Point): Point[] {
  const points = [] as Point[];
  const coord = p1[0] === p2[0] ? 1 : 0;
  let p = p1[coord] < p2[coord] ? p1 : p2;
  const q = p === p1 ? p2 : p1;
  p = p.slice() as Point;
  p[coord] = Math.floor(p[coord] * 2) / 2;

  while (p[coord] <= q[coord]) {
    points.push(p);
    p = p.slice() as Point;
    p[coord] += 0.5;
  }

  return points;
}

export function distance([x1, y1]: Point, [x2, y2]: Point): number {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function closestPointOnLine(p: Point, p1: Point, p2: Point): Point {
  let point = p1;
  const points = pointsOnLine(p1, p2);

  points.forEach((candidate) => {
    if (distance(candidate, p) < distance(point, p)) {
      point = candidate;
    }
  });

  return point;
}

export function findIntersection(
  p1: Point,
  p2: Point,
  lp1: Point,
  lp2: Point,
): Point {
  if (liesOn(p1, lp1, lp2)) {
    return p1;
  }

  if (liesOn(lp1, p1, p2)) {
    return lp1;
  }

  if (liesOn(lp2, p1, p2)) {
    return lp2;
  }

  return closestPointOnLine(p2, lp1, lp2);
}

/**
 * Extend a connection path with a newly committed waypoint while the user is
 * drawing a connection.
 *
 * A connection path is the list of orthogonal waypoints running from the source
 * terminal to the cursor. Its *final* point is provisional: it tracks the live
 * cursor so the in-progress segment can be previewed as the user moves the
 * mouse. Committing a waypoint is therefore not a plain append — the provisional
 * last point must first be **replaced** by `corner` (the now-fixed bend where
 * the previewed segment turns), and only then are the new live endpoints
 * (`rest`) appended so the path keeps tracking the cursor from the new bend.
 *
 * The result is normalised with {@link cleanPath}, which drops any duplicate or
 * collinear points the new bend may have introduced.
 *
 * @param path - the current connection path
 * @param corner - the fixed bend that replaces the provisional last waypoint
 * @param rest - the new live endpoint(s) extending the path past the bend
 * @returns the extended, normalised path
 */
export function extendConnectPointPaths(
  path: Point[],
  corner: Point,
  ...rest: Point[]
): Point[] {
  const next: Point[] = [...path.slice(0, -1), corner, ...rest];
  cleanPath(next);
  return next;
}

export function cleanPath(path: Point[]): void {
  let i = path.length - 2;

  while (i > 0) {
    const [x, y] = path[i];
    const [nx, ny] = path[i + 1];
    const [px, py] = path[i - 1];

    if (
      (x === nx && y === ny) ||
      (x === nx && x === px) ||
      (y === ny && y === py)
    ) {
      path.splice(i, 1);
    }

    i -= 1;
  }
}
