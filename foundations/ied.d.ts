import type { EditV2 } from '@openscd/oscd-api';
export declare function isIedReferenceElement(element: Element): boolean;
export declare function iedReferences(root: XMLDocument | Element): Element[];
/** Returns SLD IED references whose target IED no longer exists. */
export declare function unresolvedIedReferences(root: XMLDocument | Element): Element[];
export declare function resolveIed(referencedIed: Element): Element | null;
/** Creates the edit that removes an SLD IED reference and its empty layout container. */
export declare function createRemoveIedReferenceEdit(referencedIed: Element): EditV2;
