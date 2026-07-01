import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';

import type { OscdIconButton } from '@omicronenergy/oscd-ui/iconbutton/OscdIconButton.js';

import { SldSubstationHeader } from './sld-substation-header.js';

customElements.define('sld-substation-header', SldSubstationHeader);

describe('sld-substation-header', () => {
  function substationElement(name = 'S1'): Element {
    const doc = new DOMParser().parseFromString(
      `<SCL xmlns="http://www.iec.ch/61850/2003/SCL"><Substation name="${name}"/></SCL>`,
      'application/xml',
    );
    return doc.querySelector('Substation')!;
  }

  async function headerFixture({
    name = 'S1',
    disabled = false,
  } = {}) {
    return fixture<SldSubstationHeader>(html`<sld-substation-header
      .substation=${substationElement(name)}
      ?disabled=${disabled}
    ></sld-substation-header>`);
  }

  function buttons(element: SldSubstationHeader): OscdIconButton[] {
    return Array.from(
      element.shadowRoot!.querySelectorAll<OscdIconButton>(
        'h2 > oscd-icon-button',
      ),
    );
  }

  function click(button: OscdIconButton): void {
    button.shadowRoot?.querySelector<HTMLElement>('#button')?.click();
  }

  it('renders the substation name', async () => {
    const element = await headerFixture({ name: 'Grid' });

    expect(element.shadowRoot!.querySelector('h2')!.textContent).to.contain(
      'Grid',
    );
  });

  it('renders edit, resize, delete and export buttons in order', async () => {
    const element = await headerFixture();

    expect(buttons(element)).to.have.lengthOf(4);
  });

  it('emits sld-header-edit when the edit button is clicked', async () => {
    const element = await headerFixture();
    let fired = false;
    element.addEventListener('sld-header-edit', () => {
      fired = true;
    });

    click(buttons(element)[0]);

    expect(fired).to.be.true;
  });

  it('emits sld-header-resize when the resize button is clicked', async () => {
    const element = await headerFixture();
    let fired = false;
    element.addEventListener('sld-header-resize', () => {
      fired = true;
    });

    click(buttons(element)[1]);

    expect(fired).to.be.true;
  });

  it('emits sld-header-delete when the delete button is clicked', async () => {
    const element = await headerFixture();
    let fired = false;
    element.addEventListener('sld-header-delete', () => {
      fired = true;
    });

    click(buttons(element)[2]);

    expect(fired).to.be.true;
  });

  it('emits sld-header-export when the export button is clicked', async () => {
    const element = await headerFixture();
    let fired = false;
    element.addEventListener('sld-header-export', () => {
      fired = true;
    });

    click(buttons(element)[3]);

    expect(fired).to.be.true;
  });

  it('emits header events that bubble and cross shadow boundaries', async () => {
    const element = await headerFixture();
    const event = await new Promise<Event>((resolve) => {
      element.addEventListener('sld-header-edit', resolve, { once: true });
      click(buttons(element)[0]);
    });

    expect(event.bubbles).to.be.true;
    expect(event.composed).to.be.true;
  });

  it('marks the header disabled when the disabled property is set', async () => {
    const element = await headerFixture({ disabled: true });

    expect(
      element.shadowRoot!.querySelector('h2')!.classList.contains('disabled'),
    ).to.be.true;
  });
});
