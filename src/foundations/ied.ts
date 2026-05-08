import { identity } from '@openscd/scl-lib';

import { sldNs } from './namespaces.js';

export function isIedReferenceElement(element: Element): boolean {
  return (
    element.localName === 'Reference' &&
    element.namespaceURI === sldNs &&
    element.getAttributeNS(sldNs, 'type') === 'IED'
  );
}

export function iedReferences(root: XMLDocument | Element): Element[] {
  const refs = Array.from(
    root.getElementsByTagNameNS(sldNs, 'Reference'),
  ).filter(isIedReferenceElement);
  return refs;
}

function iedIdentity(referencedIed: Element): string | null {
  if (isIedReferenceElement(referencedIed)) {
    return referencedIed.getAttributeNS(sldNs, 'id');
  }
  return null;
}

export function resolveIed(referencedIed: Element): Element | null {
  const doc = referencedIed.ownerDocument;

  if (isIedReferenceElement(referencedIed)) {
    const referenceIdentity = iedIdentity(referencedIed);
    if (!referenceIdentity) {
      return null;
    }

    return (
      Array.from(doc.querySelectorAll(':root > IED')).find(
        ied => identity(ied) === referenceIdentity,
      ) ?? null
    );
  }

  return null;
}
