import { nothing, svg, type SVGTemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { identity } from '@openscd/scl-lib';

import { eqRingPath } from '../diagram-symbols.js';
import { containsRect } from '../../foundations/element-geometry.js';
import { canPlaceAt } from '../../foundations/sld-placement.js';
import { copyElementForPlacement } from '../../foundations/edits.js';
import {
  connectionStartPoints,
  isBusBar,
} from '../../foundations/connectivity.js';
import { attributes } from '../../foundations/sld-attributes.js';
import {
  isEqType,
  ringedEqTypes,
  singleTerminal,
} from '../../foundations/equipment.js';
import {
  newPlaceEvent,
  newRotateEvent,
  newSelectEvent,
  newStartConnectEvent,
  newStartPlaceEvent,
} from '../../foundations/events.js';

import type { Point } from '../../foundations/geometry.js';
import type { Style } from '../../foundations/sld-attributes.js';
import type {
  ArtifactRenderOptions,
  SldArtifactDescriptor,
  SldSharedContext,
} from './artifact.js';

export type Connecting = {
  from: Element;
  path: Point[];
  fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
};

export type EquipmentContext = SldSharedContext & {
  connecting?: Connecting;
  groundTerminal(element: Element, terminal: 'T1' | 'T2'): void;
  highlight: { id: string; style: Style }[];
  mouseX: number;
  mouseY: number;
  nearestOpenTerminal(equipment?: Element): 'T1' | 'T2' | undefined;
  nsp: string;
  resizingBR?: Element;
  resizingTL?: Element;
};

export type EquipmentRenderState = {
  bottomGrounded: boolean;
  canShowBottomPort: boolean;
  canShowTopPort: boolean;
  clickthrough: boolean;
  diagramElementId?: string;
  disabled: boolean;
  highlightedStyle?: string;
  placingSelf: boolean;
  portPointerEventsDisabled: boolean;
  position: Point;
  selectable: boolean;
  showBottomConnectIndicator: boolean;
  showTopConnectIndicator: boolean;
  topGrounded: boolean;
};

export type EquipmentRenderActions = {
  onAuxClick: (event: MouseEvent) => void;
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onGroundBottom: (event: MouseEvent) => void;
  onGroundTop: (event: MouseEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onStartBottomConnect: () => void;
  onStartTopConnect: () => void;
};

function preventDefault(e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault();
  }
}

function isSelectable(element: Element, selectable: string[]) {
  return selectable.some(sel => identity(element) === sel);
}

function isToBeHighlighted(
  element: Element,
  highlight: { id: string; style: Style }[],
): boolean {
  return highlight.some(h => identity(element) === h.id);
}

function getHighlightStyle(
  element: Element,
  highlight: { id: string; style: Style }[],
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

function equipmentRenderState(
  equipment: Element,
  context: EquipmentContext,
  { preview = false, connect = false }: ArtifactRenderOptions = {},
): EquipmentRenderState | undefined {
  if (context.placing === equipment && !preview) {
    return undefined;
  }
  if (
    context.connecting?.from.closest('Substation') === context.substation &&
    !connect
  ) {
    return undefined;
  }

  const [x, y] = context.renderedPosition(equipment);
  const eqType = equipment.getAttribute('type')!;
  const terminals = Array.from(equipment.children).filter(
    c => c.tagName === 'Terminal',
  );
  const topTerminal = terminals.find(t => t.getAttribute('name') === 'T1');
  const bottomTerminal = terminals.find(t => t.getAttribute('name') !== 'T1');
  const placingOtherElement = !!context.placing && context.placing !== equipment;
  const connectingFromSelf = context.connecting?.from === equipment;
  const selectable = isSelectable(equipment, context.selectable);
  const highlightedStyle = isToBeHighlighted(equipment, context.highlight)
    ? getHighlightStyle(equipment, context.highlight)
    : undefined;

  return {
    bottomGrounded: bottomTerminal?.getAttribute('cNodeName') === 'grounded',
    canShowBottomPort: !(
      bottomTerminal ||
      context.resizingBR ||
      context.resizingTL ||
      context.connecting ||
      context.placingLabel ||
      placingOtherElement ||
      singleTerminal.has(eqType) ||
      context.disabled
    ),
    canShowTopPort: !(
      topTerminal ||
      context.resizingBR ||
      context.resizingTL ||
      context.connecting ||
      context.placingLabel ||
      placingOtherElement ||
      context.disabled
    ),
    clickthrough:
      connect ||
      (!context.idle && context.placing !== equipment) ||
      (context.disabled && !selectable),
    diagramElementId:
      equipment.closest('Substation') === context.substation
        ? `${identity(equipment)}`
        : undefined,
    disabled: context.disabled,
    highlightedStyle,
    placingSelf: context.placing === equipment,
    portPointerEventsDisabled: !!context.placing,
    position: [x, y],
    selectable,
    showBottomConnectIndicator:
      !!context.connecting &&
      !connectingFromSelf &&
      !(
        context.mouseX === x &&
        context.mouseY === y &&
        context.nearestOpenTerminal(equipment) === 'T2'
      ) &&
      !bottomTerminal &&
      !singleTerminal.has(eqType) &&
      !context.disabled,
    showTopConnectIndicator:
      !!context.connecting &&
      !connectingFromSelf &&
      !(
        context.mouseX === x &&
        context.mouseY === y &&
        context.nearestOpenTerminal(equipment) === 'T1'
      ) &&
      !topTerminal &&
      !context.disabled,
    topGrounded: topTerminal?.getAttribute('cNodeName') === 'grounded',
  };
}

function equipmentRenderActions(
  equipment: Element,
  context: EquipmentContext,
  state: EquipmentRenderState,
): EquipmentRenderActions {
  let handleClick = (e: MouseEvent) => {
    const placing = e.shiftKey
      ? copyElementForPlacement(equipment, context.nsp)
      : equipment;
    context.dispatch(newStartPlaceEvent(placing));
  };

  if (context.placing === equipment) {
    const [x, y] = state.position;
    const parent = Array.from(
      context.substation.querySelectorAll(
        ':root > Substation > VoltageLevel > Bay',
      ),
    ).find(bay => !isBusBar(bay) && containsRect(bay, x, y, 1, 1));
    if (parent && canPlaceAt(context.substation, equipment, x, y, 1, 1)) {
      handleClick = () => {
        context.dispatch(
          newPlaceEvent({
            x,
            y,
            element: equipment,
            parent,
          }),
        );
      };
    }
  }

  if (context.disabled && !state.selectable) {
    handleClick = () => {};
  }
  if (context.disabled && state.selectable) {
    handleClick = () => {
      context.dispatch(newSelectEvent(equipment));
    };
  }

  return {
    onAuxClick: (e: MouseEvent) => {
      if (context.disabled) {
        return;
      }
      if (e.button === 1) {
        // middle mouse button
        context.dispatch(newRotateEvent(equipment));
        e.preventDefault();
      }
    },
    onClick: handleClick,
    onContextMenu: (e: MouseEvent) => {
      e.preventDefault();
      if (!context.idle || context.disabled) {
        return;
      }
      context.openContextMenu(equipment, e);
    },
    onGroundBottom: (e: MouseEvent) => {
      e.preventDefault();
      context.groundTerminal(equipment, 'T2');
    },
    onGroundTop: (e: MouseEvent) => {
      e.preventDefault();
      context.groundTerminal(equipment, 'T1');
    },
    onMouseDown: preventDefault,
    onStartBottomConnect: () => {
      context.dispatch(
        newStartConnectEvent({
          from: equipment,
          fromTerminal: 'T2',
          path: connectionStartPoints(equipment).T2,
        }),
      );
    },
    onStartTopConnect: () => {
      context.dispatch(
        newStartConnectEvent({
          from: equipment,
          fromTerminal: 'T1',
          path: connectionStartPoints(equipment).T1,
        }),
      );
    },
  };
}

function renderEquipmentPreviewLabels(
  equipment: Element,
  context: EquipmentContext,
  { preview = false }: ArtifactRenderOptions = {},
): SVGTemplateResult | typeof nothing {
  return preview
    ? svg`<g class="preview">
        ${[
          context.renderLabel(equipment, { preview }),
          ...Array.from(equipment.querySelectorAll('Text')).map(text =>
            context.renderLabel(text, { preview }),
          ),
        ]}
      </g>`
    : nothing;
}

function renderEquipment(
  equipment: Element,
  state: EquipmentRenderState,
  actions: EquipmentRenderActions,
): SVGTemplateResult {
  const [x, y] = state.position;
  const { flip, rot } = attributes(equipment);
  const deg = 90 * rot;

  const eqType = equipment.getAttribute('type')!;
  const ringed = ringedEqTypes.has(eqType);
  const symbol = isEqType(eqType) ? eqType : 'ConductingEquipment';
  const icon = ringed
    ? svg`<svg
        viewBox="0 0 25 25"
        width="1"
        height="1"
      >
        ${eqRingPath}
      </svg>`
    : svg`<use
        href="#${symbol}"
        xlink:href="#${symbol}"
        pointer-events="none"
      />`;

  const topConnector = state.canShowTopPort
    ? svg`<circle
        class="port"
        cx="0.5"
        cy="0"
        r="0.2"
        opacity="0.4"
        fill="#BB1326"
        stroke="#F5E214"
        pointer-events="${state.portPointerEventsDisabled ? 'none' : nothing}"
        @click=${actions.onStartTopConnect}
        @contextmenu=${actions.onGroundTop}
      />`
    : nothing;

  const topIndicator = state.showTopConnectIndicator
    ? svg`<polygon
        points="0.3,0 0.7,0 0.5,0.4"
        fill="#BB1326"
        opacity="0.4"
      />`
    : nothing;

  const topGrounded = state.topGrounded
    ? svg`<line
        x1="0.5"
        y1="-0.1"
        x2="0.5"
        y2="0.16"
        stroke="black"
        stroke-width="0.06"
        marker-start="url(#grounded)"
      />`
    : nothing;

  const bottomConnector = state.canShowBottomPort
    ? svg`<circle
        class="port"
        cx="0.5"
        cy="1"
        r="0.2"
        opacity="0.4"
        fill="#BB1326"
        stroke="#F5E214"
        pointer-events="${state.portPointerEventsDisabled ? 'none' : nothing}"
        @click=${actions.onStartBottomConnect}
        @contextmenu=${actions.onGroundBottom}
      />`
    : nothing;

  const bottomIndicator = state.showBottomConnectIndicator
    ? svg`<polygon
        points="0.3,1 0.7,1 0.5,0.6"
        fill="#BB1326"
        opacity="0.4"
      />`
    : nothing;

  const bottomGrounded = state.bottomGrounded
    ? svg`<line
        x1="0.5"
        y1="1.1"
        x2="0.5"
        y2="0.84"
        stroke="black"
        stroke-width="0.06"
        marker-start="url(#grounded)"
      />`
    : nothing;

  const highlight = state.highlightedStyle
    ? svg`<rect
        x="${x}"
        y="${y}"
        width="1"
        height="1"
        style="${state.highlightedStyle}"
        pointer-events="none"
      />`
    : nothing;

  return svg`${highlight}<g
    class="${classMap({
      equipment: true,
      preview: state.placingSelf,
      disabled: state.disabled,
      selectable: state.selectable,
    })}"
    id="${state.diagramElementId ?? nothing}"
    transform="translate(${x} ${y}) rotate(${deg} 0.5 0.5)${
      flip ? ' scale(-1,1) translate(-1 0)' : ''
    }"
  >
    <title>${equipment.getAttribute('name')}</title>
    ${icon}
    ${
      ringed
        ? svg`<use
            transform="rotate(${-deg} 0.5 0.5)"
            pointer-events="none"
            href="#${symbol}"
            xlink:href="#${symbol}"
          />`
        : nothing
    }
    <rect
      width="1"
      height="1"
      fill="none"
      pointer-events="${state.clickthrough ? 'none' : 'all'}"
      @mousedown=${actions.onMouseDown}
      @click=${actions.onClick}
      @auxclick=${actions.onAuxClick}
      @contextmenu=${actions.onContextMenu}
    />
    ${topConnector}
    ${topIndicator}
    ${topGrounded}
    ${bottomConnector}
    ${bottomIndicator}
    ${bottomGrounded}
  </g>`;
}

export const conductingEquipmentArtifact: SldArtifactDescriptor<
  EquipmentRenderState,
  EquipmentRenderActions,
  EquipmentContext
> = {
  actions: equipmentRenderActions,
  matches: element => element.tagName === 'ConductingEquipment',
  render: (element, state, actions, context, options) => svg`
    ${renderEquipment(element, state, actions)}
    ${renderEquipmentPreviewLabels(element, context, options)}
  `,
  state: equipmentRenderState,
};
