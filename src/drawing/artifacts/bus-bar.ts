import { nothing, svg, type SVGTemplateResult } from 'lit';
import { identity } from '@openscd/scl-lib';

import { containsRect } from '../../foundations/element-geometry.js';
import { isBusBar } from '../../foundations/connectivity.js';
import { attributes } from '../../foundations/sld-attributes.js';
import { newPlaceEvent } from '../../foundations/events.js';

import type { Point } from '../../foundations/geometry.js';
import {
  renderConnectivityNode,
  type ConnectivityNodeContext,
} from './connectivity-node.js';
import type { SldArtifactDescriptor } from './artifact.js';

export type BusBarContext = ConnectivityNodeContext;

type BusBarRenderState = {
  diagramElementId?: string;
  dimensions: Point;
  position: Point;
};

type BusBarRenderActions = {
  onClick: () => void;
};

function busBarState(
  busBar: Element,
  context: BusBarContext,
): BusBarRenderState {
  const [x, y] = context.renderedPosition(busBar);
  const {
    dim: [w, h],
  } = attributes(busBar);

  return {
    diagramElementId:
      busBar.closest('Substation') === context.substation
        ? String(identity(busBar))
        : undefined,
    dimensions: [w, h],
    position: [x, y],
  };
}

function busBarActions(
  busBar: Element,
  context: BusBarContext,
  state: BusBarRenderState,
): BusBarRenderActions {
  const [x, y] = state.position;
  const [w, h] = state.dimensions;

  if (context.disabled) {
    return { onClick: () => {} };
  }

  return {
    onClick: () => {
      const parent = Array.from(
        context.substation.querySelectorAll(':root > Substation > VoltageLevel'),
      ).find(vl => containsRect(vl, x, y, w, h));
      if (parent) {
        context.dispatch(
          newPlaceEvent({
            x,
            y,
            element: busBar,
            parent,
          }),
        );
      }
    },
  };
}

function renderBusBar(
  busBar: Element,
  state: BusBarRenderState,
  actions: BusBarRenderActions,
  context: BusBarContext,
): SVGTemplateResult {
  const [x, y] = state.position;
  const [w, h] = state.dimensions;

  return svg`<g class="bus preview" id="${state.diagramElementId ?? nothing}">
    <title>${busBar.getAttribute('name')}</title>
    ${context.renderLabel(busBar)}
    ${Array.from(busBar.querySelectorAll('Text')).map(text =>
      context.renderLabel(text),
    )}
    ${renderConnectivityNode(
      busBar.querySelector('ConnectivityNode')!,
      context,
    )}
    <rect
      x="${x}"
      y="${y}"
      width="${w}"
      height="${h}"
      pointer-events="all"
      fill="none"
      @click=${actions.onClick}
    />
  </g>`;
}

export const busBarArtifact: SldArtifactDescriptor<
  BusBarRenderState,
  BusBarRenderActions,
  BusBarContext
> = {
  actions: busBarActions,
  matches: isBusBar,
  render: renderBusBar,
  state: busBarState,
};
