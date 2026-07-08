import { privType, sldNs } from '../foundations.js';

import type { EditV2 } from '@openscd/oscd-api';

/** Creates the edit that removes an SLD IED reference and its empty layout container. */
export function createRemoveIedReferenceEdit(referencedIed: Element): EditV2 {
  const sldLayoutPrivate = referencedIed.parentElement;

  const sldChildren = sldLayoutPrivate
    ? Array.from(sldLayoutPrivate.children).filter(
      child => child.namespaceURI === sldNs,
    )
    : [];

  if (
    sldLayoutPrivate?.tagName === 'Private' &&
    sldLayoutPrivate.getAttribute('type') === privType &&
    sldChildren.length === 1
  ) {
    return { node: sldLayoutPrivate };
  }

  return { node: referencedIed };
}
