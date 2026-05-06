import { nothing, LitElement, PropertyValues, TemplateResult, SVGTemplateResult } from 'lit';
import { Ref } from 'lit/directives/ref.js';
import { OscdTextButton } from '@omicronenergy/oscd-ui/button/OscdTextButton.js';
import { OscdDialog } from '@omicronenergy/oscd-ui/dialog/OscdDialog.js';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdIconButton } from '@omicronenergy/oscd-ui/iconbutton/OscdIconButton.js';
import { OscdList } from '@omicronenergy/oscd-ui/list/OscdList.js';
import { OscdListItem } from '@omicronenergy/oscd-ui/list/OscdListItem.js';
import { OscdMenu } from '@omicronenergy/oscd-ui/menu/OscdMenu.js';
import { OscdMenuItem } from '@omicronenergy/oscd-ui/menu/OscdMenuItem.js';
import { SldSnackbar } from './sld-snackbar.js';
import { OscdOutlinedTextField } from '@omicronenergy/oscd-ui/textfield/OscdOutlinedTextField.js';
import { OscdSclDialogs } from '@omicronenergy/oscd-scl-dialogs/oscd-scl-dialogs.js';
import { Point, Style } from './util.js';
type MenuItem = {
    handler?: () => void;
    content: TemplateResult;
};
declare const SldSubstationEditor_base: typeof LitElement & import("@open-wc/scoped-elements/lit-element.js").ScopedElementsHostConstructor;
/** An editor [[`plugin`]] for editing the `Substation` section. */
export declare class SldSubstationEditor extends SldSubstationEditor_base {
    static scopedElements: {
        'oscd-text-button': typeof OscdTextButton;
        'oscd-dialog': typeof OscdDialog;
        'oscd-icon': typeof OscdIcon;
        'oscd-icon-button': typeof OscdIconButton;
        'oscd-list': typeof OscdList;
        'oscd-list-item': typeof OscdListItem;
        'oscd-menu': typeof OscdMenu;
        'oscd-menu-item': typeof OscdMenuItem;
        'sld-snackbar': typeof SldSnackbar;
        'oscd-outlined-text-field': typeof OscdOutlinedTextField;
        'oscd-scl-dialogs': typeof OscdSclDialogs;
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
    sclDialogs: OscdSclDialogs;
    mouseX: number;
    mouseY: number;
    private iedResolutionCache;
    protected willUpdate(changedProperties: PropertyValues<this>): void;
    private resolvedIed;
    mouseX2: number;
    mouseY2: number;
    mouseX2f: number;
    mouseY2f: number;
    menu?: {
        element: Element;
        top: number;
        left: number;
    };
    coordinatesRef: Ref<HTMLElement>;
    positionCoordinates(e: MouseEvent): void;
    openMenu(element: Element, e: MouseEvent): void;
    svgCoordinates(clientX: number, clientY: number): Point;
    canPlaceAt(element: Element, x: number, y: number, w: number, h: number): boolean;
    canResizeTo(element: Element, w: number, h: number): boolean;
    canResizeToTL(element: Element, x: number, y: number, w: number, h: number): boolean;
    renderedLabelPosition(element: Element, { preview }?: {
        preview?: boolean | undefined;
    }): Point;
    renderedPosition(element: Element): Point;
    handleKeydown: ({ key }: KeyboardEvent) => void;
    handleClick: (e: MouseEvent) => void;
    connectedCallback(): void;
    disconnectedCallback(): void;
    private handleEditWizardRequest;
    saveSVG(): void;
    nearestOpenTerminal(equipment?: Element): 'T1' | 'T2' | undefined;
    groundTerminal(equipment: Element, name: 'T1' | 'T2' | 'N1' | 'N2'): void;
    flipElement(element: Element): void;
    addTextTo(element: Element): void;
    transformerWindingMenuItems(winding: Element): MenuItem[];
    transformerMenuItems(transformer: Element): MenuItem[];
    equipmentMenuItems(equipment: Element): MenuItem[];
    iedMenuItems(referencedIed: Element): MenuItem[];
    private openIedEditDialog;
    busBarMenuItems(busBar: Element): MenuItem[];
    containerMenuItems(bayOrVL: Element): MenuItem[];
    textMenuItems(text: Element): MenuItem[];
    renderMenu(): TemplateResult<1>;
    render(): TemplateResult<1>;
    renderLabel(element: Element, { preview }?: {
        preview?: boolean | undefined;
    }): TemplateResult<2> | typeof nothing;
    renderContainer(bayOrVL: Element, preview?: boolean): TemplateResult<2>;
    windingMeasures(winding: Element): {
        center: Point;
        size: number;
        terminals: Partial<Record<'T1' | 'T2' | 'N1' | 'N2', Point>>;
        grounded: Partial<Record<'N1' | 'N2', [Point, Point]>>;
        arc?: {
            from: Point;
            fromCtl: Point;
            to: Point;
            toCtl: Point;
        };
        zigZagTransform?: string;
    };
    renderTransformerWinding(winding: Element): TemplateResult<2>;
    renderPowerTransformer(transformer: Element, preview?: boolean): TemplateResult<2>;
    renderEquipment(equipment: Element, { preview, connect }?: {
        preview?: boolean | undefined;
        connect?: boolean | undefined;
    }): TemplateResult<2>;
    renderIed(referencedIed: Element, { preview }?: {
        preview?: boolean | undefined;
    }): SVGTemplateResult;
    renderBusBar(busBar: Element): TemplateResult<2>;
    renderConnectivityNode(cNode: Element): TemplateResult<2> | typeof nothing;
    static styles: import("lit").CSSResult;
}
export {};
