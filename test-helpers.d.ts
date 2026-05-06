/**
 * Shared test utilities for computing viewport positions from SVG grid
 * coordinates. These helpers dynamically resolve pixel positions based on
 * the SVG element's bounding rect and viewBox, eliminating cross-browser
 * failures caused by hardcoded pixel offsets.
 */
/**
 * Return the `#sld` SVG element from a SldSubstationEditor shadow root.
 */
export declare function findSubstationSvgRoot(substationEditor: Element): SVGSVGElement;
/**
 * Convert a grid cell position to browser viewport pixel coordinates.
 * Targets the center of the cell so that `Math.floor(svgX)` yields
 * the correct integer grid position.
 */
export declare function gridPosToViewportCoords(svg: SVGSVGElement, gx: number, gy: number): [number, number];
/**
 * Convert SCL label storage coordinates (lx, ly) to browser viewport
 * pixel coordinates. Inverts the component's label storage formula:
 *   lx = mouseX2 - 0.5,  ly = mouseY2 + 0.5
 * to determine where to click so the label ends up at (lx, ly).
 */
export declare function sclLabelToViewportCoords(svg: SVGSVGElement, lx: number, ly: number): [number, number];
/**
 * Convert exact SVG coordinates to browser viewport pixel coordinates.
 * Use when half-grid precision (mouseX2/mouseY2) matters, e.g. for
 * connection vertex placement.
 */
export declare function svgToViewportCoords(svg: SVGSVGElement, svgX: number, svgY: number): [number, number];
/** Position of the VoltageLevel in voltageLevelDocString (x=1, y=1) */
export declare const vlOrigin: [number, number];
/** Bottom-right resize target for VL from vlOrigin to w=8, h=7 */
export declare const vlResizeBR: [number, number];
/** Standard top-left corner for placing new elements (VL, bay, bus bar) */
export declare const placeTL: [number, number];
/** Standard bottom-right resize corner from placeTL giving w=7, h=8 */
export declare const placeBR: [number, number];
/** Equipment position in equipmentDocString (x=4, y=4) */
export declare const eqPos: [number, number];
/** Common target for equipment move/copy (x=3, y=3) */
export declare const eqTarget: [number, number];
