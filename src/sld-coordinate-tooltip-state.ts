import { isBusBar } from './foundations/connectivity.js';
import { attributes } from './foundations/sld-attributes.js';
import {
  canPlaceAt,
  canResizeTo,
  canResizeToTL,
} from './foundations/sld-placement.js';

import type { Point } from './foundations/geometry.js';

export type CoordinateTooltipState = {
  text: string;
  invalid: boolean;
  hidden: boolean;
};

export function coordinateTooltipState({
  substation,
  placing,
  placingOffset,
  resizingBR,
  resizingTL,
  mouseX,
  mouseY,
}: {
  substation: Element;
  placing?: Element;
  placingOffset: Point;
  resizingBR?: Element;
  resizingTL?: Element;
  mouseX: number;
  mouseY: number;
}): CoordinateTooltipState {
  if (placing) {
    const {
      dim: [w0, h0],
    } = attributes(placing);
    const [offsetX, offsetY] = placingOffset;
    const x = mouseX - offsetX;
    const y = mouseY - offsetY;

    return {
      text: `${x},${y}`,
      invalid: !canPlaceAt(substation, placing, x, y, w0, h0),
      hidden: false,
    };
  }

  if (resizingBR && !isBusBar(resizingBR)) {
    const {
      pos: [x, y],
    } = attributes(resizingBR);
    const newW = Math.max(1, mouseX - x + 1);
    const newH = Math.max(1, mouseY - y + 1);

    return {
      text: `${newW}×${newH}`,
      invalid: !canResizeTo(substation, resizingBR, newW, newH),
      hidden: false,
    };
  }

  if (resizingTL) {
    const {
      pos: [x, y],
      dim: [resW, resH],
    } = attributes(resizingTL);
    const newW = Math.max(1, x + resW - mouseX);
    const newH = Math.max(1, y + resH - mouseY);
    const newX = Math.min(mouseX, x + resH - 1);
    const newY = Math.min(mouseY, y + resW - 1);

    return {
      text: `${newW}×${newH}`,
      invalid: !canResizeToTL(substation, resizingTL, newX, newY, newW, newH),
      hidden: false,
    };
  }

  return { text: '', invalid: false, hidden: true };
}
