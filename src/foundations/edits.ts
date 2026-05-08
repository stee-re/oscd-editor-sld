import { getReference } from '@openscd/scl-lib';

import {
  connectivityPath,
  isBusBar,
  removeNode,
  removeTerminal,
} from './connectivity.js';
import { iedReferences } from './ied.js';
import {
  attributes,
  getSLDAttributes,
  setSLDAttributes,
  updateSLDAttributes,
} from './sld-attributes.js';
import { uuid } from '../foundations.js';

import type { EditV2 } from '@openscd/oscd-api';

export type TerminalName = 'T1' | 'T2' | 'N1' | 'N2';

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

  terminals.forEach(terminal => {
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
  cNodes.forEach(cNode => {
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

  foreignCNodes.forEach(cNode => {
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

    terminals.forEach(terminal => {
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
    terminal => {
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

export function createGroundTerminalEdits(
  equipment: Element,
  name: TerminalName,
): EditV2[] | null {
  const neutralPoint = name.startsWith('N');
  const bay = equipment.closest('Bay');
  if (!bay) {
    return null;
  }

  const edits: EditV2[] = [];
  let grounded = bay.querySelector(
    ':scope > ConnectivityNode[name="grounded"]',
  );
  let pathName = grounded?.getAttribute('pathName');
  if (!pathName) {
    pathName = connectivityPath(bay, 'grounded');
    grounded = equipment.ownerDocument.createElementNS(
      equipment.ownerDocument.documentElement.namespaceURI,
      'ConnectivityNode',
    );
    grounded.setAttribute('name', 'grounded');
    grounded.setAttribute('pathName', pathName);
    edits.push({
      parent: bay,
      node: grounded,
      reference: getReference(bay, 'ConnectivityNode'),
    });
  }

  const tagName = neutralPoint ? 'NeutralPoint' : 'Terminal';
  const terminal = equipment.ownerDocument.createElementNS(
    equipment.ownerDocument.documentElement.namespaceURI,
    tagName,
  );
  terminal.setAttribute('name', name);
  terminal.setAttribute('cNodeName', 'grounded');

  const substationName = bay.closest('Substation')!.getAttribute('name');
  if (substationName) {
    terminal.setAttribute('substationName', substationName);
  }

  const voltageLevelName = bay.closest('VoltageLevel')!.getAttribute('name');
  if (voltageLevelName) {
    terminal.setAttribute('voltageLevelName', voltageLevelName);
  }

  const bayName = bay.getAttribute('name');
  if (bayName) {
    terminal.setAttribute('bayName', bayName);
  }

  terminal.setAttribute('connectivityNode', pathName);
  edits.push({
    parent: equipment,
    node: terminal,
    reference: getReference(equipment, tagName),
  });

  return edits;
}

export function createFlipElementEdits(
  element: Element,
  nsp: string,
): EditV2[] {
  const { flip, kind } = attributes(element);
  const edits: EditV2[] = [
    updateSLDAttributes(element, nsp, {
      flip: flip ? null : 'true',
    }),
  ];

  if (element.tagName === 'PowerTransformer') {
    const winding = element.querySelector('TransformerWinding')!;
    Array.from(winding.querySelectorAll('Terminal')).forEach(terminal =>
      edits.push(...removeTerminal(terminal)),
    );
    if (kind === 'earthing') {
      Array.from(winding.querySelectorAll('NeutralPoint')).forEach(np =>
        edits.push(...removeTerminal(np)),
      );
    }
  }

  return edits;
}

export function createAddTextEdit(element: Element, nsp: string): EditV2 {
  const {
    pos: [x, y],
  } = attributes(element);
  const text = element.ownerDocument.createElementNS(
    element.ownerDocument.documentElement.namespaceURI,
    'Text',
  );
  setSLDAttributes(text, nsp, {
    lx: x.toString(),
    ly: (y < 2 ? y + 1 : y - 1).toString(),
  });

  return {
    node: text,
    parent: element,
    reference: getReference(element, 'Text'),
  };
}

export function createDeleteBusBarEdits(busBar: Element): EditV2[] {
  const node = busBar.querySelector('ConnectivityNode')!;
  return [...removeNode(node), { node: busBar }];
}

export function createDeleteContainerEdits(container: Element): EditV2[] {
  const edits: EditV2[] = [];

  Array.from(container.getElementsByTagName('ConnectivityNode')).forEach(
    cNode => {
      if (
        Array.from(
          container.ownerDocument.querySelectorAll(
            `[connectivityNode="${cNode.getAttribute('pathName')}"]`,
          ),
        ).find(terminal => terminal.closest(container.tagName) !== container)
      ) {
        edits.push(...removeNode(cNode));
      }
    },
  );

  Array.from(container.querySelectorAll('Terminal, NeutralPoint')).forEach(
    terminal => {
      const cNode = container.ownerDocument.querySelector(
        `ConnectivityNode[pathName="${terminal.getAttribute(
          'connectivityNode',
        )}"]`,
      );
      if (cNode && cNode.closest(container.tagName) !== container) {
        edits.push(...removeNode(cNode));
      }
    },
  );

  edits.push({ node: container });

  return edits;
}
