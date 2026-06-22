import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';

import type { OscdOutlinedTextField } from '@omicronenergy/oscd-ui/textfield/OscdOutlinedTextField.js';
import type { OscdFilledButton } from '@omicronenergy/oscd-ui/button/OscdFilledButton.js';

import { SldResizeSubstationDialog } from './sld-resize-substation-dialog.js';
import type { ResizeEvent } from './foundations/events.js';
import { sldFixture } from './test-helpers.js';

customElements.define(
  'sld-resize-substation-dialog',
  SldResizeSubstationDialog,
);

describe('sld-resize-substation-dialog', () => {
  let element: SldResizeSubstationDialog;
  let substation: Element;

  beforeEach(async () => {
    const doc = sldFixture({ vl: { x: 1, y: 1, w: 48, h: 23 } });
    substation = doc.querySelector('Substation')!;
    element = await fixture(
      html`<sld-resize-substation-dialog></sld-resize-substation-dialog>`,
    );
  });

  function widthField(): OscdOutlinedTextField {
    return element.shadowRoot!.querySelector<OscdOutlinedTextField>(
      '#substationWidth',
    )!;
  }

  function heightField(): OscdOutlinedTextField {
    return element.shadowRoot!.querySelector<OscdOutlinedTextField>(
      '#substationHeight',
    )!;
  }

  function clickResize() {
    element.shadowRoot!.querySelector<OscdFilledButton>(
      'div[slot="actions"] > oscd-filled-button',
    )!.click();
  }

  it('opens populated with the current substation dimensions', async () => {
    await element.show(substation);

    expect(element).to.have.property('substation', substation);
    expect(widthField().value).to.equal('50');
    expect(heightField().value).to.equal('25');
  });

  it('emits an oscd-sld-resize event with the new dimensions', async () => {
    await element.show(substation);

    let detail: ResizeEvent['detail'] | undefined;
    element.addEventListener('oscd-sld-resize', (event) => {
      detail = (event as ResizeEvent).detail;
    });

    widthField().value = '60';
    heightField().value = '30';
    clickResize();

    expect(detail).to.deep.equal({ element: substation, w: 60, h: 30 });
  });

  it('does not emit an event when dimensions are unchanged', async () => {
    await element.show(substation);

    let dispatched = false;
    element.addEventListener('oscd-sld-resize', () => {
      dispatched = true;
    });

    widthField().value = '50';
    heightField().value = '25';
    clickResize();

    expect(dispatched).to.be.false;
  });

  it('forbids undersizing the substation below its voltage levels', async () => {
    await element.show(substation);

    let dispatched = false;
    element.addEventListener('oscd-sld-resize', () => {
      dispatched = true;
    });

    widthField().value = '30';
    heightField().value = '20';
    clickResize();

    expect(dispatched).to.be.false;
  });

  it('marks undersized fields invalid with helper text', async () => {
    await element.show(substation);

    widthField().value = '30';
    heightField().value = '20';
    clickResize();
    await element.updateComplete;

    expect(widthField().validity.valid).to.be.false;
    expect(widthField().validationMessage).to.contain('voltage levels');
    expect(heightField().validity.valid).to.be.false;
    expect(heightField().validationMessage).to.contain('voltage levels');
  });

  it('clears the validation error as soon as the value is corrected', async () => {
    await element.show(substation);

    widthField().value = '30';
    clickResize();
    expect(widthField().validity.valid).to.be.false;

    widthField().value = '60';
    widthField().dispatchEvent(new Event('input'));

    expect(widthField().validity.valid).to.be.true;
    expect(widthField().validationMessage).to.equal('');
  });
});
