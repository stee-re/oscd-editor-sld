import { getReference } from '@openscd/scl-lib';

import { isIedReferenceElement } from './ied.js';
import { privType, sldNs } from './namespaces.js';
import {
  attributes,
  getSLDAttributes,
  setSLDAttributes,
  xmlBoolean,
} from './sld-attributes.js';

import type { EditV2 } from '@openscd/oscd-api';
import type { Point } from './types.js';

function sections(element: Element): Element[] {
  return Array.from(
    element.querySelectorAll(`:scope Private[type="${privType}"] > Section`),
  );
}

/** Returns the SLD sections in an element that are marked as busbar geometry. */
export function busSections(element: Element): Element[] {
  return sections(element).filter(
    section => getSLDAttributes(section, 'bus') === 'true',
  );
}

/** Returns the SLD sections in an element that represent regular connection geometry. */
export function nonBusSections(element: Element): Element[] {
  return sections(element).filter(section => !getSLDAttributes(section, 'bus'));
}

function containsBusSection(element: Element): boolean {
  return busSections(element).length > 0;
}

/** Checks whether a Bay element is represented as an SLD busbar. */
export function isBusBar(element: Element) {
  return element.tagName === 'Bay' && containsBusSection(element);
}

/** Creates the template Bay structure used by the palette for new busbars. */
export function makeBusBar(doc: XMLDocument, nsp: string) {
  const busBar = doc.createElementNS(doc.documentElement.namespaceURI, 'Bay');
  busBar.setAttribute('name', 'BB1');
  setSLDAttributes(busBar, nsp, { w: '2' });
  const cNode = doc.createElementNS(
    doc.documentElement.namespaceURI,
    'ConnectivityNode',
  );
  cNode.setAttribute('name', 'L');
  const priv = doc.createElementNS(doc.documentElement.namespaceURI, 'Private');
  priv.setAttribute('type', privType);
  const section = doc.createElementNS(sldNs, `${nsp}:Section`);
  setSLDAttributes(section, nsp, { bus: 'true' });
  const v1 = doc.createElementNS(sldNs, `${nsp}:Vertex`);
  setSLDAttributes(v1, nsp, { x: '0.5', y: '0.5' });
  section.appendChild(v1);
  const v2 = doc.createElementNS(sldNs, `${nsp}:Vertex`);
  setSLDAttributes(v2, nsp, { x: '1.5', y: '0.5' });
  section.appendChild(v2);
  priv.appendChild(section);
  cNode.appendChild(priv);
  busBar.appendChild(cNode);
  return busBar;
}

/** Builds the slash-separated SCL connectivity path for an element and optional child path parts. */
export function connectivityPath(element: Element, ...rest: string[]): string {
  const pedigree = [];
  let child = element;
  while (child.parentElement && child.hasAttribute('name')) {
    pedigree.unshift(child.getAttribute('name')!);
    child = child.parentElement;
  }
  return [...pedigree, ...rest].join('/');
}

function collinear(v0: Element, v1: Element, v2: Element) {
  const [[x0, y0], [x1, y1], [x2, y2]] = [v0, v1, v2].map(vertex =>
    ['x', 'y'].map(name => getSLDAttributes(vertex, name)),
  );
  return (x0 === x1 && x1 === x2) || (y0 === y1 && y1 === y2);
}

/** Builds edits to remove a connectivity node or busbar and its dependent terminal references. */
export function removeNode(node: Element): EditV2[] {
  const edits = [] as EditV2[];

  if (containsBusSection(node)) {
    nonBusSections(node).forEach(section => edits.push({ node: section }));

    const sections = busSections(node);
    const busSection = sections[0];
    Array.from(busSection.children)
      .slice(1)
      .forEach(vertex => edits.push({ node: vertex }));
    const lastVertex = sections[sections.length - 1].lastElementChild;
    if (lastVertex)
      edits.push({ parent: busSection, node: lastVertex, reference: null });
    sections.slice(1).forEach(section => edits.push({ node: section }));
  } else edits.push({ node });

  Array.from(
    node.ownerDocument.querySelectorAll(
      `Terminal[connectivityNode="${node.getAttribute(
        'pathName',
      )}"], NeutralPoint[connectivityNode="${node.getAttribute('pathName')}"]`,
    ),
  ).forEach(terminal => edits.push({ node: terminal }));

  return edits;
}

