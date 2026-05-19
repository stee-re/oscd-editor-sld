export const privType = 'OpenSCD-SLD-Layout';
export const sldNs = 'https://openscd.org/SCL/SSD/SLD/v0';
export const xmlnsNs = 'http://www.w3.org/2000/xmlns/';
export const svgNs = 'http://www.w3.org/2000/svg';
export const xlinkNs = 'http://www.w3.org/1999/xlink';
export const sclNs = 'http://www.iec.ch/61850/2003/SCL';

export {
  eqTypes,
  isEqType,
  ringedEqTypes,
  singleTerminal,
} from './foundations/equipment.js';
export { isTransformerKind } from './foundations/sld-attributes.js';
export {
  attributes,
  getSLDAttributes,
  setSLDAttributes,
  updateSLDAttributes,
  xmlBoolean,
} from './foundations/sld-attributes.js';
export {
  busSections,
  connectionStartPoints,
  connectivityPath,
  isBusBar,
  makeBusBar,
  removeNode,
  removeTerminal,
  reparentElement,
  uniqueName,
} from './foundations/connectivity.js';
export {
  iedReferences,
  isIedReferenceElement,
  resolveIed,
} from './foundations/ied.js';
export type { EqType } from './foundations/equipment.js';
export type { TransformerKind, Attrs, Style } from './foundations/sld-attributes.js';
export type { Point } from './foundations/geometry.js';
export {
  newConnectEvent,
  newPlaceEvent,
  newPlaceLabelEvent,
  newResizeEvent,
  newResizeTLEvent,
  newRotateEvent,
  newSelectEvent,
  newStartConnectEvent,
  newStartPlaceEvent,
  newStartPlaceLabelEvent,
  newStartResizeBREvent,
  newStartResizeTLEvent,
} from './foundations/events.js';
export type {
  ConnectDetail,
  ConnectEvent,
  PlaceDetail,
  PlaceEvent,
  PlaceLabelDetail,
  PlaceLabelEvent,
  ResizeDetail,
  ResizeEvent,
  ResizeTLDetail,
  ResizeTLEvent,
  SelectDetail,
  SelectEvent,
  StartConnectDetail,
  StartConnectEvent,
  StartEvent,
  StartPlaceDetail,
  StartPlaceEvent,
} from './foundations/events.js';

export function uuid() {
  const digits = new Array(36);
  for (let i = 0; i < 36; i += 1) {
    if ([8, 13, 18, 23].includes(i)) {
      digits[i] = '-';
    } else {
      digits[i] = Math.floor(Math.random() * 16);
    }
  }
  digits[14] = 4;
  digits[19] &= ~(1 << 2);
  digits[19] |= 1 << 3;
  return digits.map(x => x.toString(16)).join('');
}
