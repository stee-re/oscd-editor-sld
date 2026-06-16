import { expect } from '@open-wc/testing';
import { identity } from '@openscd/scl-lib';

import { powerTransformerArtifact } from './power-transformer.js';
import {
  makeArtifactContext,
  renderToSvg,
} from './test-context.js';
import { createSCLDoc } from '../../test-helpers.js';

function transformerDoc() {
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
          <PowerTransformer name="T1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="4" smth:y="4"/>
            </Private>
            <TransformerWinding name="W1"/>
            <TransformerWinding name="W2"/>
          </PowerTransformer>
        </Bay>
      </VoltageLevel>
    </Substation>
  `);
}

describe('powerTransformerArtifact', () => {
  let doc: XMLDocument;
  let transformer: Element;
  let substation: Element;

  beforeEach(() => {
    doc = transformerDoc();
    transformer = doc.querySelector('PowerTransformer')!;
    substation = doc.querySelector('Substation')!;
  });

  describe('matches', () => {
    it('matches a PowerTransformer element', () => {
      expect(powerTransformerArtifact.matches(transformer)).to.be.true;
    });

    it('does not match other elements', () => {
      expect(powerTransformerArtifact.matches(substation)).to.be.false;
    });
  });

  describe('state', () => {
    it('is undefined while placing itself without preview', () => {
      const context = makeArtifactContext({ placing: transformer, substation });
      expect(powerTransformerArtifact.state(transformer, context)).to.be
        .undefined;
    });

    it('derives position, windings and flags', () => {
      const context = makeArtifactContext({ substation });
      const state = powerTransformerArtifact.state(transformer, context)!;
      expect(state.position).to.deep.equal([4, 4]);
      expect(state.windings).to.have.lengthOf(2);
      expect(state.placingSelf).to.be.false;
      expect(state.disabled).to.be.false;
      expect(state.highlight).to.equal('');
    });

    it('marks placingSelf when previewing the placed transformer', () => {
      const context = makeArtifactContext({ placing: transformer, substation });
      const state = powerTransformerArtifact.state(transformer, context, {
        preview: true,
      })!;
      expect(state.placingSelf).to.be.true;
    });

    it('reflects selectable and disabled context', () => {
      const context = makeArtifactContext({
        disabled: true,
        selectable: [`${identity(transformer)}`],
        substation,
      });
      const state = powerTransformerArtifact.state(transformer, context)!;
      expect(state.selectable).to.be.true;
      expect(state.disabled).to.be.true;
    });

    it('provides a highlight template when highlighted', () => {
      const context = makeArtifactContext({
        highlight: [{ id: `${identity(transformer)}`, style: { fill: 'red' } }],
        substation,
      });
      const state = powerTransformerArtifact.state(transformer, context)!;
      expect(state.highlight).to.not.equal('');
    });
  });

  describe('actions', () => {
    function actionsFor(context = makeArtifactContext({ substation })) {
      const state = powerTransformerArtifact.state(transformer, context, {
        preview: true,
      })!;
      return powerTransformerArtifact.actions(transformer, context, state);
    }

    it('starts placement on click when idle', () => {
      const context = makeArtifactContext({ substation });
      (actionsFor(context).onClick as (e: MouseEvent) => void)(
        new MouseEvent('click'),
      );
      expect(context.dispatched.map(e => e.type)).to.include(
        'oscd-sld-start-place',
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-start-place',
      ) as CustomEvent;
      expect(event.detail.element).to.equal(transformer);
    });

    it('places into the containing bay when placing itself', () => {
      const context = makeArtifactContext({
        placing: transformer,
        idle: false,
        substation,
      });
      (actionsFor(context).onClick as (e: MouseEvent) => void)(
        new MouseEvent('click'),
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-place',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail.element).to.equal(transformer);
      expect(event.detail.parent).to.equal(doc.querySelector('Bay'));
    });

    it('selects when disabled and selectable', () => {
      const context = makeArtifactContext({
        disabled: true,
        selectable: [`${identity(transformer)}`],
        substation,
      });
      (actionsFor(context).onClick as (e: MouseEvent) => void)(
        new MouseEvent('click'),
      );
      expect(context.dispatched.map(e => e.type)).to.deep.equal([
        'oscd-sld-selected',
      ]);
    });

    it('rotates on middle-button auxclick', () => {
      const context = makeArtifactContext({ substation });
      actionsFor(context).onAuxClick(new MouseEvent('auxclick', { button: 1 }));
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-rotate',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail).to.equal(transformer);
    });

    it('ignores non-middle auxclick', () => {
      const context = makeArtifactContext({ substation });
      actionsFor(context).onAuxClick(new MouseEvent('auxclick', { button: 0 }));
      expect(context.dispatched).to.have.lengthOf(0);
    });
  });

  describe('render', () => {
    function renderTransformer(context = makeArtifactContext({ substation })) {
      const state = powerTransformerArtifact.state(transformer, context)!;
      const actions = powerTransformerArtifact.actions(
        transformer,
        context,
        state,
      );
      return renderToSvg(
        powerTransformerArtifact.render(
          transformer,
          state,
          actions,
          context,
        ),
      );
    }

    it('renders a transformer group with a winding per child', () => {
      const host = renderTransformer();
      expect(host.querySelector('g.transformer')).to.not.be.null;
      expect(host.querySelectorAll('g.winding')).to.have.lengthOf(2);
      expect(host.querySelector('g.winding circle')).to.not.be.null;
    });
  });
});
