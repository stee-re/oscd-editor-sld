import { expect } from '@open-wc/testing';
import { nothing } from 'lit';
import { identity } from '@openscd/scl-lib';

import { renderLabel } from './label.js';
import { makeArtifactContext, renderToSvg } from './test-context.js';
import { createSCLDoc } from '../../test-helpers.js';

function labelDoc() {
  return createSCLDoc(`
    <Substation name="S1">
      <Private type="OpenSCD-SLD-Layout">
        <smth:SLDAttributes smth:w="50" smth:h="25"/>
      </Private>
      <VoltageLevel name="V1">
        <Private type="OpenSCD-SLD-Layout">
          <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="20" smth:h="20"/>
        </Private>
        <Bay name="B1">
          <Private type="OpenSCD-SLD-Layout">
            <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="10" smth:h="10"/>
          </Private>
          <ConductingEquipment name="QA1" type="CBR">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="3" smth:y="3"/>
            </Private>
            <Text>Hello</Text>
          </ConductingEquipment>
        </Bay>
      </VoltageLevel>
    </Substation>
  `);
}

describe('renderLabel', () => {
  let doc: XMLDocument;
  let equipment: Element;
  let text: Element;
  let substation: Element;

  beforeEach(() => {
    doc = labelDoc();
    equipment = doc.querySelector('ConductingEquipment')!;
    text = doc.querySelector('Text')!;
    substation = doc.querySelector('Substation')!;
  });

  it('returns nothing when labels are hidden', () => {
    const context = makeArtifactContext({
      substation,
      view: { showLabels: false, showIeds: true },
    });
    expect(renderLabel(equipment, context)).to.equal(nothing);
  });

  it('renders the element name as label text', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderLabel(equipment, context));
    const label = host.querySelector('g.label text');
    expect(label).to.not.be.null;
    expect(label!.textContent).to.contain('QA1');
  });

  it('renders Text element content as tspans', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderLabel(text, context));
    expect(host.querySelector('g.label tspan')).to.not.be.null;
  });

  it('starts label placement on click when idle', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderLabel(equipment, context));
    host
      .querySelector('g.label text')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const event = context.dispatched.find(
      e => e.type === 'oscd-sld-start-place-label',
    ) as CustomEvent;
    expect(event).to.not.be.undefined;
    expect(event.detail.element).to.equal(equipment);
  });

  it('selects on click when disabled and selectable', () => {
    const context = makeArtifactContext({
      disabled: true,
      selectable: [`${identity(equipment)}`],
      substation,
    });
    const host = renderToSvg(renderLabel(equipment, context));
    host
      .querySelector('g.label text')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(context.dispatched.map(e => e.type)).to.include('oscd-sld-selected');
  });

  it('opens an edit dialog on middle-click of a Text label', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderLabel(text, context));
    host
      .querySelector('g.label text')!
      .dispatchEvent(new MouseEvent('auxclick', { button: 1, bubbles: true }));
    expect(context.dispatched.map(e => e.type)).to.include('oscd-sld-edit-scl');
  });
});
