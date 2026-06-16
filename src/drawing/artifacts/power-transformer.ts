import { nothing, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { zigZag2WTransform, zigZagPath } from '../diagram-symbols.js';
import { containsRect } from '../../foundations/element-geometry.js';
import { copyElementForPlacement } from '../../foundations/edits.js';
import { attributes } from '../../foundations/sld-attributes.js';
import { transformerWindingMeasures } from '../../foundations/transformer.js';
import {
  newPlaceEvent,
  newRotateEvent,
  newSelectEvent,
  newStartConnectEvent,
  newStartPlaceEvent,
} from '../../foundations/events.js';

import type { Point } from '../../foundations/geometry.js';
import {
  getHighlightStyle,
  isSelectable,
  isToBeHighlighted,
  type Highlight,
} from './highlight.js';
import {
  type ArtifactRenderOptions,
  type Connecting,
  type SldArtifactDescriptor,
  type SldSharedContext,
} from './artifact.js';

export type PowerTransformerContext = SldSharedContext & {
  connecting?: Connecting;
  groundTerminal(
    element: Element,
    terminal: 'T1' | 'T2' | 'N1' | 'N2',
  ): void;
  highlight: Highlight[];
  mouseX: number;
  mouseY: number;
  nsp: string;
  resizingBR?: Element;
  resizingTL?: Element;
};

type PowerTransformerRenderState = {
  disabled: boolean;
  highlight: TemplateResult | '';
  placingSelf: boolean;
  position: Point;
  selectable: boolean;
  windings: Element[];
};

type PowerTransformerRenderActions = {
  onAuxClick: (event: MouseEvent) => void;
  onClick: ((event: MouseEvent) => void) | symbol;
};

function preventDefault(e: MouseEvent) {
  if (e.button === 1) {
    e.preventDefault();
  }
}

function transformerHighlight(
  transformer: Element,
  highlight: Highlight[],
): TemplateResult {
  const style = getHighlightStyle(transformer, highlight);

  const {
    pos: [x, y],
  } = attributes(transformer);
  const nmWindings = transformer.querySelectorAll('TransformerWinding').length;
  if (nmWindings === 3) {
    return svg`<rect x="${x - 0.8}" y="${
      y - 0.3
    }" width="2.6" height="2.6" style="${style}" pointer-events="none" />`;
  }
  if (nmWindings === 2) {
    return svg`<rect x="${x - 0.3}" y="${
      y - 0.3
    }" width="1.6" height="2.6" style="${style}" pointer-events="none" />`;
  }
  return svg`<rect x="${x - 0.3}" y="${
    y - 0.3
  }" width="1.6" height="1.6" style="${style}" pointer-events="none" />`;
}

function renderTransformerWinding(
  winding: Element,
  context: PowerTransformerContext,
): TemplateResult<2> {
  const {
    size,
    center: [cx, cy],
    terminals,
    grounded,
    arc,
    zigZagTransform,
  } = transformerWindingMeasures(
    winding,
    context.renderedPosition(winding.parentElement!),
    attributes(winding.parentElement!),
    zigZag2WTransform,
  );
  const ports: TemplateResult<2>[] = [];
  Object.entries(grounded).forEach(([_, [[x1, y1], [x2, y2]]]) => {
    ports.push(
      svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="0.06" marker-start="url(#grounded)" />`,
    );
  });
  const groundable = winding.closest('Bay');
  if (
    !(
      context.connecting ||
      context.resizingBR ||
      context.resizingTL ||
      context.placingLabel ||
      (context.placing &&
        context.placing !== winding.closest('PowerTransformer')) ||
      context.disabled
    )
  ) {
    Object.entries(terminals).forEach(([name, point]) => {
      if (!point) {
        return;
      }
      const [x, y] = point;
      const x1 = Number.isInteger(x * 2) ? x : x + 1;
      const y1 = Number.isInteger(y * 2) ? y : y + 1;
      const terminal = name.startsWith('T');
      const fill = terminal ? 'BB1326' : '12579B';
      ports.push(svg`<circle class="port" cx="${x}" cy="${y}" r="0.2" opacity="0.4"
            @contextmenu=${(e: MouseEvent) => {
              if (terminal) {
                return;
              }
              e.preventDefault();
              e.stopImmediatePropagation();
              if (!context.idle) {
                return;
              }
              context.groundTerminal(winding, name as 'T1' | 'T2' | 'N1' | 'N2');
            }}
            @click=${(e: MouseEvent) => {
              e.stopImmediatePropagation();
              if (!context.idle) {
                return;
              }
              context.dispatch(
                newStartConnectEvent({
                  from: winding,
                  fromTerminal: name as 'T1' | 'T2' | 'N1' | 'N2',
                  path: [
                    [x, y],
                    [x1, y1],
                  ],
                }),
              );
            }}
            fill="#${fill}"
            stroke="${groundable && !terminal ? '#F5E214' : fill}" />`);
    });
  }
  let longArrow = false;
  let arcPath = svg``;
  const { flip, rot } = attributes(winding.parentElement!);
  if (arc) {
    const {
      from: [xf, yf],
      fromCtl: [xfc, yfc],
      to: [xt, yt],
      toCtl: [xtc, ytc],
    } = arc;
    if (!flip && yfc < yf) {
      longArrow = true;
    }
    if (flip && xfc > xf) {
      longArrow = true;
    }
    arcPath = svg`<path d="M ${xf} ${yf} C ${xfc} ${yfc}, ${xtc} ${ytc}, ${xt} ${yt}" stroke="black" stroke-width="0.06" />`;
  }
  const tapChanger = winding.querySelector('TapChanger');
  const ltcArrow = tapChanger
    ? svg`<line x1="${cx - 0.8}" y1="${cy + 0.8}" x2="${cx + 0.8}" y2="${
      cy - (longArrow ? 1 : 0.8)
    }"
            stroke="black" stroke-width="0.06" marker-end="url(#arrow)" />`
    : nothing;
  const zigZag =
    zigZagTransform === undefined
      ? nothing
      : svg`<g stroke="black" stroke-linecap="round"
              transform="rotate(${rot * 90} ${cx} ${cy})
              translate(${cx - 1.5} ${cy - 1.5})
              ${zigZagTransform}">${zigZagPath}</g>`;

  return svg`<g class="winding"
      @contextmenu=${(e: MouseEvent) => {
        e.preventDefault();
        if (!context.idle) {
          return;
        }
        context.openContextMenu(winding, e);
      }}
  ><circle cx="${cx}" cy="${cy}" r="${size}" stroke="black" stroke-width="0.06" />${arcPath}${zigZag}${ltcArrow}${ports}</g>`;
}

function powerTransformerState(
  transformer: Element,
  context: PowerTransformerContext,
  { preview = false }: ArtifactRenderOptions = {},
): PowerTransformerRenderState | undefined {
  if (context.placing === transformer && !preview) {
    return undefined;
  }

  return {
    disabled: context.disabled,
    highlight: isToBeHighlighted(transformer, context.highlight)
      ? transformerHighlight(transformer, context.highlight)
      : '',
    placingSelf: context.placing === transformer,
    position: context.renderedPosition(transformer),
    selectable: isSelectable(transformer, context.selectable),
    windings: Array.from(transformer.children).filter(
      c => c.tagName === 'TransformerWinding',
    ),
  };
}

function powerTransformerActions(
  transformer: Element,
  context: PowerTransformerContext,
  state: PowerTransformerRenderState,
): PowerTransformerRenderActions {
  const [x, y] = state.position;
  const offset: Point = [context.mouseX - x, context.mouseY - y];

  let handleClick: ((e: MouseEvent) => void) | symbol = nothing;
  if (context.placing === transformer) {
    handleClick = (e: MouseEvent) => {
      if (context.placing === transformer) {
        const parent =
          Array.from(
            context.substation.querySelectorAll(':scope > VoltageLevel > Bay'),
          )
            .concat(
              Array.from(
                context.substation.querySelectorAll(':scope > VoltageLevel'),
              ),
            )
            .find(vl => containsRect(vl, x, y, 1, 1)) || context.substation;
        context.dispatch(
          newPlaceEvent({
            element: transformer,
            parent,
            x,
            y,
          }),
        );
      }

      if (!context.idle) {
        return;
      }

      let placing = transformer;
      if (e.shiftKey) {
        placing = copyElementForPlacement(transformer, context.nsp);
      }
      context.dispatch(newStartPlaceEvent(placing, offset));
    };
  } else if (context.disabled && state.selectable) {
    handleClick = () => context.dispatch(newSelectEvent(transformer));
  } else if (context.disabled || !context.idle) {
    handleClick = () => {};
  } else {
    handleClick = (e: MouseEvent) => {
      let placing = transformer;
      if (e.shiftKey) {
        placing = copyElementForPlacement(transformer, context.nsp);
      }
      context.dispatch(newStartPlaceEvent(placing, offset));
    };
  }

  return {
    onAuxClick: (e: MouseEvent) => {
      if (e.button === 1) {
        context.dispatch(newRotateEvent(transformer));
        e.preventDefault();
      }
    },
    onClick: handleClick,
  };
}

function renderPowerTransformer(
  transformer: Element,
  state: PowerTransformerRenderState,
  actions: PowerTransformerRenderActions,
  context: PowerTransformerContext,
  { preview = false }: ArtifactRenderOptions = {},
): SVGTemplateResult {
  const clickTarget = state.placingSelf
    ? svg`<rect width="1" height="1" fill="none"
          x="${context.mouseX}" y="${context.mouseY}" />`
    : nothing;

  return svg`${state.highlight}<g class="${classMap({
    transformer: true,
    preview,
    disabled: state.disabled,
    selectable: state.selectable,
  })}"
      pointer-events="all"
      @mousedown=${preventDefault}
      @auxclick=${actions.onAuxClick}
      @click=${actions.onClick}>
      ${state.windings.map(w => renderTransformerWinding(w, context))}
      ${clickTarget}
    </g>
    <g class="preview">${
      preview
        ? [
          context.renderLabel(transformer, { preview }),
          ...Array.from(transformer.querySelectorAll('Text')).map(text =>
            context.renderLabel(text, { preview }),
          ),
        ]
        : nothing
    }</g>`;
}

export const powerTransformerArtifact: SldArtifactDescriptor<
  PowerTransformerRenderState,
  PowerTransformerRenderActions,
  PowerTransformerContext
> = {
  actions: powerTransformerActions,
  matches: element => element.tagName === 'PowerTransformer',
  render: renderPowerTransformer,
  state: powerTransformerState,
};