function reverseSection(section: Element): EditV2[] {
  const edits = [] as EditV2[];

  Array.from(section.children)
    .reverse()
    .forEach(vertex =>
      edits.push({ parent: section, node: vertex, reference: null }),
    );

  return edits;
}

function healSectionCut(cut: Element): EditV2[] {
  const [x, y] = ['x', 'y'].map(name => getSLDAttributes(cut, name));

  const isCut = (vertex: Element) =>
    vertex !== cut &&
    getSLDAttributes(vertex, 'x') === x &&
    getSLDAttributes(vertex, 'y') === y;

  const cutVertices = Array.from(
    cut.closest('Private')!.getElementsByTagNameNS(sldNs, 'Section'),
  ).flatMap(section => Array.from(section.children).filter(isCut));
  const cutSections = cutVertices.map(v => v.parentElement) as Element[];

  if (cutSections.length > 2) return [];
  if (cutSections.length < 2)
    return removeNode(cut.closest('ConnectivityNode')!);
  const [busA, busB] = cutSections.map(section =>
    xmlBoolean(section.getAttribute('bus')),
  );
  if (busA !== busB) return [];

  const edits = [] as EditV2[];
  const [sectionA, sectionB] = cutSections as [Element, Element];
  if (isCut(sectionA.firstElementChild!)) edits.push(reverseSection(sectionA));
  const sectionBChildren = Array.from(sectionB.children);
  if (isCut(sectionB.lastElementChild!)) sectionBChildren.reverse();

  sectionBChildren
    .slice(1)
    .forEach(node => edits.push({ parent: sectionA, node, reference: null }));

  const cutA = Array.from(sectionA.children).find(isCut);
  const neighbourA = isCut(sectionA.firstElementChild!)
    ? sectionA.children[1]
    : sectionA.children[sectionA.childElementCount - 2];
  const neighbourB = sectionBChildren[1];
  if (
    neighbourA &&
    cutA &&
    neighbourB &&
    collinear(neighbourA, cutA, neighbourB)
  )
    edits.push({ node: cutA });
  edits.push({ node: sectionB });

  return edits;
}

function updateTerminals(
  _parent: Element,
  cNode: Element,
  substationName: string,
  voltageLevelName: string,
  bayName: string,
  cNodeName: string,
  connectivityNode: string,
) {
  const updates = [] as EditV2[];

  const oldPathName = cNode.getAttribute('pathName');
  if (!oldPathName) return [];
  const [oldSubstationName, oldVoltageLevelName, oldBayName, oldCNodeName] =
    oldPathName.split('/');

  const terminals = Array.from(
    (cNode.getRootNode() as Document | Element).querySelectorAll(
      `Terminal[substationName="${oldSubstationName}"][voltageLevelName="${oldVoltageLevelName}"][bayName="${oldBayName}"][cNodeName="${oldCNodeName}"], Terminal[connectivityNode="${oldPathName}"], NeutralPoint[substationName="${oldSubstationName}"][voltageLevelName="${oldVoltageLevelName}"][bayName="${oldBayName}"][cNodeName="${oldCNodeName}"], NeutralPoint[connectivityNode="${oldPathName}"]`,
    ),
  );
  terminals.forEach(terminal => {
    updates.push({
      element: terminal,
      attributes: {
        substationName,
        voltageLevelName,
        bayName,
        connectivityNode,
        cNodeName,
      },
    });
  });
  return updates;
}

function updateConnectivityNodes(
  element: Element,
  parent: Element,
  name: string,
) {
  const updates = [] as EditV2[];

  const cNodes = Array.from(element.getElementsByTagName('ConnectivityNode'));
  if (element.tagName === 'ConnectivityNode') cNodes.push(element);
  const substationName = parent.closest('Substation')!.getAttribute('name');
  let voltageLevelName = parent.closest('VoltageLevel')?.getAttribute('name');
  if (element.tagName === 'VoltageLevel') voltageLevelName = name;

  cNodes.forEach(cNode => {
    let cNodeName = cNode.getAttribute('name');
    if (element === cNode) cNodeName = name;
    let bayName = cNode.parentElement?.getAttribute('name') ?? '';
    if (element.tagName === 'Bay') bayName = name;
    if (parent.tagName === 'Bay' && parent.hasAttribute('name'))
      bayName = parent.getAttribute('name')!;

    if (cNodeName && bayName) {
      const pathName = `${substationName}/${voltageLevelName}/${bayName}/${cNodeName}`;
      updates.push({
        element: cNode,
        attributes: {
          pathName,
        },
      });
      if (substationName && voltageLevelName && bayName)
        updates.push(
          ...updateTerminals(
            parent,
            cNode,
            substationName,
            voltageLevelName,
            bayName,
            cNodeName,
            pathName,
          ),
        );
    }
  });
  return updates;
}

