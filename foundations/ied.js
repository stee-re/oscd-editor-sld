import { identity } from '@openscd/scl-lib';
import { privType, sldNs } from '../foundations.js';
export function isIedReferenceElement(element) {
    return (element.localName === 'Reference' &&
        element.namespaceURI === sldNs &&
        element.getAttributeNS(sldNs, 'type') === 'IED');
}
export function iedReferences(root) {
    const refs = Array.from(root.getElementsByTagNameNS(sldNs, 'Reference')).filter(isIedReferenceElement);
    return refs;
}
/** Returns SLD IED references whose target IED no longer exists. */
export function unresolvedIedReferences(root) {
    return iedReferences(root).filter(reference => !resolveIed(reference));
}
function iedIdentity(referencedIed) {
    if (isIedReferenceElement(referencedIed)) {
        return referencedIed.getAttributeNS(sldNs, 'id');
    }
    return null;
}
export function resolveIed(referencedIed) {
    const doc = referencedIed.ownerDocument;
    if (isIedReferenceElement(referencedIed)) {
        const referenceIdentity = iedIdentity(referencedIed);
        if (!referenceIdentity) {
            return null;
        }
        return (Array.from(doc.querySelectorAll(':root > IED')).find(ied => identity(ied) === referenceIdentity) ?? null);
    }
    return null;
}
/** Creates the edit that removes an SLD IED reference and its empty layout container. */
export function createRemoveIedReferenceEdit(referencedIed) {
    const sldLayoutPrivate = referencedIed.parentElement;
    const sldChildren = sldLayoutPrivate
        ? Array.from(sldLayoutPrivate.children).filter(child => child.namespaceURI === sldNs)
        : [];
    if (sldLayoutPrivate?.tagName === 'Private' &&
        sldLayoutPrivate.getAttribute('type') === privType &&
        sldChildren.length === 1) {
        return { node: sldLayoutPrivate };
    }
    return { node: referencedIed };
}
//# sourceMappingURL=ied.js.map