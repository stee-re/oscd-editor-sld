import { getReference } from '@openscd/scl-lib';

import {
  connectivityPath,
  isBusBar,
  removeNode,
  removeTerminal,
  reparentElement,
} from './connectivity.js';
import { iedReferences } from './ied.js';
import {
  attributes,
  getSLDAttributes,
  setSLDAttributes,
  updateSLDAttributes,
} from './sld-attributes.js';
import { privType, sldNs, uuid } from '../foundations.js';

import type { EditV2, SetAttributes } from '@openscd/oscd-api';
import type { Point } from './geometry.js';
import type { ConnectDetail } from './events.js';

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
    (cNode) => {
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
    (terminal) => {
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

export function createRotateEdits(element: Element, nsp: string): EditV2[] {
  const { rot } = attributes(element);
  const edits: EditV2[] = [
    updateSLDAttributes(element, nsp, {
      rot: ((rot + 1) % 4).toString(),
    }),
  ];
  if (
    element.tagName === 'ConductingEquipment' ||
    element.tagName === 'PowerTransformer'
  ) {
    Array.from(element.querySelectorAll('Terminal, NeutralPoint'))
      .filter(terminal => terminal.getAttribute('cNodeName') !== 'grounded')
      .forEach(terminal => edits.push(...removeTerminal(terminal)));
  }
  return edits;
}

export function createPlaceLabelEdit(
  element: Element,
  nsp: string,
  x: number,
  y: number,
): EditV2 {
  return updateSLDAttributes(element, nsp, {
    lx: x.toString(),
    ly: y.toString(),
  });
}

export function createResizeEdits(
  element: Element,
  nsp: string,
  w: number,
  h: number,
): EditV2 {
  return updateSLDAttributes(element, nsp, {
    w: w.toString(),
    h: h.toString(),
  });
}

export function createResizeTLEdits(
  element: Element,
  nsp: string,
  x: number,
  y: number,
  w: number,
  h: number,
): EditV2 {
  const {
    pos: [oldX, oldY],
    label: [oldLX, oldLY],
  } = attributes(element);
  let lx = oldLX;
  let ly = oldLY;
  if (lx === oldX && ly === oldY) {
    lx += x - oldX;
    ly += y - oldY;
  }

  return updateSLDAttributes(element, nsp, {
    x: x.toString(),
    y: y.toString(),
    w: w.toString(),
    h: h.toString(),
    lx: lx.toString(),
    ly: ly.toString(),
  });
}

function cutSectionAt(
  section: Element,
  index: number,
  [x, y]: Point,
  nsPrefix: string,
): EditV2[] {
  const parent = section.parentElement!;
  const edits = [] as EditV2[];
  const vertices = Array.from(section.getElementsByTagNameNS(sldNs, 'Vertex'));
  const vertexAtXY = vertices.find(
    ve =>
      getSLDAttributes(ve, 'x') === x.toString() &&
      getSLDAttributes(ve, 'y') === y.toString(),
  );

  if (
    vertexAtXY === vertices[0] ||
    vertexAtXY === vertices[vertices.length - 1]
  ) {
    return [];
  }

  const newSection = section.cloneNode(true) as Element;
  Array.from(newSection.getElementsByTagNameNS(sldNs, 'Vertex'))
    .slice(0, index + 1)
    .forEach(vertex => vertex.remove());
  const v = vertices[index].cloneNode() as Element;
  setSLDAttributes(v, nsPrefix, { x: x.toString(), y: y.toString() });
  v.removeAttributeNS(sldNs, 'uuid');
  newSection.prepend(v);
  edits.push({
    node: newSection,
    parent,
    reference: section.nextElementSibling,
  });

  vertices.slice(index + 1).forEach(vertex => edits.push({ node: vertex }));

  if (!vertexAtXY) {
    const v2 = v.cloneNode();
    edits.push({ node: v2, parent: section, reference: null });
  }

  return edits;
}

export function createConnectEdits(
  { from, fromTerminal, to, toTerminal, path }: ConnectDetail,
  doc: XMLDocument,
  nsp: string,
): EditV2[] {
  if (
    from.tagName === 'TransformerWinding' &&
    to.tagName === 'TransformerWinding'
  ) {
    return [];
  }
  const edits = [] as EditV2[];
  let cNode: Element;
  let connectivityNode: string;
  let cNodeName: string;
  let priv: Element;
  if (to.tagName !== 'ConnectivityNode') {
    cNode = doc.createElementNS(
      doc.documentElement.namespaceURI,
      'ConnectivityNode',
    );
    cNode.setAttribute('name', 'L1');
    const bay = from.closest('Bay') || to.closest('Bay')!;
    edits.push(...reparentElement(cNode, bay));
    connectivityNode = (
      edits.find(
        e => 'attributes' in e && 'pathName' in e.attributes!,
      ) as SetAttributes
    ).attributes!.pathName as string;
    cNodeName =
      ((
        edits.find(
          e => 'attributes' in e && 'name' in e.attributes!,
        ) as SetAttributes
      )?.attributes!.name as string | undefined) ??
      cNode.getAttribute('name')!;
    priv = doc.createElementNS(
      doc.documentElement.namespaceURI,
      'Private',
    );
    priv.setAttribute('type', privType);
    edits.push({
      parent: cNode,
      node: priv,
      reference: getReference(cNode, 'Private'),
    });
  } else {
    cNode = to;
    connectivityNode = cNode.getAttribute('pathName')!;
    cNodeName = cNode.getAttribute('name')!;
    priv = cNode.querySelector(`Private[type="${privType}"]`)!;
  }
  const section = doc.createElementNS(sldNs, `${nsp}:Section`);
  edits.push({ parent: priv!, node: section, reference: null });
  const fromTermUUID = uuid();
  const toTermUUID = uuid();
  path.forEach(([x, y], i) => {
    const vertex = doc.createElementNS(sldNs, `${nsp}:Vertex`);
    setSLDAttributes(vertex, nsp, { x: x.toString(), y: y.toString() });
    if (i === 0) {
      setSLDAttributes(vertex, nsp, { uuid: fromTermUUID });
    } else if (i === path.length - 1 && to.tagName !== 'ConnectivityNode') {
      setSLDAttributes(vertex, nsp, { uuid: toTermUUID });
    }
    edits.push({ parent: section, node: vertex, reference: null });
  });
  if (to.tagName === 'ConnectivityNode') {
    const [x, y] = path[path.length - 1];
    Array.from(priv.getElementsByTagNameNS(sldNs, 'Section')).find((s) => {
      const sectionPath = Array.from(
        s.getElementsByTagNameNS(sldNs, 'Vertex'),
      ).map(v => attributes(v).pos);
      for (let i = 0; i < sectionPath.length - 1; i += 1) {
        const [x0, y0] = sectionPath[i];
        const [x1, y1] = sectionPath[i + 1];
        if (
          (y0 === y &&
            y === y1 &&
            ((x0 < x && x < x1) || (x1 < x && x < x0))) ||
          (x0 === x &&
            x === x1 &&
            ((y0 < y && y < y1) || (y1 < y && y < y0))) ||
          (y0 === y && x0 === x)
        ) {
          edits.push(cutSectionAt(s, i, [x, y], nsp));
          return true;
        }
      }
      return false;
    });
  }
  const [substationName, voltageLevelName, bayName] = connectivityNode.split(
    '/',
    3,
  );
  const fromTagName = fromTerminal.startsWith('T')
    ? 'Terminal'
    : 'NeutralPoint';
  const fromTermElement = doc.createElementNS(
    doc.documentElement.namespaceURI,
    fromTagName,
  );
  setSLDAttributes(fromTermElement, nsp, { uuid: fromTermUUID });
  fromTermElement.setAttribute('name', fromTerminal);
  fromTermElement.setAttribute('connectivityNode', connectivityNode);
  fromTermElement.setAttribute('substationName', substationName);
  fromTermElement.setAttribute('voltageLevelName', voltageLevelName);
  fromTermElement.setAttribute('bayName', bayName);
  fromTermElement.setAttribute('cNodeName', cNodeName);
  edits.push({
    node: fromTermElement,
    parent: from,
    reference: getReference(from, fromTagName),
  });
  if (to.tagName === 'ConductingEquipment') {
    const toTagName = toTerminal!.startsWith('T')
      ? 'Terminal'
      : 'NeutralPoint';
    const toTermElement = doc.createElementNS(
      doc.documentElement.namespaceURI,
      toTagName,
    );
    setSLDAttributes(toTermElement, nsp, { uuid: toTermUUID });
    toTermElement.setAttribute('name', toTerminal!);
    toTermElement.setAttribute('connectivityNode', connectivityNode);
    toTermElement.setAttribute('substationName', substationName);
    toTermElement.setAttribute('voltageLevelName', voltageLevelName);
    toTermElement.setAttribute('bayName', bayName);
    toTermElement.setAttribute('cNodeName', cNodeName);
    edits.push({
      node: toTermElement,
      parent: to,
      reference: getReference(to, toTagName),
    });
  }
  return edits;
}
