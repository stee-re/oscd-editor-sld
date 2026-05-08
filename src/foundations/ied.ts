import { identity } from '@openscd/scl-lib';

import { privType, sldNs } from './namespaces.js';

import type { EditV2 } from '@openscd/oscd-api';

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

/** Creates the edit that removes an SLD IED reference and its empty layout container. */
export function createRemoveIedReferenceEdit(referencedIed: Element): EditV2 {
  const sldLayoutPrivate = referencedIed.parentElement;

  if (
    sldLayoutPrivate?.tagName === 'Private' &&
    sldLayoutPrivate.getAttribute('type') === privType &&
    sldLayoutPrivate.childElementCount === 1
  ) {
    return { node: sldLayoutPrivate };
  }

  return { node: referencedIed };
}
