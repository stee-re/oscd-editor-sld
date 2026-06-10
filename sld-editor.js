import { __decorate } from "tslib";
import { html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';
import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import { OscdSclDialogs } from '@omicronenergy/oscd-scl-dialogs/oscd-scl-dialogs.js';
import { SldSubstationEditor } from './sld-substation-editor.js';
import { attributes, getSLDAttributes } from './foundations/sld-attributes.js';
import { busBarVertexEdits, createConnectEdits, createPlaceLabelEdit, createResizeEdits, createResizeTLEdits, createRotateEdits, disconnectExternalEdits, rewireTerminalEdits, shiftDescendantEdits, shiftElementEdits, shiftTextEdits, wrapIedReferenceEdits, } from './foundations/edits.js';
import { iedReferences, isIedReferenceElement, resolveIed, } from './foundations/ied.js';
import { reparentElement, sldNs, xmlnsNs } from './foundations.js';
export class SldEditor extends ScopedElementsMixin(LitElement) {
    constructor() {
        super(...arguments);
        this._docVersion = 0;
        this.disabled = false;
        this.selectable = [];
        this.highlight = [];
        this.gridSize = 32;
        this.nsp = 'eoscd';
        this.placingOffset = [0, 0];
        this.showLabels = true;
        this.handleKeydown = ({ key }) => {
            if (key === 'Escape') {
                this.reset();
            }
        };
        this.handleEditSclRequest = async (event) => {
            const detail = event.detail;
            const edits = await this.sclDialogs.edit(detail);
            this.dispatchEvent(newEditEventV2(edits));
        };
        this.handleEditIedRequest = async (event) => {
            const { element: sclIed } = event.detail;
            const edits = await this.sclDialogs.edit({ element: sclIed });
            const iedReference = iedReferences(this.doc).find(iedRef => resolveIed(iedRef) === sclIed);
            if (!iedReference) {
                this.dispatchEvent(newEditEventV2([edits], {
                    title: 'Update IED',
                    squash: false,
                }));
                return;
            }
            const iedNameEdit = [...edits.flat()].find(edit => 'element' in edit &&
                edit.element.tagName === 'IED' &&
                'attributes' in edit &&
                !!edit.attributes &&
                'name' in edit.attributes);
            if (!iedNameEdit) {
                return;
            }
            const newIedName = iedNameEdit.attributes.name;
            const iedReferenceEdit = {
                element: iedReference,
                attributesNS: {
                    [sldNs]: {
                        [`${this.nsp}:id`]: newIedName,
                    },
                },
            };
            this.dispatchEvent(newEditEventV2([edits, iedReferenceEdit], {
                title: 'Update IED from dialog',
                squash: false,
            }));
        };
    }
    get docVersion() {
        return this._docVersion;
    }
    set docVersion(value) {
        this.connecting = undefined;
        if (!this.resizingBR?.parentElement) {
            this.resizingBR = undefined;
        }
        if (!this.placingLabel?.parentElement) {
            this.placingLabel = undefined;
        }
        this._docVersion = value;
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
    willUpdate(changedProperties) {
        if (!changedProperties.has('doc')) {
            return;
        }
        const sldNsPrefix = this.doc.documentElement.lookupPrefix(sldNs);
        if (sldNsPrefix) {
            this.nsp = sldNsPrefix;
        }
        else {
            this.doc.documentElement.setAttributeNS(xmlnsNs, `xmlns:${this.nsp}`, sldNs);
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
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: false }));
    }
    resetWithOffset() {
        this.placingOffset = [0, 0];
        this.reset();
    }
    startResizingBottomRight(element) {
        this.reset();
        this.resizingBR = element;
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: true }));
    }
    startResizingTopLeft(element) {
        this.reset();
        this.resizingTL = element;
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: true }));
    }
    startPlacing(element, offset = [0, 0]) {
        if (this.disabled) {
            return Promise.resolve(undefined);
        }
        this.reset();
        this.placing = element;
        this.placingOffset = offset;
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: true }));
        return new Promise((resolve) => {
            this._resolvePlacement = resolve;
        });
    }
    startPlacingLabel(element, offset = [0, 0]) {
        this.reset();
        this.placingLabel = element;
        this.placingOffset = offset;
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: true }));
    }
    startConnecting(detail) {
        this.reset();
        this.connecting = detail;
        this.dispatchEvent(new CustomEvent('sld-editor-in-action', { detail: true }));
    }
    rotateElement(element) {
        this.dispatchEvent(newEditEventV2(createRotateEdits(element, this.nsp)));
    }
    isNewBayOrVL(element) {
        return ['Bay', 'VoltageLevel'].includes(element.tagName) &&
            (!getSLDAttributes(element, 'w') || !getSLDAttributes(element, 'h'));
    }
    placeElement(element, parent, x, y) {
        const { pos: [oldX, oldY], } = attributes(element);
        const dx = x - oldX;
        const dy = y - oldY;
        const edits = [];
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
        }
        else {
            this.reset();
        }
        resolve?.({ element, parent, x, y });
    }
    connectEquipment(detail) {
        const edits = createConnectEdits(detail, this.doc, this.nsp);
        if (edits.length) {
            this.dispatchEvent(newEditEventV2(edits));
        }
        this.reset();
    }
    render() {
        return html `${Array.from(this.doc.querySelectorAll(':root > Substation')).map(substation => html `<sld-substation-editor
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
            @oscd-sld-start-resize-br=${({ detail }) => {
            this.startResizingBottomRight(detail);
        }}
            @oscd-sld-start-resize-tl=${({ detail }) => {
            this.startResizingTopLeft(detail);
        }}
            @oscd-sld-start-place=${({ detail: { element, offset }, }) => {
            this.startPlacing(element, offset);
        }}
            @oscd-sld-start-place-label=${({ detail: { element, offset }, }) => {
            this.startPlacingLabel(element, offset);
        }}
            @oscd-sld-start-connect=${({ detail }) => {
            this.startConnecting(detail);
        }}
            @oscd-sld-resize=${({ detail: { element, w, h } }) => {
            this.dispatchEvent(newEditEventV2(createResizeEdits(element, this.nsp, w, h)));
            this.reset();
        }}
            @oscd-sld-resize-tl=${({ detail: { element, x, y, w, h }, }) => {
            this.dispatchEvent(newEditEventV2(createResizeTLEdits(element, this.nsp, x, y, w, h)));
            this.reset();
        }}
            @oscd-sld-place=${({ detail: { element, parent, x, y }, }) => this.placeElement(element, parent, x, y)}
            @oscd-sld-place-label=${({ detail: { element, x, y }, }) => {
            this.dispatchEvent(newEditEventV2(createPlaceLabelEdit(element, this.nsp, x, y)));
            this.reset();
        }}
            @oscd-sld-connect=${({ detail }) => this.connectEquipment(detail)}
            @oscd-sld-rotate=${({ detail }) => this.rotateElement(detail)}
          ></sld-substation-editor>`)} <oscd-scl-dialogs></oscd-scl-dialogs>`;
    }
}
SldEditor.scopedElements = {
    'sld-substation-editor': SldSubstationEditor,
    'oscd-scl-dialogs': OscdSclDialogs,
};
__decorate([
    query('oscd-scl-dialogs')
], SldEditor.prototype, "sclDialogs", void 0);
__decorate([
    property({ type: Object })
], SldEditor.prototype, "doc", void 0);
__decorate([
    property({ type: Number })
], SldEditor.prototype, "docVersion", null);
__decorate([
    state()
], SldEditor.prototype, "_docVersion", void 0);
__decorate([
    property({ type: Boolean })
], SldEditor.prototype, "disabled", void 0);
__decorate([
    property({ type: Array })
], SldEditor.prototype, "selectable", void 0);
__decorate([
    property({ type: Array })
], SldEditor.prototype, "highlight", void 0);
__decorate([
    property({ type: Boolean })
], SldEditor.prototype, "showIeds", void 0);
__decorate([
    state()
], SldEditor.prototype, "gridSize", void 0);
__decorate([
    state()
], SldEditor.prototype, "nsp", void 0);
__decorate([
    state()
], SldEditor.prototype, "resizingBR", void 0);
__decorate([
    state()
], SldEditor.prototype, "resizingTL", void 0);
__decorate([
    state()
], SldEditor.prototype, "placing", void 0);
__decorate([
    state()
], SldEditor.prototype, "placingOffset", void 0);
__decorate([
    state()
], SldEditor.prototype, "placingLabel", void 0);
__decorate([
    state()
], SldEditor.prototype, "showLabels", void 0);
__decorate([
    state()
], SldEditor.prototype, "connecting", void 0);
//# sourceMappingURL=sld-editor.js.map