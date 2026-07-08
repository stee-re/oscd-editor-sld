import { identity } from '@openscd/scl-lib';

import { sldNs } from '../foundations.js';

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

/** Returns SLD IED references whose target IED no longer exists. */
export function unresolvedIedReferences(
  root: XMLDocument | Element,
): Element[] {
  return iedReferences(root).filter(reference => !resolveIed(reference));
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

