import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';

import { SldCoordinateTooltip } from './sld-coordinate-tooltip.js';

customElements.define('sld-coordinate-tooltip', SldCoordinateTooltip);

describe('sld-coordinate-tooltip', () => {
  async function tooltipFixture({
    text = '5,6',
    invalid = false,
    tooltipHidden = false,
  } = {}) {
    return fixture<SldCoordinateTooltip>(html`<sld-coordinate-tooltip
      .text=${text}
      .invalid=${invalid}
      .tooltipHidden=${tooltipHidden}
    ></sld-coordinate-tooltip>`);
  }

  function coordinates(element: SldCoordinateTooltip): HTMLElement {
    return element.shadowRoot!.querySelector<HTMLElement>('.coordinates')!;
  }

  it('renders the coordinate text', async () => {
    const element = await tooltipFixture({ text: '10,12' });

    expect(coordinates(element).textContent?.trim()).to.equal('(10,12)');
  });

  it('reflects hidden and invalid state as classes', async () => {
    const element = await tooltipFixture({ tooltipHidden: true, invalid: true });

    expect(coordinates(element).classList.contains('hidden')).to.be.true;
    expect(coordinates(element).classList.contains('invalid')).to.be.true;
  });

  it('positions itself after pointer movement', async () => {
    const element = await tooltipFixture();

    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 30 }),
    );

    expect(coordinates(element).style.left).to.equal('36px');
    expect(coordinates(element).style.top).to.equal('30px');
  });

  it('positions itself after click', async () => {
    const element = await tooltipFixture();

    window.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 50 }));

    expect(coordinates(element).style.left).to.equal('56px');
    expect(coordinates(element).style.top).to.equal('50px');
  });
});
