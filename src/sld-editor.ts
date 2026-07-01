import { html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import type { EditV2, SetAttributes } from '@openscd/oscd-api';

import { OscdSclDialogs } from '@omicronenergy/oscd-scl-dialogs/oscd-scl-dialogs.js';
import { OscdSnackbar } from '@omicronenergy/oscd-ui/snackbar/OscdSnackbar.js';

import { SldSubstationViewer } from './sld-substation-viewer.js';
import { SldSubstationHeader } from './sld-substation-header.js';
import { SldResizeSubstationDialog } from './sld-resize-substation-dialog.js';
import { SldContextMenu } from './context-menu/sld-context-menu.js';
import { attributes, getSLDAttributes } from './foundations/sld-attributes.js';
import {
  busBarVertexEdits,
  createConnectEdits,
  createGroundTerminalEdits,
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
import { reparentElement, sldNs, sldPrefix } from './foundations.js';
import { downloadSvg } from './foundations/export.js';

import type {
  ConnectDetail,
  ConnectEvent,
  ExtendConnectPointEvent,
  EditIedDetail,
  EditSclDetail,
  GroundTerminalEvent,
  OpenContextMenuEvent,
  PlaceEvent,
  PlaceLabelEvent,
  ResizeEvent,
  ResizeTLEvent,
  StartConnectDetail,
  StartEvent,
  InteractionIntent,
  StartInteractionEvent,
} from './foundations/events.js';
import type { Point } from './foundations/geometry.js';
import * as interactions from './foundations/interaction-mode.js';
import type { InteractionState } from './foundations/interaction-mode.js';
import type { Style } from './foundations/sld-attributes.js';

export type PlacementResult = {
  element: Element;
  parent: Element;
  x: number;
  y: number;
};

export class SldEditor extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'sld-substation-viewer': SldSubstationViewer,
    'sld-substation-header': SldSubstationHeader,
    'sld-resize-substation-dialog': SldResizeSubstationDialog,
    'sld-context-menu': SldContextMenu,
    'oscd-scl-dialogs': OscdSclDialogs,
    'oscd-snackbar': OscdSnackbar,
  };

  @query('oscd-scl-dialogs')
  sclDialogs!: OscdSclDialogs;

  @query('sld-resize-substation-dialog')
  resizeDialog!: SldResizeSubstationDialog;

  @query('sld-context-menu')
  contextMenu!: SldContextMenu;

  @query('oscd-snackbar')
  snackbar!: OscdSnackbar;

  @property({ type: Object }) doc!: XMLDocument;

  @property({ type: Number })
  get docVersion(): number {
    return this._docVersion;
  }

  set docVersion(value: number) {
    const i = this.interaction;
    if (
      i.mode === 'connectingFrom' ||
      (i.mode === 'resizingBR' && !i.element.parentElement) ||
      (i.mode === 'placingLabel' && !i.element.parentElement)
    ) {
      this.interaction = interactions.idle();
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

  get nsp(): string {
    return sldPrefix(this.doc);
  }

  @state() interaction: InteractionState = interactions.idle();

  @state() showLabels: boolean = true;

  get placing(): Element | undefined {
    return this.interaction.mode === 'placing'
      ? this.interaction.element
      : undefined;
  }

  get placingLabel(): Element | undefined {
    return this.interaction.mode === 'placingLabel'
      ? this.interaction.element
      : undefined;
  }

  get resizingBR(): Element | undefined {
    return this.interaction.mode === 'resizingBR'
      ? this.interaction.element
      : undefined;
  }

  get resizingTL(): Element | undefined {
    return this.interaction.mode === 'resizingTL'
      ? this.interaction.element
      : undefined;
  }

  get connecting(): StartConnectDetail | undefined {
    return this.interaction.mode === 'connectingFrom'
      ? {
        from: this.interaction.element,
        path: this.interaction.path,
        fromTerminal: this.interaction.terminal,
      }
      : undefined;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
    this.addEventListener('oscd-sld-edit-scl', this.handleEditSclRequest);
    this.addEventListener('oscd-sld-edit-ied', this.handleEditIedRequest);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
    this.removeEventListener('oscd-sld-edit-scl', this.handleEditSclRequest);
    this.removeEventListener('oscd-sld-edit-ied', this.handleEditIedRequest);
  }

  private handleGroundTerminalRequest = (event: GroundTerminalEvent) => {
    const { equipment, terminal } = event.detail;
    const edits = createGroundTerminalEdits(equipment, terminal);
    if (!edits) {
      this.showGroundHint();
      return;
    }

    this.dispatchEvent(newEditEventV2(edits));
  };

  private handleOpenContextMenuRequest = (event: OpenContextMenuEvent) => {
    this.contextMenu.open(event.detail);
  };

  private showGroundHint() {
    this.snackbar.show({
      message: 'Only transformers within a bay may be grounded directly.',
      variant: 'warning',
    });
  }

  private handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') {
      this.reset();
    }
  };

  private async editScl(element: Element) {
    const edits = await this.sclDialogs.edit({ element });

    this.dispatchEvent(newEditEventV2(edits));
  }

  private handleEditSclRequest = (event: Event) => {
    const detail = (event as CustomEvent<EditSclDetail>).detail;
    return this.editScl(detail.element);
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

  reset() {
    this.interaction = interactions.idle();
    this._resolvePlacement?.(undefined);
    this._resolvePlacement = undefined;
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: false }),
    );
  }

  startResizingBottomRight(element: Element | undefined) {
    this.reset();
    if (element) {
      this.interaction = interactions.resizingBR(element);
    }
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  startResizingTopLeft(element: Element | undefined) {
    this.reset();
    if (element) {
      this.interaction = interactions.resizingTL(element);
    }
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
    if (element) {
      this.interaction = interactions.placing(element, offset);
    }
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );

    return new Promise((resolve) => {
      this._resolvePlacement = resolve;
    });
  }

  startPlacingLabel(element: Element | undefined, offset: Point = [0, 0]) {
    this.reset();
    if (element) {
      this.interaction = interactions.placingLabel(element, offset);
    }
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  startConnecting(detail: StartConnectDetail) {
    this.reset();
    this.interaction = interactions.connectingFrom(
      detail.from,
      detail.fromTerminal,
      detail.path,
    );
    this.dispatchEvent(
      new CustomEvent('sld-editor-in-action', { detail: true }),
    );
  }

  rotateElement(element: Element) {
    this.dispatchEvent(newEditEventV2(createRotateEdits(element, this.nsp)));
  }

  private handleStartInteraction = (detail: InteractionIntent) => {
    switch (detail.mode) {
      case 'placing':
        this.startPlacing(detail.element, detail.offset);
        break;
      case 'placingLabel':
        this.startPlacingLabel(detail.element, detail.offset);
        break;
      case 'resizingBR':
        this.startResizingBottomRight(detail.element);
        break;
      case 'resizingTL':
        this.startResizingTopLeft(detail.element);
        break;
      case 'connecting':
        this.startConnecting(detail);
        break;
    }
  };

  handleSubstationResize(element: Element, w: number, h: number) {
    this.dispatchEvent(newEditEventV2(createResizeEdits(element, this.nsp, w, h)));
    this.reset();
  }

  resizeTLElement(element: Element, x: number, y: number, w: number, h: number) {
    this.dispatchEvent(
      newEditEventV2(createResizeTLEdits(element, this.nsp, x, y, w, h)),
    );
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

  placeLabelElement(element: Element, x: number, y: number) {
    this.dispatchEvent(
      newEditEventV2(createPlaceLabelEdit(element, this.nsp, x, y)),
    );
    this.reset();
  }

  connectEquipment(detail: ConnectDetail) {
    const edits = createConnectEdits(detail, this.doc, this.nsp);
    if (edits.length) {
      this.dispatchEvent(newEditEventV2(edits));
    }
    this.reset();
  }

  /**
   * Grow the in-progress connection path. The view reports the next path
   * (computed from the click + live cursor) and the controller — the single
   * owner of the interaction state — reassigns `interaction` immutably so Lit
   * reactivity is automatic and the value is never mutated behind its back.
   */
  extendConnectPoint(path: Point[]) {
    if (this.interaction.mode !== 'connectingFrom') {
      return;
    }
    this.interaction = interactions.connectingFrom(
      this.interaction.element,
      this.interaction.terminal,
      path,
    );
  }

  render() {
    return html`${Array.from(
      this.doc.querySelectorAll(':root > Substation'),
    ).map(
      substation =>
        html`<sld-substation-viewer
            .doc=${this.doc}
            .docVersion=${this.docVersion}
            .substation=${substation}
            .gridSize=${this.gridSize}
            .interaction=${this.interaction}
            .showLabels=${this.showLabels}
            .showIeds=${this.showIeds}
            .disabled=${this.disabled}
            .selectable=${this.selectable}
            .highlight=${this.highlight}
            @sld-header-export=${(event: Event) =>
              downloadSvg(
                (event.currentTarget as SldSubstationViewer).exportableSvg(),
                `${substation.getAttribute('name')}.svg`,
              )}
            @oscd-sld-start-interaction=${({
              detail,
            }: StartInteractionEvent) => this.handleStartInteraction(detail)}
            @oscd-sld-ground-terminal=${(event: GroundTerminalEvent) => {
              this.handleGroundTerminalRequest(event);
            }}
            @sld-ground-hint=${() => {
              this.showGroundHint();
            }}
            @oscd-sld-open-context-menu=${(event: OpenContextMenuEvent) => {
              this.handleOpenContextMenuRequest(event);
            }}
            @oscd-sld-resize=${({ detail: { element, w, h } }: ResizeEvent) => {
              this.handleSubstationResize(element, w, h);
            }}
            @oscd-sld-resize-tl=${({
              detail: { element, x, y, w, h },
            }: ResizeTLEvent) => {
              this.resizeTLElement(element, x, y, w, h);
            }}
            @oscd-sld-place=${({
              detail: { element, parent, x, y },
            }: PlaceEvent) => this.placeElement(element, parent, x, y)}
            @oscd-sld-place-label=${({
              detail: { element, x, y },
            }: PlaceLabelEvent) => {
              this.placeLabelElement(element, x, y);
            }}
            @oscd-sld-connect=${({ detail }: ConnectEvent) =>
              this.connectEquipment(detail)}
            @oscd-sld-extend-connect-point=${({
              detail,
            }: ExtendConnectPointEvent) => this.extendConnectPoint(detail.path)}
            @oscd-sld-rotate=${({ detail }: StartEvent) =>
              this.rotateElement(detail)}
          >
            <sld-substation-header
              slot="header"
              .substation=${substation}
              ?disabled=${this.disabled}
              @sld-header-edit=${() => this.editScl(substation)}
              @sld-header-resize=${() => this.resizeDialog.show(substation)}
              @sld-header-delete=${() =>
                this.dispatchEvent(newEditEventV2({ node: substation }))}
            ></sld-substation-header>
          </sld-substation-viewer>`,
    )}
    <sld-resize-substation-dialog
      @oscd-sld-resize=${({ detail: { element, w, h } }: ResizeEvent) => {
        this.handleSubstationResize(element, w, h);
      }}
    ></sld-resize-substation-dialog>
    <sld-context-menu
      .doc=${this.doc}
      .nsp=${this.nsp}
      @oscd-sld-start-interaction=${({ detail }: StartInteractionEvent) =>
        this.handleStartInteraction(detail)}
      @oscd-sld-rotate=${({ detail }: StartEvent) =>
        this.rotateElement(detail)}
      @sld-ground-hint=${() => {
        this.showGroundHint();
      }}
    ></sld-context-menu>
    <oscd-snackbar></oscd-snackbar>
    <oscd-scl-dialogs></oscd-scl-dialogs>`;
  }
}
