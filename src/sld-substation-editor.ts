import {
  css,
  html,
  nothing,
  LitElement,
  PropertyValues,
  svg,
  TemplateResult,
  SVGTemplateResult,
} from 'lit';

import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { newEditEventV2 } from '@openscd/oscd-api/utils.js';

import { OscdTextButton } from '@omicronenergy/oscd-ui/button/OscdTextButton.js';
import { OscdDialog } from '@omicronenergy/oscd-ui/dialog/OscdDialog.js';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdIconButton } from '@omicronenergy/oscd-ui/iconbutton/OscdIconButton.js';
// TODO: Replace with oscd-ui notification when available
import { SldSnackbar } from './sld-snackbar.js';
import { OscdOutlinedTextField } from '@omicronenergy/oscd-ui/textfield/OscdOutlinedTextField.js';

import { identity } from '@openscd/scl-lib';
import {
  eqRingPath,
  resizeBRPath,
  resizePath,
  resizeTLPath,
  symbols,
  zigZag2WTransform,
  zigZagPath,
} from './drawing/diagram-symbols.js';
import {
  cleanPath,
  distance,
  findIntersection,
} from './foundations/geometry.js';
import { containsRect } from './foundations/element-geometry.js';
import {
  canPlaceAt,
  canResizeTo,
  canResizeToTL,
} from './foundations/sld-placement.js';
import {
  copyElementForPlacement,
  createGroundTerminalEdits,
} from './foundations/edits.js';
import { connectionStartPoints, isBusBar } from './foundations/connectivity.js';
import {
  attributes,
  getSLDAttributes,
  updateSLDAttributes,
  xmlBoolean,
} from './foundations/sld-attributes.js';
import { transformerWindingMeasures } from './foundations/transformer.js';
import {
  isEqType,
  ringedEqTypes,
  singleTerminal,
} from './foundations/equipment.js';
import {
  iedReferences,
  isIedReferenceElement,
  resolveIed,
} from './foundations/ied.js';
import {
  newConnectEvent,
  newEditIedEvent,
  newPlaceEvent,
  newPlaceLabelEvent,
  newResizeEvent,
  newResizeTLEvent,
  newRotateEvent,
  newSclEditDialogEvent,
  newSelectEvent,
  newStartConnectEvent,
  newStartPlaceEvent,
  newStartPlaceLabelEvent,
  newStartResizeBREvent,
  newStartResizeTLEvent,
} from './foundations/events.js';
import { exportSVG } from './foundations/export.js';
import { privType, sldNs, svgNs, xlinkNs } from './foundations.js';
import {
  SldContextMenu,
  type MenuContext,
} from './context-menu/sld-context-menu.js';

import type { Point } from './foundations/geometry.js';
import type { Style } from './foundations/sld-attributes.js';

function isBay(element: Element) {
  return element.tagName === 'Bay' && !isBusBar(element);
}

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

