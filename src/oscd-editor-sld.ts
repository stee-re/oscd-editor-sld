import { LitElement, html, css } from 'lit';

import { property, query, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import { insertIed } from '@openscd/scl-lib';

import { SldEditor } from './sld-editor.js';

import { makeBusBar } from './foundations/connectivity.js';
import { sldNs, xmlnsNs } from './foundations.js';
import { convertSldLayout, hasOldNamespace } from './converter.js';

import { SldToolbar } from './toolbar/sld-toolbar.js';

export default class OscdEditorSld extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'sld-editor': SldEditor,
    'sld-toolbar': SldToolbar,
  };

  @property({ type: Object })
  doc!: XMLDocument;

  @property({ type: Number })
  docVersion: number = -1;

  @state()
  gridSize = 32;

  @state()
  nsp = 'eosld';

  @state()
  templateElements: Record<string, Element> = {};

  @state()
  inAction: boolean = false;

  @state()
  private _showLabels = true;

  get showLabels(): boolean {
    return this._showLabels;
  }

  @state()
  private _showIeds = true;

  get showIeds(): boolean {
    return this._showIeds;
  }

  @query('sld-editor') sldEditor?: SldEditor;

  zoomIn() {
    this.gridSize += 3;
  }

  zoomOut() {
    this.gridSize -= 3;
    if (this.gridSize < 2) {
      this.gridSize = 2;
    }
  }

  startPlacing(element: Element | undefined) {
    this.reset();
    this.sldEditor?.startPlacing(element);
  }

  async startBayTypicalPlacing ({bayTypical,ieds}: { bayTypical: Element; ieds: Element[] })  {
    const result = await this.sldEditor?.startPlacing(bayTypical);
    if (result) {
      const scl = this.doc.querySelector('SCL')!;
      ieds.forEach((ied) => {
        this.dispatchEvent(newEditEventV2(insertIed(scl, ied)));
      });
    }
  }
  reset() {
    this.inAction = false;
    this.sldEditor?.reset();
  }

  handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') {
      this.reset();
    }
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
  }

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

    [
      'Substation',
      'VoltageLevel',
      'Bay',
      'ConductingEquipment',
      'PowerTransformer',
      'TransformerWinding',
    ].forEach((tag) => {
      this.templateElements[tag] = this.doc.createElementNS(
        this.doc.documentElement.namespaceURI,
        tag,
      );
    });
    this.templateElements.BusBar = makeBusBar(this.doc, this.nsp);
  }

  convertSldAttributes() {
    const convertEdits = convertSldLayout(this.doc, this.nsp);
    this.dispatchEvent(newEditEventV2(convertEdits));
  }

  render() {
    if (!this.doc) {
      return html`<p>Please open an SCL document</p>`;
    }
    if (hasOldNamespace(this.doc)) {
      return html`<oscd-text-button
        @click="${() => this.convertSldAttributes()}"
        >Convert SLD Layout</oscd-text-button
      >`;
    }

    return html`<main>
      <sld-toolbar
        .doc=${this.doc}
        .docVersion=${this.docVersion}
        .nsp=${this.nsp}
        .templateElements=${this.templateElements}
        .inAction=${this.inAction}
        .gridSize=${this.gridSize}
        @start-placing=${({ detail }: CustomEvent) => {
          this.startPlacing(detail.element);
        }}
        @start-placing-typical=${({ detail }: CustomEvent) => {
          this.startBayTypicalPlacing(detail);
        }}
        @view-change=${({
          detail,
        }: CustomEvent<{ showLabels: boolean; showIeds: boolean }>) => {
          this._showLabels = detail.showLabels;
          this._showIeds = detail.showIeds;
        }}
        @zoom=${({
          detail,
        }: CustomEvent<{ direction: 'in' | 'out' }>) => {
          if (detail.direction === 'in') {
            this.zoomIn();
          } else {
            this.zoomOut();
          }
        }}
        @cancel=${() => this.reset()}
      ></sld-toolbar>
      <sld-editor
        .doc="${this.doc}"
        .docVersion=${this.docVersion}
        .gridSize=${this.gridSize}
        .showLabels=${this.showLabels}
        .showIeds=${this.showIeds}
        @sld-editor-in-action=${({ detail }: CustomEvent) => {
          this.inAction = detail;
        }}
      >
      </sld-editor>
    </main>`;
  }

  static styles = css`
    :host {
      display: block;
      container-type: inline-size;
    }

    main {
      padding: 16px;
      width: fit-content;
    }

    div {
      margin-top: 12px;
    }
  `;
}
