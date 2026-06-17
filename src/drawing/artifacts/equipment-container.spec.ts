import { expect } from '@open-wc/testing';
import { identity } from '@openscd/scl-lib';

import { renderVoltageLevel, renderBay } from './equipment-container.js';
import { makeArtifactContext, renderToSvg } from './test-context.js';
import { createSCLDoc } from '../../test-helpers.js';

function containerDoc() {
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
          </ConductingEquipment>
          <PowerTransformer name="T1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="5" smth:y="5"/>
            </Private>
          </PowerTransformer>
        </Bay>
      </VoltageLevel>
    </Substation>
  `);
}

describe('renderVoltageLevel / renderBay', () => {
  let doc: XMLDocument;
  let voltageLevel: Element;
  let bay: Element;
  let equipment: Element;
  let transformer: Element;
  let substation: Element;

  beforeEach(() => {
    doc = containerDoc();
    voltageLevel = doc.querySelector('VoltageLevel')!;
    bay = doc.querySelector('Bay')!;
    equipment = doc.querySelector('ConductingEquipment')!;
    transformer = doc.querySelector('PowerTransformer')!;
    substation = doc.querySelector('Substation')!;
  });

  describe('structure', () => {
    it('renders a voltagelevel group for a VoltageLevel', () => {
      const context = makeArtifactContext({ substation });
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      expect(host.querySelector('g.voltagelevel')).to.not.be.null;
      expect(host.querySelector('g.voltagelevel')!.getAttribute('id')).to.equal(
        `${identity(voltageLevel)}`,
      );
    });

    it('renders a bay group for a Bay', () => {
      const context = makeArtifactContext({ substation });
      const host = renderToSvg(renderBay(bay, context));
      expect(host.querySelector('g.bay')).to.not.be.null;
    });

    it('renders nothing while placing itself without preview', () => {
      const context = makeArtifactContext({
        placing: voltageLevel,
        substation,
      });
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      expect(host.querySelector('g')).to.be.null;
    });
  });

  describe('child composition', () => {
    it('recurses into bays and delegates equipment/transformer rendering', () => {
      const context = makeArtifactContext({ substation });
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      expect(host.querySelector('g.voltagelevel g.bay')).to.not.be.null;
      expect(context.renderedChildren).to.include(equipment);
      expect(context.renderedChildren).to.include(transformer);
    });
  });

  describe('actions', () => {
    function mainRect(context: ReturnType<typeof makeArtifactContext>) {
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      return host.querySelector('g.voltagelevel > rect')!;
    }

    it('starts placement of the container on click when idle', () => {
      const context = makeArtifactContext({ substation });
      mainRect(context).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-start-place',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail.element).to.equal(voltageLevel);
    });

    it('starts placement of a copy on shift-click', () => {
      const context = makeArtifactContext({ substation });
      mainRect(context).dispatchEvent(
        new MouseEvent('click', { shiftKey: true, bubbles: true }),
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-start-place',
      ) as CustomEvent;
      expect(event.detail.element).to.not.equal(voltageLevel);
      expect(event.detail.element.tagName).to.equal('VoltageLevel');
    });

    it('opens the context menu on right-click when idle', () => {
      const context = makeArtifactContext({ substation });
      mainRect(context).dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true }),
      );
      expect(context.contextMenuOpened).to.have.lengthOf(1);
      expect(context.contextMenuOpened[0].element).to.equal(voltageLevel);
    });

    it('does not open the context menu when disabled', () => {
      const context = makeArtifactContext({ disabled: true, substation });
      mainRect(context).dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true }),
      );
      expect(context.contextMenuOpened).to.have.lengthOf(0);
    });

    it('places into the containing voltage level while placing a bay', () => {
      const context = makeArtifactContext({ placing: bay, substation });
      const host = renderToSvg(renderBay(bay, context, true));
      host
        .querySelector('g.bay > rect')!
        .dispatchEvent(new MouseEvent('click', { bubbles: true }));
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-place',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail.element).to.equal(bay);
      expect(event.detail.parent).to.equal(voltageLevel);
    });
  });

  describe('resize handles', () => {
    it('shows two resize handles when idle and enabled', () => {
      const context = makeArtifactContext({ substation });
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      expect(
        host.querySelectorAll('g.voltagelevel > svg.handle'),
      ).to.have.lengthOf(2);
    });

    it('hides resize handles when disabled', () => {
      const context = makeArtifactContext({ disabled: true, substation });
      const host = renderToSvg(renderVoltageLevel(voltageLevel, context));
      expect(
        host.querySelectorAll('g.voltagelevel > svg.handle'),
      ).to.have.lengthOf(0);
    });
  });
});
