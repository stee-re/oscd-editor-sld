import { nothing, svg, TemplateResult, type SVGTemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { identity } from '@openscd/scl-lib';

import { containsRect } from '../../foundations/element-geometry.js';
import { canPlaceAt, canResizeTo, canResizeToTL } from '../../foundations/sld-placement.js';
import {
  iedReferences,
  isIedReferenceElement,
  resolveIed,
} from '../../foundations/ied.js';
import {
  newPlaceEvent,
  newResizeEvent,
  newResizeTLEvent,
  newSelectEvent,
  newStartPlaceEvent,
  newStartResizeBREvent,
  newStartResizeTLEvent,
} from '../../foundations/events.js';

import { distance, type Point } from '../../foundations/geometry.js';
import type {
  ArtifactRenderOptions,
  SldArtifactContext,
  SldArtifactDescriptor,
} from './artifact.js';
import { attributes, isBusBar, sldNs, svgNs } from '../../foundations.js';
import { copyElementForPlacement } from '../../foundations/edits.js';
import { resizeBRPath, resizeTLPath } from '../diagram-symbols.js';

type ContainerRenderState = {
  clickthrough: boolean;
  diagramElementId?: string;
  disabled: boolean;
  iedName: string | null;
  placingSelf: boolean;
  position: Point;
  selectable: boolean;
};

type ContainerRenderActions = {
  onClick: (event: MouseEvent) => void;
  onContextMenu: (event: MouseEvent) => void;
  onMouseDown: (event: MouseEvent) => void;
  onAuxClick: (event: MouseEvent) => void;
};

function preventDefault(e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault();
  }
}

function isBay(element: Element) {
  return element.tagName === 'Bay' && !isBusBar(element);
}

function containerState(
  bayOrVL: Element,
  context: SldArtifactContext,
  { preview = false }: ArtifactRenderOptions = {},
): ContainerRenderState | undefined {
  if (that.placing === bayOrVL && !preview) {
    return undefined;
  }

  const [x, y] = context.renderedPosition(bayOrVL);
  const iedName = resolveIed(bayOrVL)?.getAttribute('name') ?? null;

  return {
    clickthrough: !context.idle && context.placing !== bayOrVL,
    diagramElementId:
      bayOrVL.closest('Substation') === context.substation && iedName
        ? `IEDRef-${iedName}`
        : undefined,
    disabled: context.disabled,
    iedName,
    placingSelf: context.placing === bayOrVL,
    position: [x, y],
    selectable: false};
}

function containerActions(
  _referencedIed: Element,
  _context: SldArtifactContext,
  _state: ContainerRenderState,
): ContainerRenderActions {

  const handleClick = (e: MouseEvent) => {
    if (that.idle) {
      that.dispatchEvent(
        newStartPlaceEvent(
          e.shiftKey ? copyElementForPlacement(bayOrVL, that.nsp) : bayOrVL,
          offset,
        ),
      );
    }
  };

  let contextmenu = (e: MouseEvent) => {
    e.preventDefault();
    if (!that.idle) {
      return;
    }
    that.contextMenu?.open(that.contextMenuContext(bayOrVL, e));
  };
  if (that.disabled) {
    contextmenu = () => {};
  }

  let auxclick = ({ clientX, clientY, button }: MouseEvent) => {
    if (button !== 1) {
      return;
    }
    const mouse = that.svgCoordinates(clientX, clientY);
    if (distance(mouse, [x, y]) < distance(mouse, [right, bottom])) {
      that.dispatchEvent(newStartResizeTLEvent(bayOrVL));
    } else {
      that.dispatchEvent(newStartResizeBREvent(bayOrVL));
    }
  };
  if (that.disabled) {
    auxclick = () => {};
  }
  return {
    onClick: ()=>{},
    onContextMenu: () => {} ,
    onMouseDown: () => {},
  };
}

