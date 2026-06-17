import { nothing, render as litRender, svg } from 'lit';

import { attributes } from '../../foundations/sld-attributes.js';
import { svgNs } from '../../foundations.js';

import type { EquipmentContext } from './conducting-equipment.js';
import type { PowerTransformerContext } from './power-transformer.js';
import type { LabelContext } from './label.js';
import type { BusBarContext } from './bus-bar.js';

/**
 * A spy context satisfying every artifact context type. Dispatched events,
 * grounded terminals, and opened context menus are recorded for assertions.
 */
export type SpyArtifactContext = EquipmentContext &
  PowerTransformerContext &
  LabelContext &
  BusBarContext & {
    dispatched: Event[];
    grounded: { element: Element; terminal: string }[];
    contextMenuOpened: { element: Element; event: MouseEvent }[];
  };

/**
 * Build a spy artifact context with neutral defaults (idle, enabled, nothing
 * placing). Pass `overrides` to set specific fields for a test. `renderedPosition`
 * and `renderedLabelPosition` default to the element's stored SLD coordinates.
 */
export function makeArtifactContext(
  overrides: Partial<SpyArtifactContext> = {},
): SpyArtifactContext {
  const dispatched: Event[] = [];
  const grounded: { element: Element; terminal: string }[] = [];
  const contextMenuOpened: { element: Element; event: MouseEvent }[] = [];

  return {
    dispatched,
    grounded,
    contextMenuOpened,
    connecting: undefined,
    disabled: false,
    dispatch(event: Event) {
      dispatched.push(event);
    },
    groundTerminal(element: Element, terminal: 'T1' | 'T2' | 'N1' | 'N2') {
      grounded.push({ element, terminal });
    },
    highlight: [],
    idle: true,
    mouseX: 0,
    mouseY: 0,
    mouseX2: 0,
    mouseY2: 0,
    nearestOpenTerminal: () => undefined,
    nsp: 'smth',
    openContextMenu(element: Element, event: MouseEvent) {
      contextMenuOpened.push({ element, event });
    },
    placing: undefined,
    placingLabel: undefined,
    renderLabel: () => nothing,
    renderedLabelPosition: (element: Element) => attributes(element).label,
    renderedPosition: (element: Element) => attributes(element).pos,
    resizingBR: undefined,
    resizingTL: undefined,
    selectable: [],
    substation: undefined as unknown as Element,
    view: { showLabels: true, showIeds: true },
    ...overrides,
  };
}

/** Render an artifact's `SVGTemplateResult` into a detached `<svg>` host. */
export function renderToSvg(
  template: ReturnType<typeof svg> | typeof nothing,
): SVGSVGElement {
  const host = document.createElementNS(svgNs, 'svg') as SVGSVGElement;
  litRender(template, host);
  return host;
}
