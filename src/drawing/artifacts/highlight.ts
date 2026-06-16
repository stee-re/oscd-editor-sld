import { identity } from '@openscd/scl-lib';

import type { Style } from '../../foundations/sld-attributes.js';

export type Highlight = { id: string; style: Style };

export function isSelectable(element: Element, selectable: string[]): boolean {
  return selectable.some(sel => identity(element) === sel);
}

export function isToBeHighlighted(
  element: Element,
  highlight: Highlight[],
): boolean {
  return highlight.some(h => identity(element) === h.id);
}

export function getHighlightStyle(
  element: Element,
  highlight: Highlight[],
): string {
  const style = highlight.find(h => identity(element) === h.id)?.style;
  if (!style) {
    return '';
  }

  let styleStr = '';
  if (style?.fill) {
    styleStr += `fill: ${style.fill}; `;
  }
  if (style?.fillOpacity) {
    styleStr += `fill-opacity: ${style.fillOpacity}; `;
  }
  if (style?.stroke) {
    styleStr += `stroke: ${style.stroke}; `;
  }
  if (style?.strokeWidth) {
    styleStr += `stroke-width: ${style.strokeWidth}; `;
  }
  if (style?.strokeOpacity) {
    styleStr += `stroke-opacity: ${style.strokeOpacity}; `;
  }
  if (style?.rx) {
    styleStr += `rx: ${style.rx}; `;
  }

  return styleStr;
}
