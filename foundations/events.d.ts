import type { Point } from './geometry.js';
export type ResizeDetail = {
    w: number;
    h: number;
    element: Element;
};
export type ResizeEvent = CustomEvent<ResizeDetail>;
export declare function newResizeEvent(detail: ResizeDetail): ResizeEvent;
export type ResizeTLDetail = {
    x: number;
    y: number;
    w: number;
    h: number;
    element: Element;
};
export type ResizeTLEvent = CustomEvent<ResizeTLDetail>;
export declare function newResizeTLEvent(detail: ResizeTLDetail): ResizeTLEvent;
export type PlaceLabelDetail = {
    x: number;
    y: number;
    element: Element;
};
export type PlaceDetail = {
    x: number;
    y: number;
    element: Element;
    parent: Element;
};
export type PlaceEvent = CustomEvent<PlaceDetail>;
export declare function newPlaceEvent(detail: PlaceDetail): PlaceEvent;
export type PlaceLabelEvent = CustomEvent<PlaceLabelDetail>;
export declare function newPlaceLabelEvent(detail: PlaceLabelDetail): PlaceLabelEvent;
export type ConnectDetail = {
    from: Element;
    path: Point[];
    fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
    to: Element;
    toTerminal?: 'T1' | 'T2' | 'N1' | 'N2';
};
export type ConnectEvent = CustomEvent<ConnectDetail>;
export declare function newConnectEvent(detail: ConnectDetail): ConnectEvent;
export type StartEvent = CustomEvent<Element>;
export declare function newRotateEvent(detail: Element): StartEvent;
export declare function newStartResizeTLEvent(detail: Element): StartEvent;
export declare function newStartResizeBREvent(detail: Element): StartEvent;
export type StartPlaceDetail = {
    element: Element;
    offset: Point;
};
export type StartPlaceEvent = CustomEvent<StartPlaceDetail>;
export declare function newStartPlaceEvent(element: Element, offset?: Point): StartPlaceEvent;
export declare function newStartPlaceLabelEvent(element: Element, offset?: Point): StartPlaceEvent;
export type StartConnectDetail = {
    from: Element;
    fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
    path: Point[];
};
export type StartConnectEvent = CustomEvent<StartConnectDetail>;
export declare function newStartConnectEvent(detail: StartConnectDetail): StartConnectEvent;
export type SelectDetail = {
    element: Element;
};
export type SelectEvent = CustomEvent<SelectDetail>;
export declare function newSelectEvent(element: Element): SelectEvent;
export type EditSclDetail = {
    element: Element;
};
export type EditSclEvent = CustomEvent<EditSclDetail>;
export declare function newSclEditDialogEvent(element: Element): EditSclEvent;
export type EditIedDetail = {
    element: Element;
};
export type EditIedEvent = CustomEvent<EditIedDetail>;
export declare function newEditIedEvent(element: Element): EditIedEvent;
declare global {
    interface ElementEventMap {
        ['oscd-sld-resize']: ResizeEvent;
        ['oscd-sld-resize-tl']: ResizeTLEvent;
        ['oscd-sld-place']: PlaceEvent;
        ['oscd-sld-place-label']: PlaceLabelEvent;
        ['oscd-sld-connect']: ConnectEvent;
        ['oscd-sld-rotate']: StartEvent;
        ['oscd-sld-start-resize-br']: StartEvent;
        ['oscd-sld-start-resize-tl']: StartEvent;
        ['oscd-sld-start-place']: StartPlaceEvent;
        ['oscd-sld-start-place-label']: StartPlaceEvent;
        ['oscd-sld-start-connect']: StartConnectEvent;
        ['oscd-sld-selected']: SelectEvent;
        ['oscd-sld-edit-scl']: EditSclEvent;
        ['oscd-sld-edit-ied']: EditIedEvent;
    }
}
