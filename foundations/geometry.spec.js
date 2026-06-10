import { expect } from '@open-wc/testing';
import { contains, overlaps, distance, findIntersection, cleanPath, } from './geometry.js';
describe('geometry', () => {
    describe('contains', () => {
        it('returns true when outer fully contains inner', () => {
            const outer = [0, 0, 10, 10];
            const inner = [1, 1, 5, 5];
            expect(contains(outer, inner)).to.be.true;
        });
        it('returns true when rects are identical', () => {
            const rect = [2, 3, 4, 5];
            expect(contains(rect, rect)).to.be.true;
        });
        it('returns true when inner touches edges', () => {
            const outer = [0, 0, 10, 10];
            const inner = [0, 0, 10, 10];
            expect(contains(outer, inner)).to.be.true;
        });
        it('returns false when inner exceeds right edge', () => {
            const outer = [0, 0, 10, 10];
            const inner = [5, 0, 10, 5];
            expect(contains(outer, inner)).to.be.false;
        });
        it('returns false when inner exceeds bottom edge', () => {
            const outer = [0, 0, 10, 10];
            const inner = [0, 5, 5, 10];
            expect(contains(outer, inner)).to.be.false;
        });
        it('returns false when inner starts before outer', () => {
            const outer = [2, 2, 5, 5];
            const inner = [1, 1, 3, 3];
            expect(contains(outer, inner)).to.be.false;
        });
    });
    describe('overlaps', () => {
        it('returns true for overlapping rects', () => {
            const a = [0, 0, 5, 5];
            const b = [3, 3, 5, 5];
            expect(overlaps(a, b)).to.be.true;
        });
        it('returns true when one contains the other', () => {
            const a = [0, 0, 10, 10];
            const b = [2, 2, 3, 3];
            expect(overlaps(a, b)).to.be.true;
        });
        it('returns false when separated horizontally', () => {
            const a = [0, 0, 5, 5];
            const b = [6, 0, 5, 5];
            expect(overlaps(a, b)).to.be.false;
        });
        it('returns false when separated vertically', () => {
            const a = [0, 0, 5, 5];
            const b = [0, 6, 5, 5];
            expect(overlaps(a, b)).to.be.false;
        });
        it('returns false when touching edges (no overlap)', () => {
            const a = [0, 0, 5, 5];
            const b = [5, 0, 5, 5];
            expect(overlaps(a, b)).to.be.false;
        });
        it('is symmetric', () => {
            const a = [0, 0, 5, 5];
            const b = [3, 3, 5, 5];
            expect(overlaps(a, b)).to.equal(overlaps(b, a));
        });
    });
    describe('distance', () => {
        it('returns 0 for identical points', () => {
            expect(distance([3, 4], [3, 4])).to.equal(0);
        });
        it('returns Manhattan distance for horizontal offset', () => {
            expect(distance([0, 0], [5, 0])).to.equal(5);
        });
        it('returns Manhattan distance for vertical offset', () => {
            expect(distance([0, 0], [0, 7])).to.equal(7);
        });
        it('returns Manhattan distance for diagonal offset', () => {
            expect(distance([1, 2], [4, 6])).to.equal(7);
        });
        it('handles negative coordinates', () => {
            expect(distance([-1, -2], [2, 3])).to.equal(8);
        });
    });
    describe('findIntersection', () => {
        it('returns p1 when it lies on the line segment', () => {
            const p1 = [3, 0];
            const p2 = [3, 5];
            const lp1 = [0, 0];
            const lp2 = [5, 0];
            expect(findIntersection(p1, p2, lp1, lp2)).to.deep.equal(p1);
        });
        it('returns lp1 when it lies on the first segment', () => {
            const p1 = [0, 0];
            const p2 = [5, 0];
            const lp1 = [3, 0];
            const lp2 = [3, 5];
            expect(findIntersection(p1, p2, lp1, lp2)).to.deep.equal(lp1);
        });
        it('returns lp2 when it lies on the first segment', () => {
            const p1 = [0, 0];
            const p2 = [5, 0];
            const lp1 = [3, 5];
            const lp2 = [3, 0];
            expect(findIntersection(p1, p2, lp1, lp2)).to.deep.equal(lp2);
        });
        it('returns closest point on line when no direct intersection', () => {
            const p1 = [0, 0];
            const p2 = [0, 5];
            const lp1 = [2, 2];
            const lp2 = [2, 8];
            const result = findIntersection(p1, p2, lp1, lp2);
            expect(result[0]).to.equal(2);
        });
    });
    describe('cleanPath', () => {
        it('removes duplicate consecutive points', () => {
            const path = [[0, 0], [1, 1], [1, 1], [2, 2]];
            cleanPath(path);
            expect(path).to.deep.equal([[0, 0], [1, 1], [2, 2]]);
        });
        it('removes collinear horizontal points', () => {
            const path = [[0, 0], [1, 0], [2, 0], [3, 0]];
            cleanPath(path);
            expect(path).to.deep.equal([[0, 0], [3, 0]]);
        });
        it('removes collinear vertical points', () => {
            const path = [[0, 0], [0, 1], [0, 2], [0, 3]];
            cleanPath(path);
            expect(path).to.deep.equal([[0, 0], [0, 3]]);
        });
        it('preserves corner points', () => {
            const path = [[0, 0], [5, 0], [5, 5]];
            cleanPath(path);
            expect(path).to.deep.equal([[0, 0], [5, 0], [5, 5]]);
        });
        it('handles path with two points', () => {
            const path = [[0, 0], [5, 5]];
            cleanPath(path);
            expect(path).to.deep.equal([[0, 0], [5, 5]]);
        });
        it('handles empty path', () => {
            const path = [];
            cleanPath(path);
            expect(path).to.deep.equal([]);
        });
    });
});
//# sourceMappingURL=geometry.spec.js.map