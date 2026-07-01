import type { Point } from './geometry.js';

export type ResizeDetail = {
  w: number;
  h: number;
  element: Element;
};

export type ResizeEvent = CustomEvent<ResizeDetail>;

export function newResizeEvent(detail: ResizeDetail): ResizeEvent {
  return new CustomEvent('oscd-sld-resize', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type ResizeTLDetail = {
  x: number;
  y: number;
  w: number;
  h: number;
  element: Element;
};

export type ResizeTLEvent = CustomEvent<ResizeTLDetail>;

export function newResizeTLEvent(detail: ResizeTLDetail): ResizeTLEvent {
  return new CustomEvent('oscd-sld-resize-tl', {
    bubbles: true,
    composed: true,
    detail,
  });
}

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

export function newPlaceEvent(detail: PlaceDetail): PlaceEvent {
  return new CustomEvent('oscd-sld-place', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type PlaceLabelEvent = CustomEvent<PlaceLabelDetail>;

export function newPlaceLabelEvent(detail: PlaceLabelDetail): PlaceLabelEvent {
  return new CustomEvent('oscd-sld-place-label', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type ConnectDetail = {
  from: Element;
  path: Point[];
  fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
  to: Element;
  toTerminal?: 'T1' | 'T2' | 'N1' | 'N2';
};

export type ConnectEvent = CustomEvent<ConnectDetail>;

export function newConnectEvent(detail: ConnectDetail): ConnectEvent {
  return new CustomEvent('oscd-sld-connect', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type ExtendConnectPointDetail = { path: Point[] };

export type ExtendConnectPointEvent = CustomEvent<ExtendConnectPointDetail>;

export function newExtendConnectPointEvent(
  path: Point[],
): ExtendConnectPointEvent {
  return new CustomEvent('oscd-sld-extend-connect-point', {
    bubbles: true,
    composed: true,
    detail: { path },
  });
}

export type StartEvent = CustomEvent<Element>;

export function newRotateEvent(detail: Element): StartEvent {
  return new CustomEvent('oscd-sld-rotate', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function newStartResizeTLEvent(detail: Element): StartEvent {
  return new CustomEvent('oscd-sld-start-resize-tl', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export function newStartResizeBREvent(detail: Element): StartEvent {
  return new CustomEvent('oscd-sld-start-resize-br', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type StartPlaceDetail = {
  element: Element;
  offset: Point;
};

export type StartPlaceEvent = CustomEvent<StartPlaceDetail>;

export function newStartPlaceEvent(
  element: Element,
  offset: Point = [0, 0],
): StartPlaceEvent {
  return new CustomEvent('oscd-sld-start-place', {
    bubbles: true,
    composed: true,
    detail: { element, offset },
  });
}

export function newStartPlaceLabelEvent(
  element: Element,
  offset: Point = [0, 0],
): StartPlaceEvent {
  return new CustomEvent('oscd-sld-start-place-label', {
    bubbles: true,
    composed: true,
    detail: { element, offset },
  });
}

export type StartConnectDetail = {
  from: Element;
  fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
  path: Point[];
};

export type StartConnectEvent = CustomEvent<StartConnectDetail>;

export function newStartConnectEvent(
  detail: StartConnectDetail,
): StartConnectEvent {
  return new CustomEvent('oscd-sld-start-connect', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type SelectDetail = { element: Element };

export type SelectEvent = CustomEvent<SelectDetail>;

export function newSelectEvent(element: Element): SelectEvent {
  return new CustomEvent<SelectDetail>('oscd-sld-selected', {
    bubbles: true,
    composed: true,
    detail: { element },
  });
}

export type EditSclDetail = { element: Element };

export type EditSclEvent = CustomEvent<EditSclDetail>;

export function newSclEditDialogEvent(element: Element): EditSclEvent {
  return new CustomEvent<EditSclDetail>('oscd-sld-edit-scl', {
    bubbles: true,
    composed: true,
    detail: { element },
  });
}

export type GroundTerminalDetail = {
  equipment: Element;
  terminal: 'T1' | 'T2' | 'N1' | 'N2';
};

export type GroundTerminalEvent = CustomEvent<GroundTerminalDetail>;

export function newGroundTerminalEvent(
  equipment: Element,
  terminal: 'T1' | 'T2' | 'N1' | 'N2',
): GroundTerminalEvent {
  return new CustomEvent('oscd-sld-ground-terminal', {
    bubbles: true,
    composed: true,
    detail: { equipment, terminal },
  });
}

export type OpenContextMenuDetail = {
  element: Element;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
};

export type OpenContextMenuEvent = CustomEvent<OpenContextMenuDetail>;

export function newOpenContextMenuEvent(
  detail: OpenContextMenuDetail,
): OpenContextMenuEvent {
  return new CustomEvent('oscd-sld-open-context-menu', {
    bubbles: true,
    composed: true,
    detail,
  });
}

export type EditIedDetail = { element: Element };

export type EditIedEvent = CustomEvent<EditIedDetail>;

export function newEditIedEvent(element: Element): EditIedEvent {
  return new CustomEvent<EditIedDetail>('oscd-sld-edit-ied', {
    bubbles: true,
    composed: true,
    detail: { element },
  });
}

declare global {
  interface ElementEventMap {
    ['oscd-sld-resize']: ResizeEvent;
    ['oscd-sld-resize-tl']: ResizeTLEvent;
    ['oscd-sld-place']: PlaceEvent;
    ['oscd-sld-place-label']: PlaceLabelEvent;
    ['oscd-sld-connect']: ConnectEvent;
    ['oscd-sld-extend-connect-point']: ExtendConnectPointEvent;
    ['oscd-sld-rotate']: StartEvent;
    ['oscd-sld-start-resize-br']: StartEvent;
    ['oscd-sld-start-resize-tl']: StartEvent;
    ['oscd-sld-start-place']: StartPlaceEvent;
    ['oscd-sld-start-place-label']: StartPlaceEvent;
    ['oscd-sld-start-connect']: StartConnectEvent;
    ['oscd-sld-selected']: SelectEvent;
    ['oscd-sld-edit-scl']: EditSclEvent;
    ['oscd-sld-edit-ied']: EditIedEvent;
    ['oscd-sld-ground-terminal']: GroundTerminalEvent;
    ['oscd-sld-open-context-menu']: OpenContextMenuEvent;
  }
}
