import { getReference } from '@openenergytools/scl-lib';
/** Utility function to create element with `tagName` and its`attributes` */
function createElement(doc, tag, attrs) {
    const element = doc.createElementNS(doc.documentElement.namespaceURI, tag);
    Object.entries(attrs)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .filter(([_, value]) => value !== null)
        .forEach(([name, value]) => element.setAttribute(name, value));
    return element;
}
function isDataTypeConnected(dataType, template) {
    const dataTypeTemplates = dataType.parentElement;
    const id = dataType.getAttribute('id');
    if (!dataTypeTemplates || !id)
        return false;
    if (dataType.tagName === 'EnumType')
        return Array.from(dataTypeTemplates.querySelectorAll(`DOType > DA[type="${id}"],DAType > BDA[type="${id}"]`)).some(typeChild => isDataTypeConnected(typeChild.parentElement, template));
    if (dataType.tagName === 'DAType')
        return Array.from(dataTypeTemplates.querySelectorAll(`DOType > DA[type="${id}"],DAType > BDA[type="${id}"]`)).some(typeChild => isDataTypeConnected(typeChild.parentElement, template));
    if (dataType.tagName === 'DOType')
        return Array.from(dataTypeTemplates.querySelectorAll(`LNodeType > DO[type="${id}"], DOType > SDO[type="${id}"]`)).some(typeChild => isDataTypeConnected(typeChild.parentElement, template));
    return !!template.querySelector(`LNode[lnType="${id}"]`);
}
function addEnumType(template, newEnumType, oldDataTypeTemplates) {
    if (!isDataTypeConnected(newEnumType, template))
        return undefined;
    const existEnumType = oldDataTypeTemplates.querySelector(`EnumType[id="${newEnumType.getAttribute('id')}"]`);
    if (existEnumType && newEnumType.isEqualNode(existEnumType))
        return undefined;
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
function addDAType(template, newDAType, oldDataTypeTemplates) {
    if (!isDataTypeConnected(newDAType, template))
        return undefined;
    const existDAType = oldDataTypeTemplates.querySelector(`DAType[id="${newDAType.getAttribute('id')}"]`);
    if (existDAType && newDAType.isEqualNode(existDAType))
        return undefined;
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
function addDOType(template, newDOType, oldDataTypeTemplates) {
    if (!isDataTypeConnected(newDOType, template))
        return undefined;
    const existDOType = oldDataTypeTemplates.querySelector(`DOType[id="${newDOType.getAttribute('id')}"]`);
    if (existDOType && newDOType.isEqualNode(existDOType))
        return undefined;
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
function addLNodeType(template, newLNodeType, oldDataTypeTemplates) {
    if (!isDataTypeConnected(newLNodeType, template))
        return undefined;
    const existLNodeType = oldDataTypeTemplates.querySelector(`LNodeType[id="${newLNodeType.getAttribute('id')}"]`);
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
export function addDataTypeTemplates(bayTemplate, doc) {
    const dataTypeEdit = [];
    const scl = doc.querySelector('SCL');
    const dataTypeTemplates = doc.querySelector(':root > DataTypeTemplates')
        ? doc.querySelector(':root > DataTypeTemplates')
        : createElement(doc, 'DataTypeTemplates', {});
    if (!dataTypeTemplates.parentElement) {
        dataTypeEdit.push({
            parent: scl,
            node: dataTypeTemplates,
            reference: getReference(scl, 'DataTypeTemplates'),
        });
    }
    const typeEdits = [];
    bayTemplate.ownerDocument
        .querySelectorAll(':root > DataTypeTemplates > EnumType')
        .forEach(enumType => typeEdits.push(addEnumType(bayTemplate, enumType, dataTypeTemplates)));
    bayTemplate.ownerDocument
        .querySelectorAll(':root > DataTypeTemplates > DAType')
        .forEach(daType => typeEdits.push(addDAType(bayTemplate, daType, dataTypeTemplates)));
    bayTemplate.ownerDocument
        .querySelectorAll(':root > DataTypeTemplates > DOType')
        .forEach(doType => typeEdits.push(addDOType(bayTemplate, doType, dataTypeTemplates)));
    bayTemplate.ownerDocument
        .querySelectorAll(':root > DataTypeTemplates > LNodeType')
        .forEach(lNodeType => typeEdits.push(addLNodeType(bayTemplate, lNodeType, dataTypeTemplates)));
    return dataTypeEdit.concat(typeEdits.reverse().filter(item => item !== undefined));
}
export function updateSourceRef(parent, template, newBay) {
    const updates = [];
    template.querySelectorAll('SourceRef').forEach(srcRef => {
        var _a, _b, _c;
        const source = srcRef.getAttribute('source');
        if (!source)
            return;
        const ref = source.split('/');
        const begin = ref.splice(0, 3);
        const oldSubSt = (_a = parent.closest('Substation')) === null || _a === void 0 ? void 0 : _a.getAttribute('name');
        const oldVoltLv = (_b = parent.closest('VoltageLevel')) === null || _b === void 0 ? void 0 : _b.getAttribute('name');
        const oldBay = (_c = parent.closest('Bay')) === null || _c === void 0 ? void 0 : _c.getAttribute('name');
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
//# sourceMappingURL=foundation.js.map