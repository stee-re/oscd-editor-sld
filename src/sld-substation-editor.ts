import {
  css,
  html,
  nothing,
  LitElement,
  PropertyValues,
  svg,
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

import {
  resizePath,
  symbols,
} from './drawing/diagram-symbols.js';
import {
  conductingEquipmentArtifact,
} from './drawing/artifacts/conducting-equipment.js';
import { busBarArtifact } from './drawing/artifacts/bus-bar.js';
import {
  iedReferenceArtifact,
} from './drawing/artifacts/ied-reference.js';
import { powerTransformerArtifact } from './drawing/artifacts/power-transformer.js';
import { renderLabel as renderArtifactLabel } from './drawing/artifacts/label.js';
import {
  renderConnectivityNode as renderArtifactConnectivityNode,
  type ConnectivityNodeContext,
} from './drawing/artifacts/connectivity-node.js';
import {
  renderVoltageLevel,
  renderBay,
  type EquipmentContainerContext,
} from './drawing/artifacts/equipment-container.js';
import type {
  ArtifactRenderOptions,
  SldArtifactDescriptor,
  SldSharedContext,
} from './drawing/artifacts/artifact.js';
import type { PowerTransformerContext } from './drawing/artifacts/power-transformer.js';
import type { EquipmentContext } from './drawing/artifacts/conducting-equipment.js';
import type { BusBarContext } from './drawing/artifacts/bus-bar.js';
import type { LabelContext } from './drawing/artifacts/label.js';
import {
  cleanPath,
} from './foundations/geometry.js';
import { containsRect } from './foundations/element-geometry.js';
import {
  canPlaceAt,
  canResizeTo,
  canResizeToTL,
} from './foundations/sld-placement.js';
import {
  createGroundTerminalEdits,
} from './foundations/edits.js';
import { connectionStartPoints, isBusBar } from './foundations/connectivity.js';
import {
  attributes,
  getSLDAttributes,
  updateSLDAttributes,
} from './foundations/sld-attributes.js';
import { singleTerminal } from './foundations/equipment.js';
import {
  iedReferences,
  isIedReferenceElement,
  resolveIed,
} from './foundations/ied.js';
import {
  newConnectEvent,
  newPlaceEvent,
  newPlaceLabelEvent,
  newSclEditDialogEvent,
} from './foundations/events.js';
import { exportSVG } from './foundations/export.js';
import { svgNs, xlinkNs } from './foundations.js';
import {
  SldContextMenu,
  type MenuContext,
} from './context-menu/sld-context-menu.js';

import type { Point } from './foundations/geometry.js';
import type { Style } from './foundations/sld-attributes.js';

function isBay(element: Element) {
  return element.tagName === 'Bay' && !isBusBar(element);
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

    return html`<section>
      ${this.renderHeader()}
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
        ${this.renderVoltageLevelPlacingTarget()}
        ${this.renderVoltageLevelLayer()}
        ${this.renderConnectionPreviewLayer()}
        ${this.renderConnectModeEquipmentLayer()}
        ${this.renderConnectivityLayer()}
        ${this.renderPowerTransformerLayer()}
        ${this.renderIedLayer()}
        ${this.renderLabelLayer()}
        ${this.renderPlacingTargetsLayer()}
        ${this.renderPlacingPreview()}
      </svg>
      ${this.disabled
        ? nothing
        : html`<sld-context-menu
            .doc=${this.doc}
            .nsp=${this.nsp}
            @sld-ground-hint=${() => this.groundHint.show()}
          ></sld-context-menu>`}
      ${this.renderCoordinateTooltip()}
      ${this.renderResizeDialog()}
      <sld-snackbar
        labelText="Only transformers within a bay may be grounded directly."
      >
      </sld-snackbar>
    </section>`;
  }

  renderLabel(element: Element, { preview = false } = {}) {
    return renderArtifactLabel(element, this.labelContext(), { preview });
  }

  private renderHeader() {
    return html`<h2 class="${classMap({ disabled: this.disabled })}">
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
    </h2>`;
  }

  private renderResizeDialog() {
    const {
      dim: [w, h],
    } = attributes(this.substation);
    return html`<oscd-dialog id="resizeSubstationUI">
      <div slot="headline">Resize ${this.substation.getAttribute('name')}</div>
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
            const resizeEdit = updateSLDAttributes(this.substation, this.nsp, {
              w: newW,
              h: newH,
            });
            this.dispatchEvent(newEditEventV2(resizeEdit));
          }}
          >resize</oscd-text-button
        >
      </div>
    </oscd-dialog>`;
  }

  /**
   * The VoltageLevel drop-zone, painted near the BACK of the stack (behind
   * existing voltage levels) — a VL is dropped *behind* the diagram. Mutually
   * exclusive with `renderPlacingTargetsLayer` (only one placing mode at a time).
   */
  private renderVoltageLevelPlacingTarget() {
    if (this.placing?.tagName !== 'VoltageLevel') {
      return nothing;
    }
    return svg`<rect width="100%" height="100%" fill="url(#grid)" />`;
  }

  /**
   * The full-canvas drop-targets for elements that may land anywhere in the
   * substation (PowerTransformer / IED / Label), painted near the FRONT of the
   * stack so they catch clicks over existing elements. All three are mutually
   * exclusive (gated on the active placing mode), so at most one is live.
   */
  private renderPlacingTargetsLayer() {
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

    return [transformerPlacingTarget, iedPlacingTarget, placingLabelTarget];
  }

  private renderPlacingPreview() {
    if (!this.placing) {
      return svg``;
    }
    if (this.placing.tagName === 'VoltageLevel') {
      return renderVoltageLevel(this.placing, this.containerContext(), true);
    }
    if (isBay(this.placing)) {
      return renderBay(this.placing, this.containerContext(), true);
    }
    if (this.placing.tagName === 'ConductingEquipment') {
      return this.renderEquipment(this.placing, { preview: true });
    }
    if (isIedReferenceElement(this.placing)) {
      return this.renderIed(this.placing, { preview: true });
    }
    if (this.placing.tagName === 'PowerTransformer') {
      return this.renderPowerTransformer(this.placing, true);
    }
    if (isBusBar(this.placing)) {
      return this.renderBusBar(this.placing);
    }
    return svg``;
  }

  private renderVoltageLevelLayer() {
    return Array.from(this.substation.children)
      .filter(child => child.tagName === 'VoltageLevel')
      .map(vl => svg`${renderVoltageLevel(vl, this.containerContext())}`);
  }

  private renderConnectionPreviewLayer() {
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
    return connectionPreview;
  }

  /**
   * While a connection is being drawn in this substation, every
   * `ConductingEquipment` is suppressed in its container layer (see
   * conducting-equipment.ts) and re-painted here as a flat top overlay in
   * connect mode: terminal connect-indicators on, and click-through enabled so
   * clicks fall through to the connection drop-target beneath.
   */
  private renderConnectModeEquipmentLayer() {
    if (this.connecting?.from.closest('Substation') !== this.substation) {
      return nothing;
    }
    return Array.from(
      this.substation.querySelectorAll('ConductingEquipment'),
    ).map(eq => this.renderEquipment(eq, { connect: true }));
  }

  private renderConnectivityLayer() {
    return Array.from(this.substation.querySelectorAll('ConnectivityNode'))
      .filter(
        node =>
          node.getAttribute('name') !== 'grounded' &&
          !(
            this.placing &&
            node.closest(this.placing.localName) === this.placing
          ),
      )
      .sort(
        (a, b) =>
          Number(isBusBar(a.parentElement!)) -
          Number(isBusBar(b.parentElement!)),
      )
      .map(cNode => this.renderConnectivityNode(cNode));
  }

  private renderPowerTransformerLayer() {
    return Array.from(
      this.substation.querySelectorAll(':scope > PowerTransformer'),
    ).map(transformer => this.renderPowerTransformer(transformer));
  }

  private renderIedLayer() {
    return iedReferences(this.substation)
      .filter(
        referencedIed =>
          referencedIed.parentElement?.tagName === 'Private' &&
          !['Bay', 'VoltageLevel'].includes(
            referencedIed.parentElement!.parentElement!.tagName,
          ) &&
          (!this.placing ||
            referencedIed.closest(this.placing.localName) !== this.placing),
      )
      .map(ied => this.renderIed(ied));
  }

  private renderLabelLayer() {
    return Array.from(
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
          !this.placing || e.closest(this.placing.localName) !== this.placing,
      )
      .map(element => this.renderLabel(element));
  }

  /**
   * The placement/resize coordinate read-out, painted as a DOM overlay OUTSIDE
   * the `<svg>` (not a z-band). The placing / resizingBR / resizingTL modes are
   * mutually exclusive, so at most one branch sets `coordinates`/`invalid`;
   * `hidden` stays true (the tooltip is collapsed) while idle.
   */
  private renderCoordinateTooltip() {
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

    return html`<div
      ${ref(this.coordinatesRef)}
      class="${classMap({ coordinates: true, invalid, hidden })}"
    >
      (${coordinates})
    </div>`;
  }

  private containerContext(): EquipmentContainerContext {
    return {
      ...this.sharedContext(),
      highlight: this.highlight,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      nsp: this.nsp,
      resizingBR: this.resizingBR,
      resizingTL: this.resizingTL,
      svgCoordinates: (clientX, clientY) =>
        this.svgCoordinates(clientX, clientY),
      renderEquipment: equipment => this.renderEquipment(equipment),
      renderPowerTransformer: equipment =>
        this.renderPowerTransformer(equipment),
      renderIed: (referencedIed, options) =>
        this.renderIed(referencedIed, options),
      renderConnectivityNode: cNode => this.renderConnectivityNode(cNode),
    };
  }

  renderPowerTransformer(
    transformer: Element,
    preview = false,
  ): SVGTemplateResult {
    return this.renderArtifact(
      powerTransformerArtifact,
      transformer,
      this.powerTransformerContext(),
      { preview },
    );
  }

  private sharedContext(): SldSharedContext {
    return {
      disabled: this.disabled,
      dispatch: event => this.dispatchEvent(event),
      idle: this.idle,
      openContextMenu: (element, event) =>
        this.contextMenu?.open(this.contextMenuContext(element, event)),
      placing: this.placing,
      placingLabel: this.placingLabel,
      renderLabel: (element, options) => this.renderLabel(element, options),
      renderedPosition: element => this.renderedPosition(element),
      selectable: this.selectable,
      substation: this.substation,
      view: {
        showLabels: this.showLabels,
        showIeds: this.showIeds,
      },
    };
  }

  private equipmentContext(): EquipmentContext {
    return {
      ...this.sharedContext(),
      connecting: this.connecting,
      groundTerminal: (element, terminal) =>
        this.groundTerminal(element, terminal),
      highlight: this.highlight,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      nearestOpenTerminal: equipment => this.nearestOpenTerminal(equipment),
      nsp: this.nsp,
      resizingBR: this.resizingBR,
      resizingTL: this.resizingTL,
    };
  }

  private labelContext(): LabelContext {
    return {
      ...this.sharedContext(),
      mouseX2: this.mouseX2,
      mouseY2: this.mouseY2,
      renderedLabelPosition: (element, options) =>
        this.renderedLabelPosition(element, options),
    };
  }

  private busBarContext(): BusBarContext {
    return this.connectivityNodeContext();
  }

  private powerTransformerContext(): PowerTransformerContext {
    return {
      ...this.sharedContext(),
      connecting: this.connecting,
      groundTerminal: (element, terminal) =>
        this.groundTerminal(element, terminal),
      highlight: this.highlight,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      nsp: this.nsp,
      resizingBR: this.resizingBR,
      resizingTL: this.resizingTL,
    };
  }

  private renderArtifact<TState, TActions, TContext extends SldSharedContext>(
    descriptor: SldArtifactDescriptor<TState, TActions, TContext>,
    element: Element,
    context: TContext,
    options: ArtifactRenderOptions = {},
  ): SVGTemplateResult {
    const state = descriptor.state(element, context, options);
    if (!state) {
      return svg``;
    }

    return descriptor.render(
      element,
      state,
      descriptor.actions(element, context, state),
      context,
      options,
    );
  }

  renderEquipment(
    equipment: Element,
    options: { preview?: boolean; connect?: boolean } = {},
  ): SVGTemplateResult {
    return this.renderArtifact(
      conductingEquipmentArtifact,
      equipment,
      this.equipmentContext(),
      options,
    );
  }

  renderIed(
    referencedIed: Element,
    { preview = false } = {},
  ): SVGTemplateResult {
    return this.renderArtifact(
      iedReferenceArtifact,
      referencedIed,
      this.sharedContext(),
      { preview },
    );
  }

  renderBusBar(busBar: Element) {
    return this.renderArtifact(
      busBarArtifact,
      busBar,
      this.busBarContext(),
    );
  }

  private connectivityNodeContext(): ConnectivityNodeContext {
    return {
      ...this.sharedContext(),
      connecting: this.connecting,
      mouseX: this.mouseX,
      mouseY: this.mouseY,
      mouseX2: this.mouseX2,
      mouseY2: this.mouseY2,
      resizingBR: this.resizingBR,
    };
  }

  renderConnectivityNode(cNode: Element) {
    return renderArtifactConnectivityNode(
      cNode,
      this.connectivityNodeContext(),
    );
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