/** Returns a unique name for an element under a parent, preserving its current name when possible. */
export function uniqueName(element: Element, parent: Element): string {
  const children = Array.from(parent.children);
  const oldName = element.getAttribute('name');
  if (
    oldName &&
    !children.find(child => child.getAttribute('name') === oldName)
  )
    return oldName;

  const baseName =
    element.getAttribute('name')?.replace(/[0-9]*$/, '') ??
    element.getAttribute('type') ??
    element.tagName.charAt(0);
  let index = 1;
  function hasName(child: Element) {
    return child.getAttribute('name') === baseName + index.toString();
  }
  while (children.find(hasName)) index += 1;

  return baseName + index.toString();
}

/** Builds edits to move an element to a new parent and repair affected connectivity paths. */
export function reparentElement(element: Element, parent: Element): EditV2[] {
  const edits: EditV2[] = [];
  edits.push({
    node: element,
    parent,
    reference: getReference(parent, element.tagName),
  });
  const newName = uniqueName(element, parent);
  if (
    !isIedReferenceElement(element) &&
    newName !== element.getAttribute('name')
  )
    edits.push({ element, attributes: { name: newName } });
  edits.push(...updateConnectivityNodes(element, parent, newName));
  return edits;
}

/** Builds edits to detach a terminal or neutral point and heal orphaned connectivity geometry. */
export function removeTerminal(terminal: Element): EditV2[] {
  const edits = [] as EditV2[];

  edits.push({ node: terminal });
  const pathName = terminal.getAttribute('connectivityNode');
  const cNode = terminal.ownerDocument.querySelector(
    `ConnectivityNode[pathName="${pathName}"]`,
  );

  const otherTerminals = Array.from(
    terminal.ownerDocument.querySelectorAll(
      `Terminal[connectivityNode="${pathName}"], NeutralPoint[connectivityNode="${pathName}"]`,
    ),
  ).filter(t => t !== terminal);

  if (
    cNode &&
    otherTerminals.length > 1 &&
    otherTerminals.some(t => t.closest('Bay')) &&
    otherTerminals.every(t => t.closest('Bay') !== cNode.closest('Bay')) &&
    !isBusBar(cNode.closest('Bay')!)
  ) {
    const newParent = otherTerminals
      .find(t => t.closest('Bay'))!
      .closest('Bay');
    if (newParent) edits.push(...reparentElement(cNode, newParent));
  }
  if (
    cNode &&
    otherTerminals.length <= 1 &&
    cNode.getAttribute('name') !== 'grounded'
  ) {
    edits.push(...removeNode(cNode));
    return edits;
  }

  const priv = cNode?.querySelector(`Private[type="${privType}"]`);
  const vertex = priv?.querySelector(
    `Vertex[*|uuid="${getSLDAttributes(terminal, 'uuid')}"]`,
  );
  const section = vertex?.parentElement;
  if (!section) return edits;
  edits.push({ node: section });

  const cut =
    vertex === section.lastElementChild
      ? section.firstElementChild
      : section.lastElementChild;

  if (cut) edits.push(...healSectionCut(cut));

  return edits;
}

/** Calculates rendered anchor points for starting T1 and T2 connections from equipment. */
export function connectionStartPoints(equipment: Element): {
  T1: [Point, Point];
  T2: [Point, Point];
} {
  const {
    pos: [x, y],
    rot,
  } = attributes(equipment);

  const T1 = [
    [
      [x + 0.5, y + 0.16],
      [x + 0.84, y + 0.5],
      [x + 0.5, y + 0.84],
      [x + 0.16, y + 0.5],
    ][rot],
    [
      [x + 0.5, y],
      [x + 1, y + 0.5],
      [x + 0.5, y + 1],
      [x, y + 0.5],
    ][rot],
  ] as [Point, Point];
  const T2 = [
    [
      [x + 0.5, y + 0.84],
      [x + 0.16, y + 0.5],
      [x + 0.5, y + 0.16],
      [x + 0.84, y + 0.5],
    ][rot],
    [
      [x + 0.5, y + 1],
      [x, y + 0.5],
      [x + 0.5, y],
      [x + 1, y + 0.5],
    ][rot],
  ] as [Point, Point];

  return { T1, T2 };
}
