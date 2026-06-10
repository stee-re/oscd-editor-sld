import { nothing, LitElement, PropertyValues, TemplateResult, SVGTemplateResult } from 'lit';
import { Ref } from 'lit/directives/ref.js';
import { OscdTextButton } from '@omicronenergy/oscd-ui/button/OscdTextButton.js';
import { OscdDialog } from '@omicronenergy/oscd-ui/dialog/OscdDialog.js';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdIconButton } from '@omicronenergy/oscd-ui/iconbutton/OscdIconButton.js';
import { SldSnackbar } from './sld-snackbar.js';
import { OscdOutlinedTextField } from '@omicronenergy/oscd-ui/textfield/OscdOutlinedTextField.js';
import { SldContextMenu } from './context-menu/sld-context-menu.js';
import type { Point } from './foundations/geometry.js';
import type { Style } from './foundations/sld-attributes.js';
declare const SldSubstationEditor_base: typeof LitElement & import("@open-wc/scoped-elements/lit-element.js").ScopedElementsHostConstructor;
/** An editor [[`plugin`]] for editing the `Substation` section. */
export declare class SldSubstationEditor extends SldSubstationEditor_base {
    static scopedElements: {
        'oscd-text-button': typeof OscdTextButton;
        'oscd-dialog': typeof OscdDialog;
        'oscd-icon': typeof OscdIcon;
        'oscd-icon-button': typeof OscdIconButton;
        'sld-snackbar': typeof SldSnackbar;
        'oscd-outlined-text-field': typeof OscdOutlinedTextField;
        'sld-context-menu': typeof SldContextMenu;
    };
    doc: XMLDocument;
    substation: Element;
    docVersion: number;
    gridSize: number;
    nsp: string;
    resizingBR?: Element;
    resizingTL?: Element;
    placing?: Element;
    placingOffset: Point;
    placingLabel?: Element;
    connecting?: {
        from: Element;
        path: Point[];
        fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
    };
    showLabels?: boolean;
    showIeds?: boolean;
    disabled: boolean;
    selectable: string[];
    highlight: {
        id: string;
        style: Style;
    }[];
    get idle(): boolean;
    resizeSubstationUI: OscdDialog;
    substationWidthUI: OscdOutlinedTextField;
    substationHeightUI: OscdOutlinedTextField;
    sld: SVGGraphicsElement;
    groundHint: SldSnackbar;
    contextMenu?: SldContextMenu;
    mouseX: number;
    mouseY: number;
    private iedResolutionCache;
    protected willUpdate(changedProperties: PropertyValues<this>): void;
    private resolvedIed;
    mouseX2: number;
    mouseY2: number;
    mouseX2f: number;
    mouseY2f: number;
    coordinatesRef: Ref<HTMLElement>;
    positionCoordinates(e: MouseEvent): void;
    private contextMenuContext;
    svgCoordinates(clientX: number, clientY: number): Point;
    renderedLabelPosition(element: Element, { preview }?: {
        preview?: boolean | undefined;
    }): Point;
    renderedPosition(element: Element): Point;
    connectedCallback(): void;
    disconnectedCallback(): void;
    handleExport(): void;
    nearestOpenTerminal(equipment?: Element): 'T1' | 'T2' | undefined;
    groundTerminal(equipment: Element, name: 'T1' | 'T2' | 'N1' | 'N2'): void;
    render(): TemplateResult<1>;
    renderLabel(element: Element, { preview }?: {
        preview?: boolean | undefined;
    }): TemplateResult<2> | typeof nothing;
    renderContainer(bayOrVL: Element, preview?: boolean): TemplateResult<2>;
    renderTransformerWinding(winding: Element): TemplateResult<2>;
    renderPowerTransformer(transformer: Element, preview?: boolean): TemplateResult<2>;
    private artifactContext;
    private renderArtifact;
    renderEquipment(equipment: Element, options?: {
        preview?: boolean;
        connect?: boolean;
    }): SVGTemplateResult;
    renderIed(referencedIed: Element, { preview }?: {
        preview?: boolean | undefined;
    }): SVGTemplateResult;
    renderBusBar(busBar: Element): TemplateResult<2>;
    renderConnectivityNode(cNode: Element): TemplateResult<2> | typeof nothing;
    static styles: import("lit").CSSResult;
}
export {};
