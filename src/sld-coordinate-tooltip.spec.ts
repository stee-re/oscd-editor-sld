import { fixture, expect } from '@open-wc/testing';
import { html } from 'lit';

import { SldCoordinateTooltip } from './sld-coordinate-tooltip.js';
import * as interactions from './foundations/interaction-mode.js';
import { sldFixture } from './test-helpers.js';

import type { InteractionState } from './foundations/interaction-mode.js';

customElements.define('sld-coordinate-tooltip', SldCoordinateTooltip);

describe('sld-coordinate-tooltip', () => {
  function scl() {
    const doc = sldFixture({ bay: { x: 2, y: 2, w: 10, h: 10 } });
    return {
      substation: doc.querySelector('Substation')!,
      bay: doc.querySelector('Bay')!,
    };
  }

  async function tooltipFixture(
    props: Partial<{
      interaction: InteractionState;
      substationOf: (surface: Element) => Element | undefined;
    }> = {},
  ) {
    return fixture<SldCoordinateTooltip>(html`<sld-coordinate-tooltip
      .interaction=${props.interaction ?? interactions.idle()}
      .substationOf=${props.substationOf}
    ></sld-coordinate-tooltip>`);
  }

  function coordinates(element: SldCoordinateTooltip): HTMLElement {
    return element.shadowRoot!.querySelector<HTMLElement>('.coordinates')!;
  }

  function pointerMove(target: EventTarget, clientX: number, clientY: number) {
    target.dispatchEvent(
      new PointerEvent('pointermove', {
        clientX,
        clientY,
        bubbles: true,
        composed: true,
      }),
    );
  }

  it('positions itself after pointer movement', async () => {
    const element = await tooltipFixture();

    pointerMove(window, 20, 30);

    expect(coordinates(element).style.left).to.equal('36px');
    expect(coordinates(element).style.top).to.equal('30px');
  });

  it('positions itself after click', async () => {
    const element = await tooltipFixture();

    window.dispatchEvent(new MouseEvent('click', { clientX: 40, clientY: 50 }));

    expect(coordinates(element).style.left).to.equal('56px');
    expect(coordinates(element).style.top).to.equal('50px');
  });

  it('stays hidden while no substation surface is under the cursor', async () => {
    const element = await tooltipFixture({ substationOf: () => undefined });

    pointerMove(window, 5, 6);

    expect(coordinates(element).classList.contains('hidden')).to.be.true;
  });

  describe('with a substation surface under the cursor', () => {
    let svg: SVGGraphicsElement;
    let substation: Element;
    let bay: Element;

    // getScreenCTM returns this one instance (a stable getter, not a per-call
    // factory); its translation forces gridCoordinates to invert a real offset
    // rather than echo the client position.
    const screenCTM = new DOMMatrix().translate(10, 20);

    const substationOf = (candidate: Element) =>
      candidate === svg ? substation : undefined;

    beforeEach(() => {
      ({ substation, bay } = scl());
      svg = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg',
      ) as SVGSVGElement;
      svg.id = 'sld';
      svg.getScreenCTM = () => screenCTM;
      document.body.append(svg);
    });

    afterEach(() => svg.remove());

    it('shows placement coordinates for the surface under the cursor', async () => {
      const element = await tooltipFixture({
        interaction: interactions.placing(bay, [2, 1]),
        substationOf,
      });

      // client (17,26) − CTM offset (10,20) = grid (7,6); − placingOffset (2,1) = (5,5)
      pointerMove(svg, 17, 26);
      await element.updateComplete;

      expect(coordinates(element).classList.contains('hidden')).to.be.false;
      expect(coordinates(element).textContent?.trim()).to.equal('(5,5)');
    });

    it('marks placement outside the substation invalid', async () => {
      const element = await tooltipFixture({
        interaction: interactions.placing(bay, [0, 0]),
        substationOf,
      });

      // client (70,26) − CTM offset (10,20) = grid (60,6), outside the 50-wide substation
      pointerMove(svg, 70, 26);
      await element.updateComplete;

      expect(coordinates(element).classList.contains('invalid')).to.be.true;
    });
  });
});
