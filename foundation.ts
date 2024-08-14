import { Insert } from '@openscd/open-scd-core';

import { Update, getReference } from '@openenergytools/scl-lib';

/** Utility function to create element with `tagName` and its`attributes` */
function createElement(
  doc: XMLDocument,
  tag: string,
  attrs: Record<string, string | null>
): Element {
  const element = doc.createElementNS(doc.documentElement.namespaceURI, tag);
  Object.entries(attrs)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, value]) => value !== null)
    .forEach(([name, value]) => element.setAttribute(name, value!));

  return element;
}

function isDataTypeConnected(dataType: Element, template: Element): boolean {
  const dataTypeTemplates: Element = dataType.parentElement!;
  const id = dataType.getAttribute('id');

  if (!dataTypeTemplates || !id) return false;

  if (dataType.tagName === 'EnumType')
    return Array.from(
      dataTypeTemplates.querySelectorAll(
        `DOType > DA[type="${id}"],DAType > BDA[type="${id}"]`
      )
    ).some(typeChild =>
      isDataTypeConnected(typeChild.parentElement!, template)
    );

  if (dataType.tagName === 'DAType')
    return Array.from(
      dataTypeTemplates.querySelectorAll(
        `DOType > DA[type="${id}"],DAType > BDA[type="${id}"]`
      )
    ).some(typeChild =>
      isDataTypeConnected(typeChild.parentElement!, template)
    );

  if (dataType.tagName === 'DOType')
    return Array.from(
      dataTypeTemplates.querySelectorAll(
        `LNodeType > DO[type="${id}"], DOType > SDO[type="${id}"]`
      )
    ).some(typeChild =>
      isDataTypeConnected(typeChild.parentElement!, template)
    );

  return !!template.querySelector(`LNode[lnType="${id}"]`);
}

function addEnumType(
  template: Element,
  newEnumType: Element,
  oldDataTypeTemplates: Element
): Insert | undefined {
  if (!isDataTypeConnected(newEnumType, template)) return undefined;

  const existEnumType = oldDataTypeTemplates.querySelector(
    `EnumType[id="${newEnumType.getAttribute('id')}"]`
  );
  if (existEnumType && newEnumType.isEqualNode(existEnumType)) return undefined;

  if (existEnumType) {
    // There is an `id` conflict in the project that must be resolved by
    // concatenating the IED name with the id

    window.alert('There is inconsistent duplication. Please resolve first');

    return undefined;
  }

  return {
    parent: oldDataTypeTemplates,
    node: newEnumType,
    reference: getReference(oldDataTypeTemplates, 'EnumType'),
  };
}

function addDAType(
  template: Element,
  newDAType: Element,
  oldDataTypeTemplates: Element
): Insert | undefined {
  if (!isDataTypeConnected(newDAType, template)) return undefined;

  const existDAType = oldDataTypeTemplates.querySelector(
    `DAType[id="${newDAType.getAttribute('id')}"]`
  );
  if (existDAType && newDAType.isEqualNode(existDAType)) return undefined;

  if (existDAType) {
    // There is an `id` conflict in the project that must be resolved by
    // concatenating the IED name with the id

    window.alert('There is inconsistent duplication. Please resolve first');

    return undefined;
  }

  return {
    parent: oldDataTypeTemplates,
    node: newDAType,
    reference: getReference(oldDataTypeTemplates, 'DAType'),
  };
}

function addDOType(
  template: Element,
  newDOType: Element,
  oldDataTypeTemplates: Element
): Insert | undefined {
  if (!isDataTypeConnected(newDOType, template)) return undefined;

  const existDOType = oldDataTypeTemplates.querySelector(
    `DOType[id="${newDOType.getAttribute('id')}"]`
  );
  if (existDOType && newDOType.isEqualNode(existDOType)) return undefined;

  if (existDOType) {
    // There is an `id` conflict in the project that must be resolved by
    // concatenating the IED name with the id

    window.alert('There is inconsistent duplication. Please resolve first');

    return undefined;
  }

  return {
    parent: oldDataTypeTemplates,
    node: newDOType,
    reference: getReference(oldDataTypeTemplates, 'DOType'),
  };
}

function addLNodeType(
  template: Element,
  newLNodeType: Element,
  oldDataTypeTemplates: Element
): Insert | undefined {
  if (!isDataTypeConnected(newLNodeType, template)) return undefined;

  const existLNodeType = oldDataTypeTemplates.querySelector(
    `LNodeType[id="${newLNodeType.getAttribute('id')}"]`
  );
  if (existLNodeType && newLNodeType.isEqualNode(existLNodeType))
    return undefined;

  if (existLNodeType) {
    // There is an `id` conflict in the project that must be resolved by
    // concatenating the IED name with the id

    window.alert('There is inconsistent duplication. Please resolve first');

    return undefined;
  }

  return {
    parent: oldDataTypeTemplates,
    node: newLNodeType,
    reference: getReference(oldDataTypeTemplates, 'LNodeType'),
  };
}

export function addDataTypeTemplates(
  bayTemplate: Element,
  doc: XMLDocument
): Insert[] {
  const dataTypeEdit: Insert[] = [];

  const scl = doc.querySelector('SCL')!;

  const dataTypeTemplates = doc.querySelector(':root > DataTypeTemplates')
    ? doc.querySelector(':root > DataTypeTemplates')!
    : createElement(doc, 'DataTypeTemplates', {});

  if (!dataTypeTemplates.parentElement) {
    dataTypeEdit.push({
      parent: scl,
      node: dataTypeTemplates,
      reference: getReference(scl, 'DataTypeTemplates'),
    });
  }

  const typeEdits: (Insert | undefined)[] = [];
  bayTemplate.ownerDocument
    .querySelectorAll(':root > DataTypeTemplates > EnumType')
    .forEach(enumType =>
      typeEdits.push(addEnumType(bayTemplate, enumType, dataTypeTemplates!))
    );

  bayTemplate.ownerDocument
    .querySelectorAll(':root > DataTypeTemplates > DAType')
    .forEach(daType =>
      typeEdits.push(addDAType(bayTemplate, daType, dataTypeTemplates!))
    );

  bayTemplate.ownerDocument
    .querySelectorAll(':root > DataTypeTemplates > DOType')
    .forEach(doType =>
      typeEdits.push(addDOType(bayTemplate, doType, dataTypeTemplates!))
    );

  bayTemplate.ownerDocument
    .querySelectorAll(':root > DataTypeTemplates > LNodeType')
    .forEach(lNodeType =>
      typeEdits.push(addLNodeType(bayTemplate, lNodeType, dataTypeTemplates!))
    );

  return dataTypeEdit.concat(
    typeEdits.reverse().filter(item => item !== undefined) as Insert[]
  );
}

export function updateSourceRef(
  parent: Element,
  template: Element,
  newBay?: string
): Update[] {
  const updates: Update[] = [];

  template.querySelectorAll('SourceRef').forEach(srcRef => {
    const source = srcRef.getAttribute('source');
    if (!source) return;

    const ref = source.split('/');
    const begin = ref.splice(0, 3);

    const oldSubSt = parent.closest('Substation')?.getAttribute('name');
    const oldVoltLv = parent.closest('VoltageLevel')?.getAttribute('name');
    const oldBay = parent.closest('Bay')?.getAttribute('name');

    console.log(begin);
    console.log(ref);

    console.log(oldSubSt, oldVoltLv, oldBay);

    updates.push({
      element: srcRef,
      attributes: {
        source: `${oldSubSt}/${oldVoltLv}/${newBay}/${ref.join('/')}`,
      },
    });
  });

  return updates;
}
