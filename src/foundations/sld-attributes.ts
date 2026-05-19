import { getReference } from '@openscd/scl-lib';

import { isIedReferenceElement } from './ied.js';
import { privType, sldNs } from '../foundations.js';

import type { EditV2 } from '@openscd/oscd-api';
import type { Point } from './geometry.js';

export type Style = {
  fill?: string;
  fillOpacity?: number | string;
  stroke?: string;
  strokeWidth?: number | string;
  strokeOpacity?: number | string;
  rx?: string | number;
};

const transformerKinds = ['default', 'auto', 'earthing'] as const;

export type TransformerKind = (typeof transformerKinds)[number];

export function isTransformerKind(
  kind: string | null,
): kind is TransformerKind {
  return transformerKinds.includes(kind as TransformerKind);
}

export type Attrs = {
  pos: Point;
  dim: Point;
  label: Point;
  flip: boolean;
  rot: 0 | 1 | 2 | 3;
  bus: boolean;
  weight: number;
  color: string;
  kind: TransformerKind;
};

export function xmlBoolean(value?: string | null) {
  return ['true', '1'].includes(value?.trim() ?? 'false');
}

function sldAttributes(element: Element, nsPrefix?: string): Element | null {
  if (isIedReferenceElement(element)) {
    const referenceSldAttrs = Array.from(element.children).find(
      child =>
        child.localName === 'SLDAttributes' && child.namespaceURI === sldNs,
    );
    if (referenceSldAttrs) {
      return referenceSldAttrs;
    }
    if (!nsPrefix) {
      return null;
    }

    const sldAttrs = element.ownerDocument.createElementNS(
      sldNs,
      `${nsPrefix}:SLDAttributes`,
    );
    element.appendChild(sldAttrs);
    return sldAttrs;
  }

  const priv = Array.from(element.children).find(
    child =>
      child.localName === 'Private' &&
      child.getAttribute('type') === privType,
  );
  const sldAttrs = priv
    ? Array.from(priv.children).find(
      child =>
        child.localName === 'SLDAttributes' && child.namespaceURI === sldNs,
    ) ?? null
    : null;

  if (sldAttrs) {
    return sldAttrs;
  }
  if (!nsPrefix) {
    return null;
  }

  const doc = element.ownerDocument;
  const privEl =
    priv ?? doc.createElementNS(doc.documentElement.namespaceURI, 'Private');

  if (!priv) {
    privEl.setAttribute('type', privType);
    element.insertBefore(privEl, getReference(element, 'Private'));
  }

  const sldAttrsNew = doc.createElementNS(sldNs, `${nsPrefix}:SLDAttributes`);
  privEl.insertBefore(sldAttrsNew, null);

  return sldAttrsNew;
}

export function setSLDAttributes(
  element: Element,
  nsPrefix: string,
  values: Record<string, string>,
): void {
  const isSectionOrVertex = ['Section', 'Vertex'].includes(element.localName);

  if (isSectionOrVertex) {
    Object.entries(values).forEach(([key, value]) => {
      element.setAttributeNS(sldNs, `${nsPrefix}:${key}`, value);
    });
  } else {
    Object.entries(values).forEach(([key, value]) =>
      sldAttributes(element, nsPrefix)?.setAttributeNS(
        sldNs,
        `${nsPrefix}:${key}`,
        value,
      ),
    );
  }
}

export function updateSLDAttributes(
  element: Element,
  nsPrefix: string,
  values: Partial<Record<string, string | null>>,
): EditV2 {
  const isSectionOrVertex = ['Section', 'Vertex'].includes(element.localName);
  const toBeUpdated = isSectionOrVertex
    ? element
    : sldAttributes(element, nsPrefix)!;

  return {
    element: toBeUpdated,
    attributesNS: {
      [sldNs]: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          `${nsPrefix}:${key}`,
          value,
        ]),
      ),
    },
  };
}

export function getSLDAttributes(element: Element, key: string): string | null {
  const isSectionOrVertex = ['Section', 'Vertex'].includes(element.localName);
  if (isSectionOrVertex) {
    return element.getAttributeNS(sldNs, key);
  }

  return sldAttributes(element)?.getAttributeNS(sldNs, key) ?? null;
}

export function attributes(element: Element): Attrs {
  const [x, y, w, h, rotVal, labelX, labelY] = [
    'x',
    'y',
    'w',
    'h',
    'rot',
    'lx',
    'ly',
  ].map(name => parseFloat(getSLDAttributes(element, name) ?? '0'));
  const weight = parseInt(getSLDAttributes(element, 'weight') ?? '300', 10);
  const pos = [x, y].map(d => Math.max(0, d)) as Point;
  const dim = [w, h].map(d => Math.max(1, d)) as Point;
  const label = [labelX, labelY].map(d => Math.max(0, d)) as Point;

  const bus = xmlBoolean(getSLDAttributes(element, 'bus'));
  const flip = xmlBoolean(getSLDAttributes(element, 'flip'));
  const kindVal = getSLDAttributes(element, 'kind');
  const kind = isTransformerKind(kindVal) ? kindVal : 'default';
  const color = getSLDAttributes(element, 'color') || '#000';

  const rot = (((rotVal % 4) + 4) % 4) as 0 | 1 | 2 | 3;

  return { pos, dim, label, flip, rot, bus, weight, color, kind };
}
