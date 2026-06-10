import { LitElement } from 'lit';
import { SldEditor } from './sld-editor.js';
import { SldToolbar } from './toolbar/sld-toolbar.js';
declare const OscdEditorSld_base: typeof LitElement & import("@open-wc/scoped-elements/lit-element.js").ScopedElementsHostConstructor;
export default class OscdEditorSld extends OscdEditorSld_base {
    static scopedElements: {
        'sld-editor': typeof SldEditor;
        'sld-toolbar': typeof SldToolbar;
    };
    doc: XMLDocument;
    docVersion: number;
    gridSize: number;
    nsp: string;
    templateElements: Record<string, Element>;
    inAction: boolean;
    private _showLabels;
    get showLabels(): boolean;
    private _showIeds;
    get showIeds(): boolean;
    sldEditor?: SldEditor;
    zoomIn(): void;
    zoomOut(): void;
    startPlacing(element: Element | undefined): void;
    startBayTypicalPlacing({ bayTypical, ieds }: {
        bayTypical: Element;
        ieds: Element[];
    }): Promise<void>;
    reset(): void;
    handleKeydown: ({ key }: KeyboardEvent) => void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    willUpdate(changedProperties: Map<string, unknown>): void;
    convertSldAttributes(): void;
    render(): import("lit-html").TemplateResult<1>;
    static styles: import("lit").CSSResult;
}
export {};