function transformerHighlight(
  transformer: Element,
  highlight: {
    id: string;
    style: Style;
  }[],
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

/** An editor [[`plugin`]] for editing the `Substation` section. */

export class SldSubstationEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'oscd-text-button': OscdTextButton,
    'oscd-dialog': OscdDialog,
    'oscd-icon': OscdIcon,
    'oscd-icon-button': OscdIconButton,
    // TODO: Replace with oscd-ui notification when available
    'sld-snackbar': SldSnackbar,
    'oscd-outlined-text-field': OscdOutlinedTextField,
    'sld-context-menu': SldContextMenu,
  };

  @property()
  doc!: XMLDocument;

  @property()
  substation!: Element;

  @property()
  docVersion = -1;

  @property()
  gridSize = 32;

  @property()
  nsp = 'esld';

  @property()
  resizingBR?: Element;

  @property()
  resizingTL?: Element;

  @property()
  placing?: Element;

  @property()
  placingOffset: Point = [0, 0];

  @property()
  placingLabel?: Element;

  @property()
  connecting?: {
    from: Element;
    path: Point[];
    fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
  };

  @property()
  showLabels?: boolean;

  @property()
  showIeds?: boolean;

  @property({ type: Boolean }) disabled: boolean = false;

  @property() selectable: string[] = [];

  @property() highlight: { id: string; style: Style }[] = [];

  @state()
  get idle(): boolean {
    return !(
      this.placing ||
      this.resizingBR ||
      this.resizingTL ||
      this.placingLabel ||
      this.connecting
    );
  }

  @query('#resizeSubstationUI')
  resizeSubstationUI!: OscdDialog;

  @query('#substationWidthUI')
  substationWidthUI!: OscdOutlinedTextField;

  @query('#substationHeightUI')
  substationHeightUI!: OscdOutlinedTextField;

  @query('svg#sld')
  sld!: SVGGraphicsElement;

  @query('sld-snackbar')
  groundHint!: SldSnackbar;

  @query('sld-context-menu')
  contextMenu?: SldContextMenu;

  @state()
  mouseX = 0;

  @state()
  mouseY = 0;

  private iedResolutionCache = new Map<Element, Element | null>();

  protected override willUpdate(changedProperties: PropertyValues<this>) {
    if (
      changedProperties.has('doc') ||
      changedProperties.has('docVersion') ||
      changedProperties.has('substation')
    ) {
      this.iedResolutionCache.clear();
    }
  }

  private resolvedIed(referencedIed: Element): Element | null {
    if (!this.iedResolutionCache.has(referencedIed)) {
      this.iedResolutionCache.set(referencedIed, resolveIed(referencedIed));
    }

    return this.iedResolutionCache.get(referencedIed) ?? null;
  }

  @state()
  mouseX2 = 0;

  @state()
  mouseY2 = 0;

  @state()
  mouseX2f = 0;

  @state()
  mouseY2f = 0;

  coordinatesRef: Ref<HTMLElement> = createRef();

  positionCoordinates(e: MouseEvent) {
    const coordinatesDiv = this.coordinatesRef?.value;
    if (coordinatesDiv) {
      coordinatesDiv.style.top = `${e.clientY}px`;
      coordinatesDiv.style.left = `${e.clientX + 16}px`;
    }
  }

  private contextMenuContext(element: Element, e: MouseEvent): MenuContext {
    const [gridX, gridY] =
      e.clientX || e.clientY
        ? this.svgCoordinates(e.clientX, e.clientY).map(Math.floor)
        : [this.mouseX, this.mouseY];

    return { element, x: e.clientX, y: e.clientY, gridX, gridY };
  }

  svgCoordinates(clientX: number, clientY: number) {
    const p = new DOMPoint(clientX, clientY);
    const { x, y } = p.matrixTransform(this.sld.getScreenCTM()!.inverse());
    const result = [x, y].map(coord => Math.max(0, coord)) as Point;
    return result;
  }

  renderedLabelPosition(element: Element, { preview = false } = {}): Point {
    let {
      label: [x, y],
    } = attributes(element);
    const [offsetX, offsetY] =
      isIedReferenceElement(element) &&
      !getSLDAttributes(element, 'x') &&
      preview
        ? [-1, -1]
        : this.placingOffset;
    if (
      this.placing &&
      element.closest(this.placing.localName) === this.placing
    ) {
      const {
        pos: [parentX, parentY],
      } = attributes(this.placing);
      x += this.mouseX - parentX - offsetX;
      y += this.mouseY - parentY - offsetY;
    }
    if (this.placingLabel === element) {
      x = this.mouseX2 - 0.5 - offsetX;
      y = this.mouseY2 + 0.5 - offsetY;
    }
    if (this.resizingTL === element) {
      const {
        pos: [resX, resY],
        dim: [resW, resH],
      } = attributes(element);
      if (resX === x && resY === y) {
        x += Math.min(this.mouseX, resX + resW - 1) - resX;
        y += Math.min(this.mouseY, resY + resH - 1) - resY;
      }
    }
    return [x, y];
  }

  renderedPosition(element: Element): Point {
    let {
      pos: [x, y],
    } = attributes(element);
    if (
      this.placing &&
      element.closest(this.placing.localName) === this.placing
    ) {
      const {
        pos: [parentX, parentY],
      } = attributes(this.placing);
      const [offsetX, offsetY] = this.placingOffset;
      x += this.mouseX - parentX - offsetX;
      y += this.mouseY - parentY - offsetY;
    }
    return [x, y];
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('click', this.positionCoordinates);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('click', this.positionCoordinates);
  }

  handleExport() {
    exportSVG({
      svg: this.sld,
      filename: `${this.substation.getAttribute('name')}.svg`,
    });
  }

  nearestOpenTerminal(equipment?: Element): 'T1' | 'T2' | undefined {
    if (!equipment) {
      return undefined;
    }
    const topTerminal = equipment.querySelector('Terminal[name="T1"]');
    const bottomTerminal = equipment.querySelector('Terminal:not([name="T1"])');
    const oneSided = singleTerminal.has(equipment.getAttribute('type')!);
    if (topTerminal && bottomTerminal) {
      return undefined;
    }
    if (oneSided && (topTerminal || bottomTerminal)) {
      return undefined;
    }
    if (oneSided) {
      return 'T1';
    }
    if (topTerminal) {
      return 'T2';
    }
    if (bottomTerminal) {
      return 'T1';
    }

    const [mx, my] = [this.mouseX2f, this.mouseY2f];
    const {
      rot,
      pos: [x, y],
    } = attributes(equipment);
    if (rot === 0 && my >= y + 0.5) {
      return 'T2';
    }
    if (rot === 1 && mx < x + 0.5) {
      return 'T2';
    }
    if (rot === 2 && my < y + 0.5) {
      return 'T2';
    }
    if (rot === 3 && mx >= x + 0.5) {
      return 'T2';
    }
    return 'T1';
  }

  groundTerminal(equipment: Element, name: 'T1' | 'T2' | 'N1' | 'N2') {
    const edits = createGroundTerminalEdits(equipment, name);
    if (!edits) {
      this.groundHint.show();
      return;
    }

    this.dispatchEvent(newEditEventV2(edits));
  }

  render() {
    const {
      dim: [w, h],
    } = attributes(this.substation);

    const placingTarget =
      this.placing?.tagName === 'VoltageLevel'
        ? svg`<rect width="100%" height="100%" fill="url(#grid)" />`
        : nothing;

    const transformerPlacingTarget =
      this.placing?.tagName === 'PowerTransformer'
        ? svg`<rect width="100%" height="100%" fill="url(#grid)" />`
        : nothing;

    const iedPlacingTarget =
      !!this.placing && isIedReferenceElement(this.placing)
        ? svg`<rect
            width="100%"
            height="100%"
            fill="url(#grid)"
            @click=${() => {
              const element = this.placing!;
              const [x, y] = this.renderedPosition(element);
              if (!canPlaceAt(this.substation, element, x, y, 1, 1)) {
                return;
              }

              const parent =
                Array.from(
                  this.substation.querySelectorAll(
                    ':scope > VoltageLevel > Bay',
                  ),
                )
                  .concat(
                    Array.from(
                      this.substation.querySelectorAll(':scope > VoltageLevel'),
                    ),
                  )
                  .find(vlOrBay => containsRect(vlOrBay, x, y, 1, 1)) ||
                this.substation;

              this.dispatchEvent(newPlaceEvent({ x, y, element, parent }));
            }}
          />`
        : nothing;

    const placingLabelTarget = this.placingLabel
      ? svg`<rect width="100%" height="100%" fill="url(#halfgrid)"
      @click=${() => {
        const element = this.placingLabel!;
        const [x, y] = this.renderedLabelPosition(element, { preview: true });
        this.dispatchEvent(newPlaceLabelEvent({ element, x, y }));
      }}
      />`
      : nothing;

    let placingElement = svg``;
    if (this.placing) {
      if (this.placing.tagName === 'VoltageLevel' || isBay(this.placing)) {
        placingElement = this.renderContainer(this.placing, true);
      } else if (this.placing.tagName === 'ConductingEquipment') {
        placingElement = this.renderEquipment(this.placing, { preview: true });
      } else if (isIedReferenceElement(this.placing)) {
        placingElement = this.renderIed(this.placing, { preview: true });
      } else if (this.placing.tagName === 'PowerTransformer') {
        placingElement = this.renderPowerTransformer(this.placing, true);
      } else if (isBusBar(this.placing)) {
        placingElement = this.renderBusBar(this.placing);
      }
    }

    let coordinates = html``;
    let invalid = false;
    let hidden = true;

    if (this.placing) {
      const {
        dim: [w0, h0],
      } = attributes(this.placing);
      hidden = false;
      const [offsetX, offsetY] = this.placingOffset;
      const x = this.mouseX - offsetX;
      const y = this.mouseY - offsetY;
      invalid = !canPlaceAt(this.substation, this.placing, x, y, w0, h0);
      coordinates = html`${x},${y}`;
    }

    if (this.resizingBR && !isBusBar(this.resizingBR)) {
      const {
        pos: [x, y],
      } = attributes(this.resizingBR);
      const newW = Math.max(1, this.mouseX - x + 1);
      const newH = Math.max(1, this.mouseY - y + 1);
      hidden = false;
      invalid = !canResizeTo(this.substation, this.resizingBR, newW, newH);
      coordinates = html`${newW}&times;${newH}`;
    }

    if (this.resizingTL) {
      const {
        pos: [x, y],
        dim: [resW, resH],
      } = attributes(this.resizingTL);
      const newW = Math.max(1, x + resW - this.mouseX);
      const newH = Math.max(1, y + resH - this.mouseY);
      const newX = Math.min(this.mouseX, x + resH - 1);
      const newY = Math.min(this.mouseY, y + resW - 1);
      hidden = false;
      invalid = !canResizeToTL(
        this.substation,
        this.resizingTL,
        newX,
        newY,
        newW,
        newH,
      );
      coordinates = html`${newW}&times;${newH}`;
    }

    const coordinateTooltip = html`<div
      ${ref(this.coordinatesRef)}
      class="${classMap({ coordinates: true, invalid, hidden })}"
    >
      (${coordinates})
    </div>`;

    const connectionPreview = [];
    if (this.connecting?.from.closest('Substation') === this.substation) {
      const { from, path, fromTerminal } = this.connecting;
      let i = 0;
      while (i < path.length - 2) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[i + 1];
        connectionPreview.push(
          svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke-linecap="square" stroke="black" />`,
        );
        i += 1;
      }

      const [[x1, y1], [oldX2, oldY2]] = path.slice(-2);
      const vertical = x1 === oldX2;

      let x3 = this.mouseX2;
      let y3 = this.mouseY2;

      let [x4, y4] = [x3, y3];

      const targetEq = Array.from(
        this.substation.querySelectorAll('ConductingEquipment'),
      )
        .filter(eq => eq !== from)
        .find((eq) => {
          const {
            pos: [x, y],
          } = attributes(eq);
          return x === this.mouseX && y === this.mouseY;
        });

      const toTerminal = this.nearestOpenTerminal(targetEq);

      if (targetEq && toTerminal) {
        const [close, far] = connectionStartPoints(targetEq)[toTerminal];
        [x3, y3] = far;
        [x4, y4] = close;
      }

      const x2 = vertical ? oldX2 : x3;
      const y2 = vertical ? y3 : oldY2;

      connectionPreview.push(
        svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                stroke-linecap="square" stroke="black" />`,
        svg`<line x1="${x2}" y1="${y2}" x2="${x3}" y2="${y3}"
                stroke-linecap="square" stroke="black" />`,
        svg`<line x1="${x3}" y1="${y3}" x2="${x4}" y2="${y4}"
                stroke-linecap="square" stroke="black" />`,
      );
      connectionPreview.push(
        svg`<rect width="100%" height="100%" fill="url(#grid)"
      @click=${() => {
        path[path.length - 1] = [x2, y2];
        path.push([x3, y3]);
        path.push([x4, y4]);
        cleanPath(path);
        this.requestUpdate();
        if (targetEq && toTerminal) {
          this.dispatchEvent(
            newConnectEvent({
              from,
              fromTerminal,
              path,
              to: targetEq,
              toTerminal,
            }),
          );
        }
      }} />`,
      );
    }

    return html`<section>
      <h2 class="${classMap({ disabled: this.disabled })}">
        ${this.substation.getAttribute('name')}
        <oscd-icon-button
          label="Edit Substation"
          title="Edit Substation"
          @click=${() =>
            this.dispatchEvent(newSclEditDialogEvent(this.substation))}
        >
          <oscd-icon>edit</oscd-icon>
        </oscd-icon-button>
        <oscd-icon-button
          label="Resize Substation"
          title="Resize Substation"
          @click=${() => {
            this.resizeSubstationUI.open = true;
          }}
        >
          <svg
            xmlns="${svgNs}"
            width="24"
            height="24"
            viewBox="0 96 960 960"
            opacity="0.83"
          >
            ${resizePath}
          </svg>
        </oscd-icon-button>
        <oscd-icon-button
          label="Delete Substation"
          title="Delete Substation"
          @click=${() =>
            this.dispatchEvent(newEditEventV2({ node: this.substation }))}
        >
          <oscd-icon>delete</oscd-icon>
        </oscd-icon-button>
        <oscd-icon-button
          label="Export Single Line Diagram SVG"
          title="Export Single Line Diagram SVG"
          @click=${() => this.handleExport()}
        >
          <oscd-icon>file_download</oscd-icon>
        </oscd-icon-button>
      </h2>
      <svg
        xmlns="${svgNs}"
        xmlns:xlink="${xlinkNs}"
        id="sld"
        viewBox="0 0 ${w} ${h}"
        width="${w * this.gridSize}"
        height="${h * this.gridSize}"
        stroke-width="0.06"
        fill="none"
        @mousemove=${(e: MouseEvent) => {
          if (this.disabled) {
            return;
          }

          const [x, y] = this.svgCoordinates(e.clientX, e.clientY);
          this.mouseX = Math.floor(x);
          this.mouseY = Math.floor(y);
          this.mouseX2 = Math.round(x * 2) / 2;
          this.mouseY2 = Math.round(y * 2) / 2;
          this.mouseX2f = Math.floor(x * 2) / 2;
          this.mouseY2f = Math.floor(y * 2) / 2;
          this.positionCoordinates(e);
        }}
      >
        <style>
          .handle {
            visibility: hidden;
          }
          :focus {
            outline: none;
          }
          g:hover > .handle {
            opacity: 0.2;
            visibility: visible;
          }
          g:hover > .handle:hover {
            visibility: visible;
            opacity: 0.83;
          }
          g.voltagelevel > rect,
          g.bay > rect {
            shape-rendering: crispEdges;
          }
          svg:not(:hover) .preview {
            visibility: hidden;
          }
          .preview {
            opacity: 0.75;
          }
        </style>
        ${symbols}
        <rect width="100%" height="100%" fill="white" />
        ${placingTarget}
        ${Array.from(this.substation.children)
          .filter(child => child.tagName === 'VoltageLevel')
          .map(vl => svg`${this.renderContainer(vl)}`)}
        ${connectionPreview}
        ${this.connecting?.from.closest('Substation') === this.substation
          ? Array.from(
            this.substation.querySelectorAll('ConductingEquipment'),
          ).map(eq => this.renderEquipment(eq, { connect: true }))
          : nothing}
        ${Array.from(this.substation.querySelectorAll('ConnectivityNode'))
          .filter(
            node =>
              node.getAttribute('name') !== 'grounded' &&
              !(
                this.placing &&
                node.closest(this.placing.localName) === this.placing
              ) &&
              !isBusBar(node.parentElement!),
          )
          .map(cNode => this.renderConnectivityNode(cNode))}
        ${Array.from(this.substation.querySelectorAll('ConnectivityNode'))
          .filter(
            node =>
              node.getAttribute('name') !== 'grounded' &&
              !(
                this.placing &&
                node.closest(this.placing.localName) === this.placing
              ) &&
              isBusBar(node.parentElement!),
          )
          .map(cNode => this.renderConnectivityNode(cNode))}
        ${Array.from(
          this.substation.querySelectorAll(':scope > PowerTransformer'),
        ).map(transformer => this.renderPowerTransformer(transformer))}
        ${iedReferences(this.substation)
          .filter(
            referencedIed =>
              referencedIed.parentElement?.tagName === 'Private' &&
              !['Bay', 'VoltageLevel'].includes(
                referencedIed.parentElement!.parentElement!.tagName,
              ) &&
              (!this.placing ||
                referencedIed.closest(this.placing.localName) !== this.placing),
          )
          .map(ied => this.renderIed(ied))}
        ${Array.from(
          this.substation.querySelectorAll(
            'VoltageLevel, Bay, ConductingEquipment, PowerTransformer, Text',
          ),
        )
          .concat(
            Array.from(
              this.substation.querySelectorAll(
                'Private[type="OpenSCD-SLD-Layout"]',
              ) ?? [],
            ).flatMap(privateLayout => iedReferences(privateLayout)),
          )
          .filter(
            e =>
              !this.placing ||
              e.closest(this.placing.localName) !== this.placing,
          )
          .map(element => this.renderLabel(element))}
        ${transformerPlacingTarget} ${iedPlacingTarget} ${placingLabelTarget}
        ${placingElement}
      </svg>
      ${this.disabled
        ? nothing
        : html`<sld-context-menu
            .doc=${this.doc}
            .nsp=${this.nsp}
            @sld-ground-hint=${() => this.groundHint.show()}
          ></sld-context-menu>`}
      ${coordinateTooltip}
      <oscd-dialog id="resizeSubstationUI">
        <div slot="headline">
          Resize ${this.substation.getAttribute('name')}
        </div>
        <form
          slot="content"
          style="display: flex; flex-direction: column; gap: 12px;"
        >
          <oscd-outlined-text-field
            id="substationWidthUI"
            type="number"
            min="1"
            step="1"
            label="Width"
            value="${w}"
            dialogInitialFocus
            autoValidate
            .validityTransform=${(value: string, validity: ValidityState) => {
              const {
                dim: [_w, oldH],
              } = attributes(this.substation);
              if (
                validity.valid &&
                !canResizeTo(
                  this.substation,
                  this.substation,
                  parseInt(value, 10),
                  oldH,
                )
              ) {
                return { valid: false, rangeUnderflow: true };
              }
              return {};
            }}
          ></oscd-outlined-text-field>
          <oscd-outlined-text-field
            id="substationHeightUI"
            type="number"
            min="1"
            step="1"
            label="Height"
            value="${h}"
            autoValidate
            .validityTransform=${(value: string, validity: ValidityState) => {
              const {
                dim: [oldW, _h],
              } = attributes(this.substation);
              if (
                validity.valid &&
                !canResizeTo(
                  this.substation,
                  this.substation,
                  oldW,
                  parseInt(value, 10),
                )
              ) {
                return { valid: false, rangeUnderflow: true };
              }
              return {};
            }}
          ></oscd-outlined-text-field>
        </form>
        <div slot="actions">
          <oscd-text-button
            @click=${() => {
              this.resizeSubstationUI.open = false;
            }}
            >cancel</oscd-text-button
          >
          <oscd-text-button
            @click=${() => {
              const valid = Array.from(
                this.resizeSubstationUI.querySelectorAll(
                  'oscd-outlined-text-field',
                ),
              ).every(textField => textField.checkValidity());
              if (!valid) {
                return;
              }
              const {
                dim: [oldW, oldH],
              } = attributes(this.substation);
              const [newW, newH] = [
                this.substationWidthUI,
                this.substationHeightUI,
              ].map(ui => parseInt(ui.value ?? '1', 10).toString());
              this.resizeSubstationUI.open = false;
              if (newW === oldW.toString() && newH === oldH.toString()) {
                return;
              }
              const resizeEdit = updateSLDAttributes(
                this.substation,
                this.nsp,
                {
                  w: newW,
                  h: newH,
                },
              );
              this.dispatchEvent(newEditEventV2(resizeEdit));
            }}
            >resize</oscd-text-button
          >
        </div>
      </oscd-dialog>
      <sld-snackbar
        labelText="Only transformers within a bay may be grounded directly."
      >
      </sld-snackbar>
    </section>`;
  }

  renderLabel(element: Element, { preview = false } = {}) {
    if (!this.showLabels) {
      return nothing;
    }
    if (this.showIeds === false && isIedReferenceElement(element)) {
      return nothing;
    }

    let deg = 0;
    let text: string | null | TemplateResult<2>[] =
      element.getAttribute('name') ||
      this.resolvedIed(element)?.getAttribute('name') ||
      element.getAttributeNS(sldNs, 'name');
    let weight = 400;
    let color = 'black';
    const [x, y] = this.renderedLabelPosition(element, { preview });

    if (element.tagName === 'Text') {
      ({ weight, color } = attributes(element));
      deg = attributes(element).rot * 90;
      if (element.textContent) {
        text = element.textContent?.split(/\r?\n/).map(
          (line, i) =>
            svg`<tspan alignment-baseline="central"
                  x="${x + 0.1}" dy="${i === 0 ? nothing : '1.19em'}"
                  visibility="${line ? nothing : 'hidden'}">
                  ${line || '.'}
                </tspan>`,
        );
      } else {
        text = '<Middle click to edit>';
        color = '#aaa';
        weight = 500;
      }
    }

    if (isIedReferenceElement(element) && !this.placing && !this.placingLabel) {
      color = this.resolvedIed(element) ? color : '#BB1326';
    }

    const fontSize = element.tagName === 'ConductingEquipment' ? 0.45 : 0.6;
    let events = 'none';

    let handleClick: (() => void) | symbol = nothing;
    if (this.idle && !this.disabled) {
      events = 'all';
      const offset = [this.mouseX2 - x - 0.5, this.mouseY2 - y + 0.5] as Point;
      handleClick = () =>
        this.dispatchEvent(newStartPlaceLabelEvent(element, offset));
    } else if (this.disabled && isSelectable(element, this.selectable)) {
      events = 'all';
      handleClick = () => this.dispatchEvent(newSelectEvent(element));
    }

    let auxclick: ((e: MouseEvent) => void) | symbol = nothing;
    if (!this.disabled) {
      auxclick = (e: MouseEvent) => {
        if (e.button === 1) {
          // middle mouse button
          if (!isIedReferenceElement(element)) {
            this.dispatchEvent(newSclEditDialogEvent(element));
          } else {
            const ied = this.resolvedIed(element);
            if (ied) {
              this.dispatchEvent(newEditIedEvent(ied));
            }
          }
          e.preventDefault();
        }
      };
    }

    let contextmenu: ((e: MouseEvent) => void) | symbol = nothing;
    if (!this.disabled) {
      contextmenu = (e: MouseEvent) => {
        e.preventDefault();
        if (!this.idle) {
          return;
        }
        this.contextMenu?.open(this.contextMenuContext(element, e));
      };
    }

    let id: typeof nothing | string = nothing;
    if (element.closest('Substation') === this.substation) {
      if (element.localName !== 'Text' && !isIedReferenceElement(element)) {
        id = `${identity(element)}`;
      }
      if (isIedReferenceElement(element)) {
        id = `${this.resolvedIed(element)?.getAttribute('name') ?? ''}`;
      }
    }
    const classes = classMap({
      label: true,
      container:
        (element.tagName === 'Bay' && !isBusBar(element)) ||
        element.tagName === 'VoltageLevel',
      disabled: this.disabled,
      selectable: isSelectable(element, this.selectable),
    });
    return svg`<g class="${classes}" id="label:${id}"
                 transform="rotate(${deg} ${x + 0.5} ${y - 0.5})">
        <text x="${x + 0.1}" y="${y - 0.5}"
          alignment-baseline="central"
          @mousedown=${preventDefault}
          @auxclick=${auxclick}
          @click=${handleClick}
          @contextmenu=${contextmenu}
          pointer-events="${events}" fill="${color}" font-weight="${weight}"
          font-size="${fontSize}px" font-family="Roboto, sans-serif"
          style="cursor: default;">
          ${text}
        </text>
      </g>`;
  }

  renderContainer(bayOrVL: Element, preview = false): TemplateResult<2> {
    const isVL = bayOrVL.tagName === 'VoltageLevel';
    if (this.placing === bayOrVL && !preview) {
      return svg``;
    }

    let [x, y] = this.renderedPosition(bayOrVL);
    const offset: Point = [this.mouseX - x, this.mouseY - y];
    let {
      dim: [w, h],
    } = attributes(bayOrVL);

    const right = x + w - 1;
    const bottom = y + h - 1;

    let handleClick = (e: MouseEvent) => {
      if (this.idle) {
        this.dispatchEvent(
          newStartPlaceEvent(
            e.shiftKey ? copyElementForPlacement(bayOrVL, this.nsp) : bayOrVL,
            offset,
          ),
        );
      }
    };
    let invalid = false;

    let contextmenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!this.idle) {
        return;
      }
      this.contextMenu?.open(this.contextMenuContext(bayOrVL, e));
    };
    if (this.disabled) {
      contextmenu = () => {};
    }

    let auxclick = ({ clientX, clientY, button }: MouseEvent) => {
      if (button !== 1) {
        return;
      }
      const mouse = this.svgCoordinates(clientX, clientY);
      if (distance(mouse, [x, y]) < distance(mouse, [right, bottom])) {
        this.dispatchEvent(newStartResizeTLEvent(bayOrVL));
      } else {
        this.dispatchEvent(newStartResizeBREvent(bayOrVL));
      }
    };
    if (this.disabled) {
      auxclick = () => {};
    }

    if (this.resizingBR === bayOrVL) {
      w = Math.max(1, this.mouseX - x + 1);
      h = Math.max(1, this.mouseY - y + 1);
      if (canResizeTo(this.substation, bayOrVL, w, h)) {
        handleClick = () =>
          this.dispatchEvent(
            newResizeEvent({
              w,
              h,
              element: bayOrVL,
            }),
          );
      } else {
        invalid = true;
      }
    }

    if (this.resizingTL === bayOrVL) {
      w = Math.max(1, x + w - this.mouseX);
      h = Math.max(1, y + h - this.mouseY);
      x = Math.min(this.mouseX, right);
      y = Math.min(this.mouseY, bottom);
      if (canResizeToTL(this.substation, bayOrVL, x, y, w, h)) {
        handleClick = () =>
          this.dispatchEvent(
            newResizeTLEvent({
              x,
              y,
              w,
              h,
              element: bayOrVL,
            }),
          );
      } else {
        invalid = true;
      }
    }

    if (this.placing === bayOrVL) {
      let parent: Element | undefined;
      if (isVL) {
        parent = this.substation;
      } else {
        parent = Array.from(
          this.substation.querySelectorAll(':root > Substation > VoltageLevel'),
        ).find(vl => containsRect(vl, x, y, w, h));
      }
      if (parent && canPlaceAt(this.substation, bayOrVL, x, y, w, h)) {
        handleClick = () =>
          this.dispatchEvent(
            newPlaceEvent({
              x,
              y,
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
      (isVL && this.placing?.tagName === 'Bay') ||
      (!isVL && this.placing?.tagName === 'ConductingEquipment')
    ) {
      placingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
        @click=${handleClick} fill="url(#grid)" />`;
    }

    if (
      this.resizingBR === bayOrVL ||
      this.resizingTL === bayOrVL ||
      (this.resizingBR?.parentElement === bayOrVL && isBusBar(this.resizingBR))
    ) {
      resizingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
        @click=${handleClick || nothing} fill="url(#grid)" />`;
    }

    const resizeBRHandle =
      this.idle && !this.disabled
        ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
          opacity="0.83" class="handle"
          @click=${() => this.dispatchEvent(newStartResizeBREvent(bayOrVL))}
          viewBox="0 96 960 960" x="${w + x - 1}" y="${h + y - 1}">
          <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
          ${resizeBRPath}
        </svg>`
        : nothing;
    const resizeTLhandle =
      this.idle && !this.disabled
        ? svg`<svg xmlns="${svgNs}" height="1" width="1" fill="black"
          opacity="0.83" class="handle"
          @click=${() => this.dispatchEvent(newStartResizeTLEvent(bayOrVL))}
          viewBox="0 96 960 960" x="${x}" y="${y}">
          <rect fill="white" x="28.8" y="124.8" width="902.4" height="902.4" />
          ${resizeTLPath}
        </svg>`
        : nothing;

    const clickthrough =
      this.disabled ||
      (!this.idle &&
        this.placing !== bayOrVL &&
        this.resizingBR !== bayOrVL &&
        this.resizingTL !== bayOrVL);

    let strokeColor: string;
    if (invalid) {
      strokeColor = '#BB1326';
    } else if (isVL) {
      strokeColor = '#F5E214';
    } else {
      strokeColor = '#12579B';
    }

    const highlighted = isToBeHighlighted(bayOrVL, this.highlight);
    const highlight = highlighted
      ? svg`<rect x="${x}" y="${y}" width="${w}" height="${h}" style="${getHighlightStyle(
        bayOrVL,
        this.highlight,
      )}" pointer-events="none" />`
      : '';

    return svg`${highlight}<g id="${
      bayOrVL.closest('Substation') === this.substation
        ? identity(bayOrVL)
        : nothing
    }" class=${classMap({
      voltagelevel: isVL,
      bay: !isVL,
      preview,
    })} tabindex="0" pointer-events="${
      clickthrough ? 'none' : 'all'
    }" style="outline: none;">
      <rect x="${x}" y="${y}" width="${w}" height="${h}"
        @contextmenu=${contextmenu}
        @click=${handleClick || nothing} @mousedown=${preventDefault}
        @auxclick=${auxclick}
        fill="${highlighted ? 'none' : 'white'}" stroke-dasharray="${
          isVL ? nothing : '0.18'
        }"
        stroke="${strokeColor}" />
      ${Array.from(bayOrVL.children)
        .filter(isBay)
        .map(bay => this.renderContainer(bay, preview))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'ConductingEquipment')
        .map(equipment => this.renderEquipment(equipment))}
      ${Array.from(bayOrVL.children)
        .filter(child => child.tagName === 'PowerTransformer')
        .map(equipment => this.renderPowerTransformer(equipment))}
      ${iedReferences(bayOrVL)
        .filter(
          referencedIed =>
            referencedIed.parentElement?.tagName === 'Private' &&
            referencedIed.parentElement!.parentElement === bayOrVL,
        )
        .map(referencedIed => this.renderIed(referencedIed, { preview }))}
      ${
        preview
          ? Array.from(bayOrVL.querySelectorAll('ConnectivityNode'))
            .filter(child => child.getAttribute('name') !== 'grounded')
            .map(cNode => this.renderConnectivityNode(cNode))
          : nothing
      }
      ${
        preview
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
            .map(element => this.renderLabel(element, { preview }))
          : nothing
      }
      ${resizeTLhandle}
      ${resizeBRHandle}
      ${placingTarget}
      ${resizingTarget}
    </g>`;
  }

  renderTransformerWinding(winding: Element): TemplateResult<2> {
    const {
      size,
      center: [cx, cy],
      terminals,
      grounded,
      arc,
      zigZagTransform,
    } = transformerWindingMeasures(
      winding,
      this.renderedPosition(winding.parentElement!),
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
        this.connecting ||
        this.resizingBR ||
        this.resizingTL ||
        this.placingLabel ||
        (this.placing &&
          this.placing !== winding.closest('PowerTransformer')) ||
        this.disabled
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
                if (!this.idle) {
                  return;
                }
                this.groundTerminal(winding, name as 'T1' | 'T2' | 'N1' | 'N2');
              }}
              @click=${(e: MouseEvent) => {
                e.stopImmediatePropagation();
                if (!this.idle) {
                  return;
                }
                this.dispatchEvent(
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
          if (!this.idle) {
            return;
          }
          this.contextMenu?.open(this.contextMenuContext(winding, e));
        }}
    ><circle cx="${cx}" cy="${cy}" r="${size}" stroke="black" stroke-width="0.06" />${arcPath}${zigZag}${ltcArrow}${ports}</g>`;
  }

  renderPowerTransformer(
    transformer: Element,
    preview = false,
  ): TemplateResult<2> {
    if (this.placing === transformer && !preview) {
      return svg``;
    }
    const windings = Array.from(transformer.children).filter(
      c => c.tagName === 'TransformerWinding',
    );
    const [x, y] = this.renderedPosition(transformer);
    const offset: Point = [this.mouseX - x, this.mouseY - y];

    const clickTarget =
      this.placing === transformer
        ? svg`<rect width="1" height="1" fill="none"
              x="${this.mouseX}" y="${this.mouseY}" />`
        : nothing;

    let handleClick: ((e: MouseEvent) => void) | symbol = nothing;
    if (this.placing === transformer) {
      handleClick = (e: MouseEvent) => {
        if (this.placing === transformer) {
          const parent =
            Array.from(
              this.substation.querySelectorAll(':scope > VoltageLevel > Bay'),
            )
              .concat(
                Array.from(
                  this.substation.querySelectorAll(':scope > VoltageLevel'),
                ),
              )
              .find(vl => containsRect(vl, x, y, 1, 1)) || this.substation;
          this.dispatchEvent(
            newPlaceEvent({
              element: transformer,
              parent,
              x,
              y,
            }),
          );
        }

        if (!this.idle) {
          return;
        }

        let placing = transformer;
        if (e.shiftKey) {
          placing = copyElementForPlacement(transformer, this.nsp);
        }
        this.dispatchEvent(newStartPlaceEvent(placing, offset));
      };
    } else if (this.disabled && isSelectable(transformer, this.selectable)) {
      handleClick = () => this.dispatchEvent(newSelectEvent(transformer));
    } else if (this.disabled || !this.idle) {
      handleClick = () => {};
    } else {
      handleClick = (e: MouseEvent) => {
        let placing = transformer;
        if (e.shiftKey) {
          placing = copyElementForPlacement(transformer, this.nsp);
        }
        this.dispatchEvent(newStartPlaceEvent(placing, offset));
      };
    }

    const highlight = isToBeHighlighted(transformer, this.highlight)
      ? transformerHighlight(transformer, this.highlight)
      : '';

    return svg`${highlight}<g class="${classMap({
      transformer: true,
      preview,
      disabled: this.disabled,
      selectable: isSelectable(transformer, this.selectable),
    })}"
        pointer-events="all"
        @mousedown=${preventDefault}
        @auxclick=${(e: MouseEvent) => {
          if (e.button === 1) {
            // middle mouse button
            this.dispatchEvent(newRotateEvent(transformer));
            e.preventDefault();
          }
        }}
        @click=${handleClick}>
        ${windings.map(w => this.renderTransformerWinding(w))}
        ${clickTarget}
      </g>
      <g class="preview">${
        preview
          ? [
            this.renderLabel(transformer, { preview }),
            ...Array.from(transformer.querySelectorAll('Text')).map(text =>
              this.renderLabel(text, { preview }),
            ),
          ]
          : nothing
      }</g>`;
  }

  renderEquipment(
    equipment: Element,
    { preview = false, connect = false } = {},
  ) {
    if (this.placing === equipment && !preview) {
      return svg``;
    }
    if (
      this.connecting?.from.closest('Substation') === this.substation &&
      !connect
    ) {
      return svg``;
    }

    const [x, y] = this.renderedPosition(equipment);
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
      : svg`<use href="#${symbol}" xlink:href="#${symbol}"
              pointer-events="none" />`;

    let handleClick = (e: MouseEvent) => {
      let placing = equipment;
      if (e.shiftKey) {
        placing = copyElementForPlacement(equipment, this.nsp);
      }
      this.dispatchEvent(newStartPlaceEvent(placing));
    };

    if (this.placing === equipment) {
      const parent = Array.from(
        this.substation.querySelectorAll(
          ':root > Substation > VoltageLevel > Bay',
        ),
      ).find(bay => !isBusBar(bay) && containsRect(bay, x, y, 1, 1));
      if (parent && canPlaceAt(this.substation, equipment, x, y, 1, 1)) {
        handleClick = () => {
          this.dispatchEvent(
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

    if (this.disabled && !isSelectable(equipment, this.selectable)) {
      handleClick = () => {};
    }
    if (this.disabled && isSelectable(equipment, this.selectable)) {
      handleClick = () => {
        this.dispatchEvent(newSelectEvent(equipment));
      };
    }

    let auxclick = (e: MouseEvent) => {
      if (e.button === 1) {
        // middle mouse button
        this.dispatchEvent(newRotateEvent(equipment));
        e.preventDefault();
      }
    };
    if (this.disabled) {
      auxclick = () => {};
    }

    let contextmenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!this.idle) {
        return;
      }
      this.contextMenu?.open(this.contextMenuContext(equipment, e));
    };
    if (this.disabled) {
      contextmenu = () => {};
    }

    const terminals = Array.from(equipment.children).filter(
      c => c.tagName === 'Terminal',
    );
    const topTerminal = terminals.find(t => t.getAttribute('name') === 'T1');
    const bottomTerminal = terminals.find(t => t.getAttribute('name') !== 'T1');

    const topConnector =
      topTerminal ||
      this.resizingBR ||
      this.resizingTL ||
      this.connecting ||
      this.placingLabel ||
      (this.placing && this.placing !== equipment) ||
      this.disabled
        ? nothing
        : svg`<circle class="port" cx="0.5" cy="0" r="0.2" opacity="0.4"
      fill="#BB1326" stroke="#F5E214" pointer-events="${
        this.placing ? 'none' : nothing
      }"
    @click=${() =>
      this.dispatchEvent(
        newStartConnectEvent({
          from: equipment,
          fromTerminal: 'T1',
          path: connectionStartPoints(equipment).T1,
        }),
      )}
    @contextmenu=${(e: MouseEvent) => {
      e.preventDefault();
      this.groundTerminal(equipment, 'T1');
    }}
      />`;

    const topIndicator =
      !this.connecting ||
      this.connecting.from === equipment ||
      (this.connecting &&
        this.mouseX === x &&
        this.mouseY === y &&
        this.nearestOpenTerminal(equipment) === 'T1') ||
      topTerminal ||
      this.disabled
        ? nothing
        : svg`<polygon points="0.3,0 0.7,0 0.5,0.4"
                fill="#BB1326" opacity="0.4" />`;

    const topGrounded =
      topTerminal?.getAttribute('cNodeName') === 'grounded'
        ? svg`<line x1="0.5" y1="-0.1" x2="0.5" y2="0.16" stroke="black"
                stroke-width="0.06" marker-start="url(#grounded)" />`
        : nothing;

    const bottomConnector =
      bottomTerminal ||
      this.resizingBR ||
      this.resizingTL ||
      this.connecting ||
      this.placingLabel ||
      (this.placing && this.placing !== equipment) ||
      singleTerminal.has(eqType) ||
      this.disabled
        ? nothing
        : svg`<circle class="port" cx="0.5" cy="1" r="0.2" opacity="0.4"
      fill="#BB1326" stroke="#F5E214" pointer-events="${
        this.placing ? 'none' : nothing
      }"
    @click=${() =>
      this.dispatchEvent(
        newStartConnectEvent({
          from: equipment,
          fromTerminal: 'T2',
          path: connectionStartPoints(equipment).T2,
        }),
      )}
    @contextmenu=${(e: MouseEvent) => {
      e.preventDefault();
      this.groundTerminal(equipment, 'T2');
    }}
      />`;

    const bottomIndicator =
      !this.connecting ||
      this.connecting.from === equipment ||
      (this.connecting &&
        this.mouseX === x &&
        this.mouseY === y &&
        this.nearestOpenTerminal(equipment) === 'T2') ||
      bottomTerminal ||
      singleTerminal.has(eqType) ||
      this.disabled
        ? nothing
        : svg`<polygon points="0.3,1 0.7,1 0.5,0.6"
                fill="#BB1326" opacity="0.4" />`;

    const bottomGrounded =
      bottomTerminal?.getAttribute('cNodeName') === 'grounded'
        ? svg`<line x1="0.5" y1="1.1" x2="0.5" y2="0.84" stroke="black"
                stroke-width="0.06" marker-start="url(#grounded)" />`
        : nothing;

    const clickthrough =
      connect ||
      (!this.idle && this.placing !== equipment) ||
      (this.disabled && !isSelectable(equipment, this.selectable));

    const highlight = isToBeHighlighted(equipment, this.highlight)
      ? svg`<rect x="${x}" y="${y}" width="1" height="1" style="${getHighlightStyle(
        equipment,
        this.highlight,
      )}" pointer-events="none" />`
      : '';

    return svg`${highlight}<g class="${classMap({
      equipment: true,
      preview: this.placing === equipment,
      disabled: this.disabled,
      selectable: isSelectable(equipment, this.selectable),
    })}"
    id="${
      equipment.closest('Substation') === this.substation
        ? identity(equipment)
        : nothing
    }"
    transform="translate(${x} ${y}) rotate(${deg} 0.5 0.5)${
      flip ? ' scale(-1,1) translate(-1 0)' : ''
    }">
      <title>${equipment.getAttribute('name')}</title>
      ${icon}
      ${
        ringed
          ? svg`<use transform="rotate(${-deg} 0.5 0.5)" pointer-events="none"
                  href="#${symbol}" xlink:href="#${symbol}" />`
          : nothing
      }
      <rect width="1" height="1" fill="none" pointer-events="${
        clickthrough ? 'none' : 'all'
      }"
        @mousedown=${preventDefault}
        @click=${handleClick}
        @auxclick=${auxclick}
        @contextmenu=${contextmenu}
      />
      ${topConnector}
      ${topIndicator}
      ${topGrounded}
      ${bottomConnector}
      ${bottomIndicator}
      ${bottomGrounded}
    </g>
    <g class="preview">${
      preview
        ? [
          this.renderLabel(equipment, { preview }),
          ...Array.from(equipment.querySelectorAll('Text')).map(text =>
            this.renderLabel(text, { preview }),
          ),
        ]
        : nothing
    }</g>`;
  }

  renderIed(
    referencedIed: Element,
    { preview = false } = {},
  ): SVGTemplateResult {
    if (this.showIeds === false || (this.placing === referencedIed && !preview)) {
      return svg``;
    }

    const [x, y] = this.renderedPosition(referencedIed);
    const name = this.resolvedIed(referencedIed)?.getAttribute('name');

    let handleClick: ((e: MouseEvent) => void) | symbol = nothing;
    if (
      this.placing === referencedIed &&
      canPlaceAt(this.substation, referencedIed, x, y, 1, 1)
    ) {
      handleClick = () => {
        const parent =
          Array.from(
            this.substation.querySelectorAll(':scope > VoltageLevel > Bay'),
          )
            .concat(
              Array.from(
                this.substation.querySelectorAll(':scope > VoltageLevel'),
              ),
            )
            .find(vlOrBay => containsRect(vlOrBay, x, y, 1, 1)) ||
          this.substation;
        this.dispatchEvent(
          newPlaceEvent({
            x,
            y,
            element: referencedIed,
            parent,
          }),
        );
      };
    } else if (this.disabled && isSelectable(referencedIed, this.selectable)) {
      handleClick = () => this.dispatchEvent(newSelectEvent(referencedIed));
    } else if (!this.idle || this.disabled) {
      handleClick = () => {};
    } else {
      handleClick = () => this.dispatchEvent(newStartPlaceEvent(referencedIed));
    }

    let contextmenu = (e: MouseEvent) => {
      e.preventDefault();
      if (!this.idle) {
        return;
      }
      this.contextMenu?.open(this.contextMenuContext(referencedIed, e));
    };
    if (this.disabled) {
      contextmenu = () => {};
    }

    const clickthrough = !this.idle && this.placing !== referencedIed;

    return svg`<g class="${classMap({
      ied: true,
      preview: this.placing === referencedIed,
      disabled: this.disabled,
      selectable: isSelectable(referencedIed, this.selectable),
    })}"
      id="${
        referencedIed.closest('Substation') === this.substation && name
          ? `IEDRef-${name}`
          : nothing
      }"
      transform="translate(${x} ${y})">
      <title>${name}</title>
      <use href="#IED" xlink:href="#IED" pointer-events="none" />
      <rect width="1" height="1" fill="none" pointer-events="${
        clickthrough ? 'none' : 'all'
      }"
        @mousedown=${preventDefault}
        @click=${handleClick}
        @contextmenu=${contextmenu}
      />
    </g>
    <g class="preview">${
      preview ? this.renderLabel(referencedIed, { preview }) : nothing
    }</g>`;
  }

  renderBusBar(busBar: Element) {
    const [x, y] = this.renderedPosition(busBar);
    const {
      dim: [w, h],
    } = attributes(busBar);

    let handleClick = () => {
      const parent = Array.from(
        this.substation.querySelectorAll(':root > Substation > VoltageLevel'),
      ).find(vl => containsRect(vl, x, y, w, h));
      if (parent) {
        this.dispatchEvent(
          newPlaceEvent({
            x,
            y,
            element: busBar,
            parent: parent!,
          }),
        );
      }
    };
    if (this.disabled) {
      handleClick = () => {};
    }

    let placingTarget = svg``;
    placingTarget = svg`<rect x="${x}" y="${y}" width="${w}" height="${h}"
          pointer-events="all" fill="none"
          @click=${handleClick}
        />`;

    return svg`<g class="bus preview" id="${
      busBar.closest('Substation') === this.substation
        ? identity(busBar)
        : nothing
    }">
      <title>${busBar.getAttribute('name')}</title>
      ${this.renderLabel(busBar)}
      ${Array.from(busBar.querySelectorAll('Text')).map(text =>
        this.renderLabel(text),
      )}
      ${this.renderConnectivityNode(busBar.querySelector('ConnectivityNode')!)}
      ${placingTarget}
    </g>`;
  }

  renderConnectivityNode(cNode: Element) {
    const priv = cNode.querySelector(`Private[type="${privType}"]`);
    if (!priv) {
      return nothing;
    }
    const circles = [] as TemplateResult<2>[];
    const intersections = Object.entries(
      Array.from(priv.querySelectorAll('Vertex')).reduce(
        (record, vertex) => {
          const ret = record;
          const key = JSON.stringify(this.renderedPosition(vertex));
          if (ret[key]) {
            ret[key].push(vertex);
          } else {
            ret[key] = [vertex];
          }
          return ret;
        },
        {} as Record<string, Element[]>,
      ),
    )
      .filter(
        ([_, vertices]) =>
          vertices.length > 2 ||
          (vertices.length === 2 &&
            vertices.find(v => v.hasAttributeNS(sldNs, 'uuid'))),
      )
      .map(([_, [vertex]]) => this.renderedPosition(vertex));
    intersections.forEach(([x, y]) =>
      circles.push(svg`<circle fill="black" cx="${x}" cy="${y}" r="0.15" />`),
    );
    const lines = [] as TemplateResult<2>[];
    const sections = Array.from(priv.getElementsByTagNameNS(sldNs, 'Section'));
    const bay = cNode.closest('Bay');
    const targetSize = 0.5;
    const pointerEvents =
      !this.placing &&
      (!this.resizingBR || (this.resizingBR === bay && isBusBar(bay)))
        ? 'all'
        : 'none';
    sections.forEach((section) => {
      const busBar = xmlBoolean(section.getAttributeNS(sldNs, 'bus'));
      const vertices = Array.from(
        section.getElementsByTagNameNS(sldNs, 'Vertex'),
      );
      let i = 0;
      while (i < vertices.length - 1) {
        const [x1, y1] = this.renderedPosition(vertices[i]);
        let [x2, y2] = this.renderedPosition(vertices[i + 1]);
        let handleClick: (() => void) | symbol = nothing;
        let handleAuxClick: ((e: MouseEvent) => void) | symbol = nothing;
        let handleContextMenu: ((e: MouseEvent) => void) | symbol = nothing;
        if (busBar && bay && !this.disabled) {
          const {
            pos: [x, y],
          } = attributes(bay);
          const offset: Point = [this.mouseX - x, this.mouseY - y];
          handleClick = () =>
            this.dispatchEvent(newStartPlaceEvent(bay, offset));
          handleAuxClick = ({ button }: MouseEvent) => {
            if (button === 1) {
              this.dispatchEvent(newStartResizeBREvent(bay));
            }
          };
          handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            if (!this.idle) {
              return;
            }
            this.contextMenu?.open(this.contextMenuContext(bay, e));
          };
        }
        if (busBar && this.resizingBR === bay && !this.disabled) {
          if (
            section !==
            sections.find(s => xmlBoolean(s.getAttributeNS(sldNs, 'bus')))
          ) {
            return;
          }
          circles.length = 0;
          const {
            pos: [vX, vY],
            dim: [vW, vH],
          } = attributes(bay.parentElement!);
          const maxX = vX + vW - 0.5;
          const maxY = vY + vH - 0.5;
          if (i === 0) {
            const dx = Math.max(this.mouseX - x1, 0);
            const dy = Math.max(this.mouseY - y1, 0);
            if (dx > dy) {
              x2 = Math.max(x1, Math.min(maxX, this.mouseX + 0.5));
              y2 = y1;
            } else {
              y2 = Math.max(y1, Math.min(maxY, this.mouseY + 0.5));
              x2 = x1;
            }
            if (x1 === x2 && y1 === y2) {
              if (x2 >= maxX) {
                y2 += 1;
              } else {
                x2 += 1;
              }
            }
          }
          handleClick = () => {
            this.dispatchEvent(
              newPlaceEvent({
                parent: section,
                element: vertices[vertices.length - 1],
                x: x2,
                y: y2,
              }),
            );
          };
          lines.push(svg`<rect x="${this.mouseX}" y="${this.mouseY}"
              width="1" height="1" fill="none" pointer-events="${pointerEvents}"
              @click=${handleClick} />`);
        }
        if (this.connecting && !this.disabled) {
          handleClick = () => {
            const { from, path, fromTerminal } = this.connecting!;
            if (
              from
                .closest('ConductingEquipment, PowerTransformer')!
                .querySelector(
                  `[connectivityNode="${cNode.getAttribute('pathName')}"]`,
                )
            ) {
              return;
            }
            const [[oldX1, oldY1], [oldX2, oldY2]] = path.slice(-2);
            const vertical = oldX1 === oldX2;

            let x3 = this.mouseX2;
            let y3 = this.mouseY2;

            let newX2 = vertical ? oldX2 : x3;
            let newY2 = vertical ? y3 : oldY2;

            const start =
              newX2 === x3 && newY2 === y3
                ? ([oldX1, oldY1] as Point)
                : ([newX2, newY2] as Point);

            [x3, y3] = findIntersection(start, [x3, y3], [x1, y1], [x2, y2]);

            newX2 = vertical ? oldX2 : x3;
            newY2 = vertical ? y3 : oldY2;

            path[path.length - 1] = [newX2, newY2];
            path.push([x3, y3]);
            cleanPath(path);
            this.dispatchEvent(
              newConnectEvent({
                from,
                fromTerminal,
                path,
                to: cNode,
              }),
            );
          };
        }

        lines.push(
          svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                pointer-events="${pointerEvents}"
                stroke-width="${busBar ? 0.12 : nothing}" stroke="black"
                stroke-linecap="${busBar ? 'round' : 'square'}" />`,
        );
        lines.push(
          svg`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"
                pointer-events="${pointerEvents}" stroke-width="${targetSize}"
                @contextmenu=${handleContextMenu} @mousedown=${preventDefault}
                @click=${handleClick} @auxclick=${handleAuxClick} />`,
        );
        if (
          busBar ||
          (this.connecting && !vertices[i].hasAttributeNS(sldNs, 'uuid'))
        ) {
          lines.push(
            svg`<rect x="${x1 - targetSize / 2}" y="${y1 - targetSize / 2}"
                  width="${targetSize}" height="${targetSize}"
                  @click=${handleClick} @auxclick=${handleAuxClick}
                  @contextmenu=${handleContextMenu} @mousedown=${preventDefault}
                  pointer-events="${pointerEvents}" fill="none" />`,
          );
        }
        if (
          busBar ||
          (this.connecting && !vertices[i + 1].hasAttributeNS(sldNs, 'uuid'))
        ) {
          lines.push(
            svg`<rect x="${x2 - targetSize / 2}" y="${y2 - targetSize / 2}"
                  width="${targetSize}" height="${targetSize}"
                  @click=${handleClick} @auxclick=${handleAuxClick}
                  @contextmenu=${handleContextMenu} @mousedown=${preventDefault}
                  pointer-events="${pointerEvents}" fill="none" />`,
          );
        }
        i += 1;
      }
    });
    const id =
      cNode.closest('Substation') === this.substation
        ? identity(cNode)
        : nothing;
    return svg`<g class="${classMap({
      node: true,
      disabled: this.disabled,
    })}" id="${id}" >
        <title>${cNode.getAttribute('pathName')}</title>
        ${circles}
        ${lines}
      </g>`;
  }

  static styles = css`
    h2 {
      font-family: Roboto;
      font-weight: 300;
      font-size: 24px;
      margin-bottom: 4px;
      color: rgba(0, 0, 0, 0.83);
      --md-icon-button-state-layer-height: 28px;
      --md-icon-button-state-layer-width: 28px;
      --md-icon-button-icon-size: 24px;
    }

    .hidden {
      display: none;
    }
    svg:not(:hover) ~ .coordinates {
      display: none;
    }
    .coordinates {
      position: fixed;
      pointer-events: none;
      font-size: 16px;
      font-family: 'Roboto', sans-serif;
      padding: 8px;
      border-radius: 16px;
      background: #fffd;
      color: rgb(0, 0, 0 / 0.83);
    }
    .coordinates.invalid {
      color: #bb1326;
    }

    .disabled:not(.selectable) {
      pointer-events: none;
      opacity: 0.2;
    }

    .disabled.selectable > text {
      pointer-events: all;
    }

    * {
      user-select: none;
    }
  `;
}
