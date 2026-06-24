import { expect } from '@open-wc/testing';

import { coordinateTooltipState } from './sld-coordinate-tooltip-state.js';
import { sldFixture } from './test-helpers.js';

describe('coordinateTooltipState', () => {
  function setup(children = '') {
    const doc = sldFixture({
      bay: { x: 2, y: 2, w: 10, h: 10 },
      children,
    });
    return {
      doc,
      substation: doc.querySelector('Substation')!,
      voltageLevel: doc.querySelector('VoltageLevel')!,
      bay: doc.querySelector('Bay')!,
    };
  }

  it('is hidden while idle', () => {
    const { substation } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placingOffset: [0, 0],
        mouseX: 5,
        mouseY: 6,
      }),
    ).to.deep.equal({ text: '', invalid: false, hidden: true });
  });

  it('shows placement coordinates adjusted by the placement offset', () => {
    const { substation, bay } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placing: bay,
        placingOffset: [2, 1],
        mouseX: 7,
        mouseY: 6,
      }),
    ).to.deep.equal({ text: '5,5', invalid: false, hidden: false });
  });

  it('marks placement outside the substation invalid', () => {
    const { substation, bay } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placing: bay,
        placingOffset: [0, 0],
        mouseX: 60,
        mouseY: 6,
      }),
    ).to.deep.equal({ text: '60,6', invalid: true, hidden: false });
  });

  it('shows bottom-right resize dimensions', () => {
    const { substation, voltageLevel } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placingOffset: [0, 0],
        resizingBR: voltageLevel,
        mouseX: 25,
        mouseY: 20,
      }),
    ).to.deep.equal({ text: '25×20', invalid: false, hidden: false });
  });

  it('marks bottom-right resize invalid when it would lose a child', () => {
    const { substation, voltageLevel } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placingOffset: [0, 0],
        resizingBR: voltageLevel,
        mouseX: 2,
        mouseY: 2,
      }),
    ).to.deep.equal({ text: '2×2', invalid: true, hidden: false });
  });

  it('hides bottom-right resize dimensions for busbars', () => {
    const { substation, bay } = setup(`
      <ConnectivityNode name="L">
        <Private type="OpenSCD-SLD-Layout">
          <smth:Section smth:bus="true">
            <smth:Vertex smth:x="0.5" smth:y="0.5" />
            <smth:Vertex smth:x="1.5" smth:y="0.5" />
          </smth:Section>
        </Private>
      </ConnectivityNode>
    `);

    expect(
      coordinateTooltipState({
        substation,
        placingOffset: [0, 0],
        resizingBR: bay,
        mouseX: 8,
        mouseY: 8,
      }),
    ).to.deep.equal({ text: '', invalid: false, hidden: true });
  });

  it('shows top-left resize dimensions', () => {
    const { substation, voltageLevel } = setup();

    expect(
      coordinateTooltipState({
        substation,
        placingOffset: [0, 0],
        resizingTL: voltageLevel,
        mouseX: 0,
        mouseY: 0,
      }),
    ).to.deep.equal({ text: '21×21', invalid: false, hidden: false });
  });
});