export function isContainerElement(element: Element): boolean {
  return (
    element.localName === 'VoltageLevel' || element.localName === 'Bay' &&
    element.namespaceURI === sldNs
  );
}

function renderContainer(element: Element, state: ContainerRenderState, actions: ContainerRenderActions){
  return nothing;
}

function renderContainerPreviewLabels(element: Element, context: SldArtifactContext, options: ArtifactRenderOptions ){
  return nothing;
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const that:any = {}

function __renderContainer(
  bayOrVL: Element,
  state: IedReferenceRenderState,
  actions: IedReferenceRenderActions,
): SVGTemplateResult {

  const isVL = bayOrVL.tagName === 'VoltageLevel';


  const offset: Point = [state.context.mouseX - state.x, that.mouseY - state.y];
  let {
    dim: [w, h],
  } = attributes(bayOrVL);

  const right = state.x + w - 1;
  const bottom = state.y + h - 1;

  let invalid = false;



  if (that.resizingBR === bayOrVL) {
    w = Math.max(1, that.mouseX - state.x + 1);
    h = Math.max(1, that.mouseY - state.y + 1);
    if (canResizeTo(that.substation, bayOrVL, w, h)) {
      // handleClick = () =>
      //   that.dispatchEvent(
      //     newResizeEvent({
      //       w,
      //       h,
      //       element: bayOrVL,
      //     }),
      //   );
    } else {
      invalid = true;
    }
  }

  if (that.resizingTL === bayOrVL) {
    w = Math.max(1, state.x + w - that.mouseX);
    h = Math.max(1, state.y + h - that.mouseY);
    state.x = Math.min(that.mouseX, right);
    state.y = Math.min(that.mouseY, bottom);
    if (canResizeToTL(that.substation, bayOrVL, state.x, state.y, w, h)) {
      // handleClick = () =>
      //   that.dispatchEvent(
      //     newResizeTLEvent({
      //       x,
      //       y,
      //       w,
      //       h,
      //       element: bayOrVL,
      //     }),
      //   );
    } else {
      invalid = true;
    }
  }

  if (that.placing === bayOrVL) {
    let parent: Element | undefined;
    if (isVL) {
      parent = that.substation;
    } else {
      parent = Array.from(
        state.context.substation.querySelectorAll(':root > Substation > VoltageLevel'),
      ).find((vl: Element) => containsRect(vl, state.x, state.y, w, h));
    }
    if (parent && canPlaceAt(that.substation, bayOrVL, x, y, w, h)) {
      actions.onClick = () =>
        that.dispatchEvent(
          newPlaceEvent({
            x: state.x,
            y: state.y,
            element: bayOrVL,
            parent: parent!,
          }),
        );
    } else {
      invalid = true;
    }
  }

  let placingTarget = svg``;
  let resizingTarget = svg``;
  if (
    (isVL && that.placing?.tagName === 'Bay') ||
      (!isVL && that.placing?.tagName === 'ConductingEquipment')
  ) {
    placingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
        @click=${actions.onClick} fill="url(#grid)" />`;
  }

  if (
    that.resizingBR === bayOrVL ||
      that.resizingTL === bayOrVL ||
      (that.resizingBR?.parentElement === bayOrVL && isBusBar(that.resizingBR))
  ) {
    resizingTarget = svg`<rect x="${state.x}" y="${state.y}" width="${w}" height="${h}"
        @click=${action.onClick || nothing} fill="url(#grid)" />`;
  }

  const resizeBRHandle =
    that.idle && !that.disabled
      ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
          opacity="0.83" class="handle"
          @click=${() => that.dispatchEvent(newStartResizeBREvent(bayOrVL))}
          viewBox="0 96 960 960" x="${w + state.x - 1}" y="${h + state.y - 1}">
          <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
          ${resizeBRPath}
        </svg>`
      : nothing;
  const resizeTLhandle =
    that.idle && !that.disabled
      ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
          opacity="0.83" class="handle"
          @click=${() => that.dispatchEvent(newStartResizeTLEvent(bayOrVL))}
          viewBox="0 96 960 960" x="${state.x}" y="${state.y}">
          <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
          ${resizeTLPath}
        </svg>`
      : nothing;

  const clickthrough =
    that.disabled ||
      (!that.idle &&
        that.placing !== bayOrVL &&
        that.resizingBR !== bayOrVL &&
        that.resizingTL !== bayOrVL);

  let strokeColor: string;
  if (invalid) {
    strokeColor = '#BB1326';
  } else if (isVL) {
    strokeColor = '#F5E214';
  } else {
    strokeColor = '#12579B';
  }

  const highlighted = state.isToBeHighlighted(bayOrVL, that.highlight);
  const highlight = highlighted
    ? svg`<rect x="${state.x}" y="${state.y}" width="${w}" height="${h}" style="${state.context.getHighlightStyle(
      bayOrVL,
      that.highlight,
    )}" pointer-events="none" />`
    : '';

  return svg`${highlight}<g id="${
    bayOrVL.closest('Substation') === that.substation
      ? identity(bayOrVL)
      : nothing
  }" class=${classMap({
    voltagelevel: isVL,
    bay: !isVL,
    preview: state.preview,
  })} tabindex="0" pointer-events="${
    clickthrough ? 'none' : 'all'
  }" style="outline: none;">
      <rect x="${state.x}" y="${y}" width="${w}" height="${h}"
        @contextmenu=${actions.onContextMenu}
        @click=${actions.onClick || nothing} @mousedown=${preventDefault}
        @auxclick=${actions.onAux}
        fill="${highlighted ? 'none' : 'white'}" stroke-dasharray="${
          isVL ? nothing : '0.18'
        }"
        stroke="${strokeColor}" />
      ${Array.from(bayOrVL.children)
        .filter(isBay)
        .map(bay => that.renderContainer(bay, state.preview))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'ConductingEquipment')
        .map(equipment => that.renderEquipment(equipment))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'PowerTransformer')
        .map(equipment => that.renderPowerTransformer(equipment))}
      ${iedReferences(bayOrVL)
        .filter(
          referencedIed =>
            referencedIed.parentElement?.tagName === 'Private' &&
            referencedIed.parentElement!.parentElement === bayOrVL,
        )
        .map(referencedIed => that.renderIed(referencedIed, { preview: state.preview }))}
      ${
        state.preview
          ? Array.from(bayOrVL.querySelectorAll('ConnectivityNode'))
            .filter(child => child.getAttribute('name') !== 'grounded')
            .map(cNode => that.renderConnectivityNode(cNode))
          : nothing
      }
      ${
        state.preview
          ? Array.from(
            bayOrVL.querySelectorAll(
              'Bay, ConductingEquipment, PowerTransformer, Text',
            ),
          )
            .concat(
              Array.from(
                bayOrVL.querySelector(
                  ':scope > Private[type="OpenSCD-SLD-Layout"]',
                )
                  ? iedReferences(
                    bayOrVL.querySelector(
                      ':scope > Private[type="OpenSCD-SLD-Layout"]',
                    )!,
                  )
                  : [],
              ),
            )
            .concat(bayOrVL)
            .map(element => that.renderLabel(element, { preview: state.preview }))
          : nothing
      }
      ${resizeTLhandle}
      ${resizeBRHandle}
      ${placingTarget}
      ${resizingTarget}
    </g>`;
}

export const containerArtifact: SldArtifactDescriptor<
  ContainerRenderState,
  ContainerRenderActions

> = {
  actions: containerActions,
  matches: isContainerElement,
  render: (element, state, actions, context, options) => svg`
    ${renderContainer(element, state, actions)}
    ${renderContainerPreviewLabels(element, context, options)}
  `,
  state: containerState,
};
