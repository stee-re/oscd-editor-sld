import {
  nothing,
  svg,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import { identity } from '@openscd/scl-lib';

import { resizeBRPath, resizeTLPath } from '../diagram-symbols.js';
import { containsRect } from '../../foundations/element-geometry.js';
import {
  canPlaceAt,
  canResizeTo,
  canResizeToTL,
} from '../../foundations/sld-placement.js';
import { copyElementForPlacement } from '../../foundations/edits.js';
import { isBusBar } from '../../foundations/connectivity.js';
import { attributes } from '../../foundations/sld-attributes.js';
import { iedReferences } from '../../foundations/ied.js';
import { distance } from '../../foundations/geometry.js';
import {
  newPlaceEvent,
  newResizeEvent,
  newResizeTLEvent,
  newStartPlaceEvent,
  newStartResizeBREvent,
  newStartResizeTLEvent,
} from '../../foundations/events.js';
import { svgNs } from '../../foundations.js';

import type { Point } from '../../foundations/geometry.js';
import {
  getHighlightStyle,
  isToBeHighlighted,
  type Highlight,
} from './highlight.js';
import type { SldSharedContext } from './artifact.js';

export type EquipmentContainerContext = SldSharedContext & {
  highlight: Highlight[];
  mouseX: number;
  mouseY: number;
  nsp: string;
  resizingBR?: Element;
  resizingTL?: Element;
  svgCoordinates(clientX: number, clientY: number): Point;
  renderEquipment(equipment: Element): SVGTemplateResult;
  renderPowerTransformer(equipment: Element): SVGTemplateResult;
  renderIed(
    referencedIed: Element,
    options?: { preview?: boolean },
  ): SVGTemplateResult;
  renderConnectivityNode(cNode: Element): SVGTemplateResult | typeof nothing;
};

function isBay(element: Element) {
  return element.tagName === 'Bay' && !isBusBar(element);
}

function preventDefault(e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault();
  }
}

/**
 * The kind-specific rendering differences between the two SLD equipment
 * containers (`VoltageLevel` and `Bay`). Everything else about drawing a
 * container is shared in `render`.
 */
