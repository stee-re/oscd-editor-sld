import { expect } from '@open-wc/testing';

import {
  idle,
  placing,
  placingLabel,
  resizingBR,
  resizingTL,
  connectingFrom,
} from './interaction-mode.js';
import { createSCLDoc } from '../test-helpers.js';

describe('interaction-mode constructors', () => {
  const doc = createSCLDoc(`
    <Substation name="S1">
      <VoltageLevel name="V1">
        <Bay name="B1">
          <ConductingEquipment name="QA1" type="CBR"/>
        </Bay>
      </VoltageLevel>
    </Substation>
  `);
  const element = doc.querySelector('ConductingEquipment')!;

  it('idle() builds the idle variant with no payload', () => {
    expect(idle()).to.deep.equal({ mode: 'idle' });
  });

  it('placing() carries the element and offset', () => {
    expect(placing(element, [3, 4])).to.deep.equal({
      mode: 'placing',
      element,
      offset: [3, 4],
    });
  });

  it('placingLabel() carries the element and offset', () => {
    expect(placingLabel(element, [2, 5])).to.deep.equal({
      mode: 'placingLabel',
      element,
      offset: [2, 5],
    });
  });

  it('resizingBR() carries only the element', () => {
    expect(resizingBR(element)).to.deep.equal({
      mode: 'resizingBR',
      element,
    });
  });

  it('resizingTL() carries only the element', () => {
    expect(resizingTL(element)).to.deep.equal({
      mode: 'resizingTL',
      element,
    });
  });

  it('connectingFrom() carries element, terminal and an empty path by default', () => {
    expect(connectingFrom(element, 'T1')).to.deep.equal({
      mode: 'connectingFrom',
      element,
      terminal: 'T1',
      path: [],
    });
  });

  it('connectingFrom() accepts an initial path', () => {
    expect(connectingFrom(element, 'N2', [[1, 1]])).to.deep.equal({
      mode: 'connectingFrom',
      element,
      terminal: 'N2',
      path: [[1, 1]],
    });
  });
});
