import { html, nothing, type TemplateResult } from 'lit';

import {
  bayGraphic,
  equipmentGraphic,
  ptrIcon,
  voltageLevelGraphic,
} from './icons.js';
import { isBusBar } from './foundations/connectivity.js';
import { isIedReferenceElement } from './foundations/ied.js';
import { attributes } from './foundations/sld-attributes.js';

export type EditWizardDetail = { element: Element };

export type MenuItem = {
  handler?: () => void;
  content: TemplateResult;
};

export function newSclEditDialogEvent(
  element: Element,
): CustomEvent<EditWizardDetail> {
  return new CustomEvent<EditWizardDetail>('oscd-edit-wizard-request', {
    bubbles: true,
    composed: true,
    detail: { element },
  });
}

export function renderMenuHeader(element: Element): TemplateResult {
  let name = element.getAttribute('name') || element.tagName;
  let detail: string | null | TemplateResult<1> = element.getAttribute('desc');
  const type = element.getAttribute('type');

  if (type) {
    if (detail) {
      detail = html`${type} &mdash; ${detail}`;
    } else {
      detail = type;
    }
  }

  let footerGraphic = equipmentGraphic(null);
  if (element.tagName === 'PowerTransformer') {
    const windings = element.querySelectorAll('TransformerWinding').length;
    const { kind } = attributes(element);

    if (windings === 3) {
      footerGraphic = ptrIcon(3, { slot: 'start' });
    } else if (windings === 2) {
      footerGraphic = ptrIcon(2, { slot: 'start', kind });
    } else {
      footerGraphic = ptrIcon(1, { slot: 'start', kind });
    }
  } else if (element.tagName === 'TransformerWinding') {
    footerGraphic = ptrIcon(1, { slot: 'start' });
  } else if (element.tagName === 'ConductingEquipment') {
    footerGraphic = equipmentGraphic(type);
  } else if (element.tagName === 'Bay' && isBusBar(element)) {
    footerGraphic = html`<oscd-icon slot="start">horizontal_rule</oscd-icon>`;
  } else if (element.tagName === 'Bay') {
    footerGraphic = bayGraphic;
  } else if (element.tagName === 'VoltageLevel') {
    footerGraphic = voltageLevelGraphic;
  } else if (isIedReferenceElement(element)) {
    name = 'IED';
    footerGraphic = html`<oscd-icon slot="start">developer_board</oscd-icon>`;
  } else if (element.tagName === 'Text') {
    footerGraphic = html`<oscd-icon slot="start">title</oscd-icon>`;
    detail = element.textContent;
  }

  return html`<oscd-list-item type="text">
    <div slot="headline">${name}</div>
    ${detail
      ? html`<div
          slot="supporting-text"
          style="display: inline-block; max-width: 15em; overflow: hidden; text-overflow: ellipsis;"
        >
          ${detail}
        </div>`
      : nothing}
    ${footerGraphic}
  </oscd-list-item>`;
}
