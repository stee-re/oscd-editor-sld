import { LitElement } from 'lit';
import { OscdSclDialogs } from '@omicronenergy/oscd-scl-dialogs/oscd-scl-dialogs.js';
import { SldSubstationEditor } from './sld-substation-editor.js';
import type { ConnectDetail, StartConnectDetail } from './foundations/events.js';
import type { Point } from './foundations/geometry.js';
import type { Style } from './foundations/sld-attributes.js';
export type PlacementResult = {
    element: Element;
    parent: Element;
    x: number;
    y: number;
};
declare const SldEditor_base: typeof LitElement & import("@open-wc/scoped-elements/lit-element.js").ScopedElementsHostConstructor;
export declare class SldEditor extends SldEditor_base {
    static scopedElements: {
        'sld-substation-editor': typeof SldSubstationEditor;
        'oscd-scl-dialogs': typeof OscdSclDialogs;
    };
    sclDialogs: OscdSclDialogs;
    doc: XMLDocument;
    get docVersion(): number;
    set docVersion(value: number);
    private _docVersion;
    disabled: boolean;
    selectable: string[];
    highlight: {
        id: string;
        style: Style;
    }[];
    showIeds?: boolean;
    gridSize: number;
    nsp: string;
    resizingBR?: Element;
    resizingTL?: Element;
    placing?: Element;
    placingOffset: Point;
    placingLabel?: Element;
    showLabels: boolean;
    connecting?: {
        from: Element;
        path: Point[];
        fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
    };
    connectedCallback(): void;
    disconnectedCallback(): void;
    private handleKeydown;
    private handleEditSclRequest;
    private handleEditIedRequest;
    willUpdate(changedProperties: Map<string, unknown>): void;
    reset(): void;
    resetWithOffset(): void;
    startResizingBottomRight(element: Element | undefined): void;
    startResizingTopLeft(element: Element | undefined): void;
    private _resolvePlacement?;
    startPlacing(element: Element | undefined, offset?: Point): Promise<PlacementResult | undefined>;
    startPlacingLabel(element: Element | undefined, offset?: Point): void;
    startConnecting(detail: StartConnectDetail): void;
    rotateElement(element: Element): void;
    isNewBayOrVL(element: Element): boolean;
    placeElement(element: Element, parent: Element, x: number, y: number): void;
    connectEquipment(detail: ConnectDetail): void;
    render(): import("lit-html").TemplateResult<1>;
}
export {};
