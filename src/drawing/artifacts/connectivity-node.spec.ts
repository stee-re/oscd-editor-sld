import { expect } from '@open-wc/testing';
import { nothing } from 'lit';

import { renderConnectivityNode } from './connectivity-node.js';
import { makeArtifactContext, renderToSvg } from './test-context.js';
import { createSCLDoc } from '../../test-helpers.js';

function busBarNodeDoc() {
  return createSCLDoc(`
    <Substation name="S1">
      <Private type="OpenSCD-SLD-Layout">
        <smth:SLDAttributes smth:w="50" smth:h="25"/>
      </Private>
      <VoltageLevel name="V1">
        <Private type="OpenSCD-SLD-Layout">
          <smth:SLDAttributes smth:x="0" smth:y="0" smth:w="20" smth:h="20"/>
        </Private>
        <Bay name="BB1">
          <Private type="OpenSCD-SLD-Layout">
            <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="4" smth:h="1"/>
          </Private>
          <ConnectivityNode name="L" pathName="S1/V1/BB1/L">
            <Private type="OpenSCD-SLD-Layout">
              <smth:Section smth:bus="true">
                <smth:Vertex smth:x="2.5" smth:y="2.5"/>
                <smth:Vertex smth:x="5.5" smth:y="2.5"/>
              </smth:Section>
            </Private>
          </ConnectivityNode>
        </Bay>
      </VoltageLevel>
    </Substation>
  `);
}

describe('renderConnectivityNode', () => {
  let doc: XMLDocument;
  let cNode: Element;
  let bay: Element;
  let substation: Element;

  beforeEach(() => {
    doc = busBarNodeDoc();
    cNode = doc.querySelector('ConnectivityNode')!;
    bay = doc.querySelector('Bay')!;
    substation = doc.querySelector('Substation')!;
  });

  it('returns nothing for a node without a layout private', () => {
    const orphan = doc.createElement('ConnectivityNode');
    const context = makeArtifactContext({ substation });
    expect(renderConnectivityNode(orphan, context)).to.equal(nothing);
  });

  it('renders a node group with section lines and the path name', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderConnectivityNode(cNode, context));
    expect(host.querySelector('g.node')).to.not.be.null;
    expect(host.querySelector('g.node title')!.textContent).to.equal(
      'S1/V1/BB1/L',
    );
    expect(host.querySelectorAll('g.node line').length).to.be.greaterThan(0);
  });

  it('uses the node identity as id within the substation', () => {
    const context = makeArtifactContext({ substation });
    const host = renderToSvg(renderConnectivityNode(cNode, context));
    expect(host.querySelector('g.node')!.getAttribute('id')).to.not.be.empty;
  });

  describe('busbar interactions', () => {
    function interactiveLine(context = makeArtifactContext({ substation })) {
      const host = renderToSvg(renderConnectivityNode(cNode, context));
      return host.querySelectorAll('g.node line')[1];
    }

    it('starts placement of the bay on click', () => {
      const context = makeArtifactContext({ substation });
      interactiveLine(context).dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-start-place',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail.element).to.equal(bay);
    });

    it('starts a bottom-right resize on middle-button auxclick', () => {
      const context = makeArtifactContext({ substation });
      interactiveLine(context).dispatchEvent(
        new MouseEvent('auxclick', { button: 1, bubbles: true }),
      );
      const event = context.dispatched.find(
        e => e.type === 'oscd-sld-start-resize-br',
      ) as CustomEvent;
      expect(event).to.not.be.undefined;
      expect(event.detail).to.equal(bay);
    });

    it('opens the context menu for the bay when idle', () => {
      const context = makeArtifactContext({ substation });
      interactiveLine(context).dispatchEvent(
        new MouseEvent('contextmenu', { bubbles: true }),
      );
      expect(context.contextMenuOpened).to.have.lengthOf(1);
      expect(context.contextMenuOpened[0].element).to.equal(bay);
    });

    it('does not act on a disabled node', () => {
      const context = makeArtifactContext({ disabled: true, substation });
      const line = interactiveLine(context);
      line.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      line.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      expect(context.dispatched).to.have.lengthOf(0);
      expect(context.contextMenuOpened).to.have.lengthOf(0);
    });
  });
});
