import { html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import type { EditV2, SetAttributes } from '@openscd/oscd-api';

import { OscdSclDialogs } from '@omicronenergy/oscd-scl-dialogs/oscd-scl-dialogs.js';

import { SldSubstationEditor } from './sld-substation-editor.js';
import { SldResizeSubstationDialog } from './sld-resize-substation-dialog.js';
import { attributes, getSLDAttributes } from './foundations/sld-attributes.js';
import {
  busBarVertexEdits,
  createConnectEdits,
  createPlaceLabelEdit,
  createResizeEdits,
  createResizeTLEdits,
  createRotateEdits,
  disconnectExternalEdits,
  rewireTerminalEdits,
  shiftDescendantEdits,
  shiftElementEdits,
  shiftTextEdits,
  wrapIedReferenceEdits,
} from './foundations/edits.js';
import {
  iedReferences,
  isIedReferenceElement,
  resolveIed,
} from './foundations/ied.js';
import { reparentElement, sldNs, xmlnsNs } from './foundations.js';

import type {
  ConnectDetail,
  ConnectEvent,
  EditIedDetail,
  EditSclDetail,
  PlaceEvent,
  PlaceLabelEvent,
  ResizeEvent,
  ResizeSubstationEvent,
  ResizeTLEvent,
  StartConnectDetail,
  StartConnectEvent,
  StartEvent,
  StartPlaceEvent,
} from './foundations/events.js';
import type { Point } from './foundations/geometry.js';
import type { InteractionMode } from './foundations/interaction-mode.js';
import type { Style } from './foundations/sld-attributes.js';

export type PlacementResult = {
  element: Element;
  parent: Element;
  x: number;
  y: number;
};

export class SldEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'sld-substation-editor': SldSubstationEditor,
    'sld-resize-substation-dialog': SldResizeSubstationDialog,
    'oscd-scl-dialogs': OscdSclDialogs,
  };

  @query('oscd-scl-dialogs')
  sclDialogs!: OscdSclDialogs;

  @query('sld-resize-substation-dialog')
  resizeDialog!: SldResizeSubstationDialog;

  @property({ type: Object }) doc!: XMLDocument;

  @property({ type: Number })
  get docVersion(): number {
    return this._docVersion;
  }

  set docVersion(value: number) {
    this.connecting = undefined;
    if (!this.resizingBR?.parentElement) {
      this.resizingBR = undefined;
    }
    if (!this.placingLabel?.parentElement) {
      this.placingLabel = undefined;
    }
    this._docVersion = value;
  }

  @state()
  private _docVersion = 0;

  @property({ type: Boolean }) disabled = false;

  @property({ type: Array }) selectable: string[] = [];

  @property({ type: Array }) highlight: { id: string; style: Style }[] = [];

  @property({ type: Boolean })
  showIeds?: boolean;


  @state() gridSize = 32;

  @state() nsp = 'eoscd';

  @state() resizingBR?: Element;

  @state() resizingTL?: Element;

  @state() placing?: Element;

  @state() placingOffset: Point = [0, 0];

  @state() placingLabel?: Element;

  @state() showLabels: boolean = true;

  @state()
  connecting?: {
    from: Element;
    path: Point[];
    fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
  };

  get interactionMode(): InteractionMode {
    if (this.placing) {
      return 'placing';
    }
    if (this.resizingBR) {
      return 'resizingBR';
    }
    if (this.resizingTL) {
      return 'resizingTL';
    }
    if (this.placingLabel) {
      return 'placingLabel';
    }
    if (this.connecting) {
      return 'connecting';
    }
    return 'idle';
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
    this.addEventListener('oscd-sld-edit-scl', this.handleEditSclRequest);
    this.addEventListener('oscd-sld-edit-ied', this.handleEditIedRequest);
    this.addEventListener(
      'oscd-sld-resize-substation',
      this.handleResizeSubstationRequest,
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
    this.removeEventListener('oscd-sld-edit-scl', this.handleEditSclRequest);
    this.removeEventListener('oscd-sld-edit-ied', this.handleEditIedRequest);
    this.removeEventListener(
      'oscd-sld-resize-substation',
      this.handleResizeSubstationRequest,
    );
  }

  private handleResizeSubstationRequest = (event: ResizeSubstationEvent) => {
    this.resizeDialog.show(event.detail.substation);
  };

  private handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') {
      this.reset();
    }
  };

  private handleEditSclRequest = async (event: Event) => {
    const detail = (event as CustomEvent<EditSclDetail>).detail;
    const edits = await this.sclDialogs.edit(detail);

    this.dispatchEvent(newEditEventV2(edits));
  };

  private handleEditIedRequest = async (event: Event) => {
    const { element: sclIed } = (event as CustomEvent<EditIedDetail>).detail;
    const edits = await this.sclDialogs.edit({ element: sclIed });

    const iedReference = iedReferences(this.doc).find(
      iedRef => resolveIed(iedRef) === sclIed,
    );
    if (!iedReference) {
      this.dispatchEvent(
        newEditEventV2([edits], {
          title: 'Update IED',
          squash: false,
        }),
      );
      return;
    }

    const iedNameEdit = [...edits.flat()].find(
      edit =>
        'element' in edit &&
        edit.element.tagName === 'IED' &&
        'attributes' in edit &&
        !!edit.attributes &&
        'name' in edit.attributes,
    ) as SetAttributes;
    if (!iedNameEdit) {
      return;
    }

    const newIedName = iedNameEdit.attributes!.name!;

    const iedReferenceEdit: SetAttributes = {
      element: iedReference,
      attributesNS: {
        [sldNs]: {
          [`${this.nsp}:id`]: newIedName,
        },
      },
    };

    this.dispatchEvent(
      newEditEventV2([edits, iedReferenceEdit], {
        title: 'Update IED from dialog',
        squash: false,
      }),
    );
  };

  willUpdate(changedProperties: Map<string, unknown>) {
    if (!changedProperties.has('doc')) {
      return;
    }
    const sldNsPrefix = this.doc.documentElement.lookupPrefix(sldNs);
    if (sldNsPrefix) {
      this.nsp = sldNsPrefix;
    } else {
      this.doc.documentElement.setAttributeNS(
        xmlnsNs,
        `xmlns:${this.nsp}`,
        sldNs,
      );
    }
  }

  reset() {
    this.resizingBR = undefined;
    this.resizingTL = undefined;
    this.placing = undefined;
    this.placingLabel = undefined;
    this.connecting = undefined;
    this._resolvePlacement?.(undefined);
    this._resolvePlacement = undefined;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: false }),
    );
  }

  resetWithOffset() {
    this.placingOffset = [0, 0];
    this.reset();
  }

  startResizingBottomRight(element: Element | undefined) {
    this.reset();
    this.resizingBR = element;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  startResizingTopLeft(element: Element | undefined) {
    this.reset();
    this.resizingTL = element;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  private _resolvePlacement?: (result: PlacementResult | undefined) => void;

  startPlacing(
    element: Element | undefined,
    offset: Point = [0, 0],
  ): Promise<PlacementResult | undefined> {
    if (this.disabled) {
      return Promise.resolve(undefined);
    }

    this.reset();
    this.placing = element;
    this.placingOffset = offset;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );

    return new Promise((resolve) => {
      this._resolvePlacement = resolve;
    });
  }

  startPlacingLabel(element: Element | undefined, offset: Point = [0, 0]) {
    this.reset();
    this.placingLabel = element;
    this.placingOffset = offset;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  startConnecting(detail: StartConnectDetail) {
    this.reset();
    this.connecting = detail;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  rotateElement(element: Element) {
    this.dispatchEvent(newEditEventV2(createRotateEdits(element, this.nsp)));
  }

  handleSubstationResize(element: Element, w: number, h: number) {
    this.dispatchEvent(newEditEventV2(createResizeEdits(element, this.nsp, w, h)));
    this.reset();
  }

  isNewBayOrVL(element: Element) : boolean {
    return ['Bay', 'VoltageLevel'].includes(element.tagName) &&
      (!getSLDAttributes(element, 'w') || !getSLDAttributes(element, 'h'));

  }

  placeElement(element: Element, parent: Element, x: number, y: number) {
    const {
      pos: [oldX, oldY],
    } = attributes(element);
    const dx = x - oldX;
    const dy = y - oldY;

    const edits: EditV2[] = [];

    if (element.parentElement !== parent && !isIedReferenceElement(element)) {
      edits.push(...reparentElement(element, parent));
    }

    edits.push(...shiftElementEdits(element, x, y, this.nsp));
    edits.push(...shiftTextEdits(element, dx, dy, this.nsp));
    edits.push(...shiftDescendantEdits(element, dx, dy, this.nsp));
    edits.push(...rewireTerminalEdits(element, parent, this.doc));
    edits.push(...disconnectExternalEdits(element, this.doc));
    edits.push(...busBarVertexEdits(element, x, y, this.nsp));
    edits.push(...wrapIedReferenceEdits(element, parent, this.doc));

    this.dispatchEvent(newEditEventV2(edits));

    const resolve = this._resolvePlacement;
    this._resolvePlacement = undefined;

    if (this.isNewBayOrVL(element)) {
      this.startResizingBottomRight(element);
    } else {
      this.reset();
    }

    resolve?.({ element, parent, x, y });
  }

  connectEquipment(detail: ConnectDetail) {
    const edits = createConnectEdits(detail, this.doc, this.nsp);
    if (edits.length) {
      this.dispatchEvent(newEditEventV2(edits));
    }
    this.reset();
  }

  render() {
    return html`${Array.from(
      this.doc.querySelectorAll(':root > Substation'),
    ).map(
      substation =>
        html`<sld-substation-editor
            .doc=${this.doc}
            .docVersion=${this.docVersion}
            .substation=${substation}
            .gridSize=${this.gridSize}
            .resizingBR=${this.resizingBR}
            .resizingTL=${this.resizingTL}
            .placing=${this.placing}
            .placingOffset=${this.placingOffset}
            .placingLabel=${this.placingLabel}
            .connecting=${this.connecting}
            .showLabels=${this.showLabels}
            .showIeds=${this.showIeds}
            .disabled=${this.disabled}
            .selectable=${this.selectable}
            .highlight=${this.highlight}
            @oscd-sld-start-resize-br=${({ detail }: StartEvent) => {
              this.startResizingBottomRight(detail);
            }}
            @oscd-sld-start-resize-tl=${({ detail }: StartEvent) => {
              this.startResizingTopLeft(detail);
            }}
            @oscd-sld-start-place=${({
              detail: { element, offset },
            }: StartPlaceEvent) => {
              this.startPlacing(element, offset);
            }}
            @oscd-sld-start-place-label=${({
              detail: { element, offset },
            }: StartPlaceEvent) => {
              this.startPlacingLabel(element, offset);
            }}
            @oscd-sld-start-connect=${({ detail }: StartConnectEvent) => {
              this.startConnecting(detail);
            }}
            @oscd-sld-resize=${({ detail: { element, w, h } }: ResizeEvent) => {
              this.handleSubstationResize(element, w, h);
            }}
            @oscd-sld-resize-tl=${({
              detail: { element, x, y, w, h },
            }: ResizeTLEvent) => {
              this.dispatchEvent(newEditEventV2(createResizeTLEdits(element, this.nsp, x, y, w, h)));
              this.reset();
            }}
            @oscd-sld-place=${({
              detail: { element, parent, x, y },
            }: PlaceEvent) => this.placeElement(element, parent, x, y)}
            @oscd-sld-place-label=${({
              detail: { element, x, y },
            }: PlaceLabelEvent) => {
              this.dispatchEvent(newEditEventV2(createPlaceLabelEdit(element, this.nsp, x, y)));
              this.reset();
            }}
            @oscd-sld-connect=${({ detail }: ConnectEvent) =>
              this.connectEquipment(detail)}
            @oscd-sld-rotate=${({ detail }: StartEvent) =>
              this.rotateElement(detail)}
          ></sld-substation-editor>`,
    )}
    <sld-resize-substation-dialog
      @oscd-sld-resize=${({ detail: { element, w, h } }: ResizeEvent) => {
        this.handleSubstationResize(element, w, h);
      }}
    ></sld-resize-substation-dialog>
    <oscd-scl-dialogs></oscd-scl-dialogs>`;
  }
}