type ContainerKind = {
  className: 'voltagelevel' | 'bay';
  stroke: string;
  strokeDasharray: string | typeof nothing;
  placingChildTag: string;
  resolvePlacementParent(
    element: Element,
    context: EquipmentContainerContext,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Element | undefined;
};

const voltageLevelKind: ContainerKind = {
  className: 'voltagelevel',
  stroke: '#F5E214',
  strokeDasharray: nothing,
  placingChildTag: 'Bay',
  resolvePlacementParent: (_element, context) => context.substation,
};

const bayKind: ContainerKind = {
  className: 'bay',
  stroke: '#12579B',
  strokeDasharray: '0.18',
  placingChildTag: 'ConductingEquipment',
  resolvePlacementParent: (_element, context, x, y, w, h) =>
    Array.from(
      context.substation.querySelectorAll(':root > Substation > VoltageLevel'),
    ).find(vl => containsRect(vl, x, y, w, h)),
};

/**
 * Renders a single SLD equipment container (`VoltageLevel` or `Bay`): its
 * resizable rectangle, drag-to-place and resize interactions, resize handles,
 * highlight, and child contents. The `kind` supplies the few VoltageLevel/Bay
 * differences; `childContainers` are the nested containers to render inside
 * (the bays of a voltage level, or `nothing` for a bay).
 */
function render(
  element: Element,
  context: EquipmentContainerContext,
  preview: boolean,
  kind: ContainerKind,
  childContainers: TemplateResult<2>[] | typeof nothing,
): TemplateResult<2> {
  if (context.placing === element && !preview) {
    return svg``;
  }

  let [x, y] = context.renderedPosition(element);
  const offset: Point = [context.mouseX - x, context.mouseY - y];
  let {
    dim: [w, h],
  } = attributes(element);

  const right = x + w - 1;
  const bottom = y + h - 1;

  let handleClick = (e: MouseEvent) => {
    if (context.idle) {
      context.dispatch(
        newStartPlaceEvent(
          e.shiftKey ? copyElementForPlacement(element, context.nsp) : element,
          offset,
        ),
      );
    }
  };
  let invalid = false;

  let contextmenu = (e: MouseEvent) => {
    e.preventDefault();
    if (!context.idle) {
      return;
    }
    context.openContextMenu(element, e);
  };
  if (context.disabled) {
    contextmenu = () => {};
  }

  let auxclick = ({ clientX, clientY, button }: MouseEvent) => {
    if (button !== 1) {
      return;
    }
    const mouse = context.svgCoordinates(clientX, clientY);
    if (distance(mouse, [x, y]) < distance(mouse, [right, bottom])) {
      context.dispatch(newStartResizeTLEvent(element));
    } else {
      context.dispatch(newStartResizeBREvent(element));
    }
  };
  if (context.disabled) {
    auxclick = () => {};
  }

  if (context.resizingBR === element) {
    w = Math.max(1, context.mouseX - x + 1);
    h = Math.max(1, context.mouseY - y + 1);
    if (canResizeTo(context.substation, element, w, h)) {
      handleClick = () =>
        context.dispatch(
          newResizeEvent({
            w,
            h,
            element,
          }),
        );
    } else {
      invalid = true;
    }
  }

  if (context.resizingTL === element) {
    w = Math.max(1, x + w - context.mouseX);
    h = Math.max(1, y + h - context.mouseY);
    x = Math.min(context.mouseX, right);
    y = Math.min(context.mouseY, bottom);
    if (canResizeToTL(context.substation, element, x, y, w, h)) {
      handleClick = () =>
        context.dispatch(
          newResizeTLEvent({
            x,
            y,
            w,
            h,
            element,
          }),
        );
    } else {
      invalid = true;
    }
  }

  if (context.placing === element) {
    const parent = kind.resolvePlacementParent(element, context, x, y, w, h);
    if (parent && canPlaceAt(context.substation, element, x, y, w, h)) {
      handleClick = () =>
        context.dispatch(
          newPlaceEvent({
            x,
            y,
            element,
            parent,
          }),
        );
    } else {
      invalid = true;
    }
  }

  let placingTarget = svg``;
  let resizingTarget = svg``;
  if (context.placing?.tagName === kind.placingChildTag) {
    placingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
      @click=${handleClick} fill="url(#grid)" />`;
  }

  if (
    context.resizingBR === element ||
    context.resizingTL === element ||
    (context.resizingBR?.parentElement === element &&
      isBusBar(context.resizingBR))
  ) {
    resizingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
      @click=${handleClick || nothing} fill="url(#grid)" />`;
  }

  const resizeBRHandle =
    context.idle && !context.disabled
      ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
        opacity="0.83" class="handle"
        @click=${() => context.dispatch(newStartResizeBREvent(element))}
        viewBox="0 96 960 960" x="${w + x - 1}" y="${h + y - 1}">
        <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
        ${resizeBRPath}
      </svg>`
      : nothing;
  const resizeTLhandle =
    context.idle && !context.disabled
      ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
        opacity="0.83" class="handle"
        @click=${() => context.dispatch(newStartResizeTLEvent(element))}
        viewBox="0 96 960 960" x="${x}" y="${y}">
        <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
        ${resizeTLPath}
      </svg>`
      : nothing;

  const clickthrough =
    context.disabled ||
    (!context.idle &&
      context.placing !== element &&
      context.resizingBR !== element &&
      context.resizingTL !== element);

  const strokeColor = invalid ? '#BB1326' : kind.stroke;

  const highlighted = isToBeHighlighted(element, context.highlight);
  const highlight = highlighted
    ? svg`<rect x="${x}" y="${y}" width="${w}" height="${h}" style="${getHighlightStyle(
      element,
      context.highlight,
    )}" pointer-events="none" />`
    : '';

  return svg`${highlight}<g id="${
    element.closest('Substation') === context.substation
      ? identity(element)
      : nothing
  }" class=${classMap({
    [kind.className]: true,
    preview,
  })} tabindex="0" pointer-events="${
    clickthrough ? 'none' : 'all'
  }" style="outline: none;">
    <rect x="${x}" y="${y}" width="${w}" height="${h}"
      @contextmenu=${contextmenu}
      @click=${handleClick || nothing} @mousedown=${preventDefault}
      @auxclick=${auxclick}
      fill="${highlighted ? 'none' : 'white'}" stroke-dasharray="${
        kind.strokeDasharray
      }"
      stroke="${strokeColor}" />
    ${childContainers}
    ${Array.from(element.children)
      .filter(child => child.tagName === 'ConductingEquipment')
      .map(equipment => context.renderEquipment(equipment))}
    ${Array.from(element.children)
      .filter(child => child.tagName === 'PowerTransformer')
      .map(powerTransformer =>
        context.renderPowerTransformer(powerTransformer),
      )}
    ${iedReferences(element)
      .filter(
        referencedIed =>
          referencedIed.parentElement?.tagName === 'Private' &&
          referencedIed.parentElement!.parentElement === element,
      )
      .map(referencedIed => context.renderIed(referencedIed, { preview }))}
    ${
      preview
        ? Array.from(element.querySelectorAll('ConnectivityNode'))
          .filter(child => child.getAttribute('name') !== 'grounded')
          .map(cNode => context.renderConnectivityNode(cNode))
        : nothing
    }
    ${
      preview
        ? Array.from(
          element.querySelectorAll(
            'Bay, ConductingEquipment, PowerTransformer, Text',
          ),
        )
          .concat(
            Array.from(
              element.querySelector(
                ':scope > Private[type="OpenSCD-SLD-Layout"]',
              )
                ? iedReferences(
                  element.querySelector(
                    ':scope > Private[type="OpenSCD-SLD-Layout"]',
                  )!,
                )
                : [],
            ),
          )
          .concat(element)
          .map(labelled => context.renderLabel(labelled, { preview }))
        : nothing
    }
    ${resizeTLhandle}
    ${resizeBRHandle}
    ${placingTarget}
    ${resizingTarget}
  </g>`;
}


/** Renders a `VoltageLevel` and, nested inside it, each of its (non-busbar) bays. */
export function renderVoltageLevel(
  voltageLevel: Element,
  context: EquipmentContainerContext,
  preview = false,
): TemplateResult<2> {
  const bays = Array.from(voltageLevel.children)
    .filter(isBay)
    .map(bay => renderBay(bay, context, preview));
  return render(
    voltageLevel,
    context,
    preview,
    voltageLevelKind,
    bays,
  );
}

/** Renders a `Bay` and its equipment. Bays do not nest, so they hold no child containers. */
export function renderBay(
  bay: Element,
  context: EquipmentContainerContext,
  preview = false,
): TemplateResult<2> {
  return render(bay, context, preview, bayKind, nothing);

}
