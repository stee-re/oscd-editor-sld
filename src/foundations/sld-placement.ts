/**
 * SLD placement and resize validation rules.
 *
 * These encode the domain-specific logic for whether an SCL element can
 * legally occupy a given position or size on the SLD grid. They know about
 * the SLD topology (parent/child containment hierarchy, bus bar exemptions,
 * IED references occupying grid space, etc.).
 */

import { contains } from './geometry.js';
import { containsRect, overlapsRect } from './element-geometry.js';
import { isBusBar } from './connectivity.js';
import {
  attributes,
  getSLDAttributes,
  setSLDAttributes,
} from './sld-attributes.js';
import { iedReferences, isIedReferenceElement } from './ied.js';
import { uuid } from '../foundations.js';

const parentTags: Partial<Record<string, string[]>> = {
  ConductingEquipment: ['Bay'],
  Bay: ['VoltageLevel'],
  VoltageLevel: ['Substation'],
  PowerTransformer: ['Bay', 'VoltageLevel', 'Substation'],
  Reference: ['Bay', 'VoltageLevel', 'Substation'],
};

export function canPlaceAt(
  root: Element,
  element: Element,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (element.tagName === 'Substation') {
    return true;
  }

  const overlappingSibling = Array.from(
    root.querySelectorAll(`${element.localName}, PowerTransformer`),
  )
    .concat(iedReferences(root))
    .find(
      sibling =>
        sibling.closest(element.localName) !== element &&
        overlapsRect(sibling, x, y, w, h) &&
        !isBusBar(sibling),
    );
  if (overlappingSibling && !isBusBar(element)) {
    return false;
  }

  const containingParent =
    element.tagName === 'VoltageLevel' ||
    element.tagName === 'PowerTransformer' ||
    isIedReferenceElement(element)
      ? containsRect(root, x, y, w, h)
      : Array.from(
        root.querySelectorAll(parentTags[element.localName]!.join(',')),
      ).find(parent => !isBusBar(parent) && containsRect(parent, x, y, w, h));
  if (containingParent) {
    return true;
  }
  return false;
}

export function canResizeTo(
  root: Element,
  element: Element,
  w: number,
  h: number,
): boolean {
  const {
    pos: [x, y],
    dim: [oldW, oldH],
  } = attributes(element);

  if (
    !canPlaceAt(root, element, x, y, w, h) &&
    canPlaceAt(root, element, x, y, oldW, oldH)
  ) {
    return false;
  }

  const lostChild = Array.from(element.children)
    .concat(iedReferences(element))
    .find((child) => {
      if (!parentTags[child.localName]?.includes(element.localName)) {
        return false;
      }
      const {
        pos: [cx, cy],
        dim: [cw, ch],
      } = attributes(child);

      return !contains([x, y, w, h], [cx, cy, cw, ch]);
    });
  if (lostChild) {
    return false;
  }

  return true;
}

export function canResizeToTL(
  root: Element,
  element: Element,
  x: number,
  y: number,
  w: number,
  h: number,
): boolean {
  if (!canPlaceAt(root, element, x, y, w, h)) {
    return false;
  }

  const lostChild = Array.from(element.children)
    .concat(iedReferences(element))
    .find((child) => {
      if (!parentTags[child.localName]?.includes(element.localName)) {
        return false;
      }
      const {
        pos: [cx, cy],
        dim: [cw, ch],
      } = attributes(child);

      return !contains([x, y, w, h], [cx, cy, cw, ch]);
    });
  if (lostChild) {
    return false;
  }

  return true;
}

/**
 * Deep-clones an SCL element into a stand-alone preview copy suitable for
 * placement: it strips IED references from containers, prunes connectivity to
 * foreign elements, and assigns fresh terminal/vertex UUIDs so the clone can be
 * positioned without colliding with the source topology.
 */
export function copyElementForPlacement(
  element: Element,
  nsp: string,
): Element {
  const clone = element.cloneNode(true) as Element;
  if (['Bay', 'VoltageLevel'].includes(element.tagName)) {
    iedReferences(clone).forEach(ied => ied.remove());
  }

  const terminals = new Set<Element>(
    Array.from(element.querySelectorAll('Terminal, NeutralPoint')),
  );
  const cNodes = new Set<Element>(
    Array.from(element.querySelectorAll('ConnectivityNode')),
  );

  terminals.forEach((terminal) => {
    const cNode = element.ownerDocument.querySelector(
      `ConnectivityNode[pathName="${terminal.getAttribute(
        'connectivityNode',
      )}"]`,
    );
    if (cNode) {
      cNodes.add(cNode);
    }
  });

  const foreignCNodes = new Set<Element>();
  cNodes.forEach((cNode) => {
    const foreignTerminal = Array.from(
      element.ownerDocument.querySelectorAll(
        `[connectivityNode="${cNode.getAttribute('pathName')}"]`,
      ),
    ).find(terminal => !terminals.has(terminal));
    if (
      foreignTerminal ||
      (isBusBar(cNode.closest('Bay')!) &&
        cNode.closest(element.tagName) !== element)
    ) {
      foreignCNodes.add(cNode);
    }
  });

  foreignCNodes.forEach((cNode) => {
    if (cNode.closest(element.tagName) === element) {
      if (isBusBar(cNode.closest('Bay')!)) {
        clone
          .querySelector(
            `ConnectivityNode[pathName="${cNode.getAttribute('pathName')}"]`,
          )
          ?.closest('Bay')
          ?.remove();
      } else {
        clone
          .querySelector(
            `ConnectivityNode[pathName="${cNode.getAttribute('pathName')}"]`,
          )
          ?.remove();
      }
    }

    terminals.forEach((terminal) => {
      if (
        terminal.getAttribute('connectivityNode') ===
        cNode.getAttribute('pathName')
      ) {
        clone
          .querySelector(`[*|uuid="${getSLDAttributes(terminal, 'uuid')}"]`)
          ?.remove();
      }
    });
  });

  Array.from(clone.querySelectorAll('Terminal, NeutralPoint')).forEach(
    (terminal) => {
      const oldUUID = getSLDAttributes(terminal, 'uuid');
      if (!oldUUID) {
        return;
      }

      const newUUID = uuid();
      Array.from(clone.querySelectorAll(`Vertex[*|uuid="${oldUUID}"`)).forEach(
        vertex => setSLDAttributes(vertex, nsp, { uuid: newUUID }),
      );
      setSLDAttributes(terminal, nsp, { uuid: newUUID });
    },
  );

  return clone;
}
