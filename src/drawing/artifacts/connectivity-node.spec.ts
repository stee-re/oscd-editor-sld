import { expect } from '@open-wc/testing';
import { nothing } from 'lit';

import { renderConnectivityNode } from './connectivity-node.js';
import { makeArtifactContext, renderToSvg } from './test-context.js';
import { sldFixture } from '../../test-helpers.js';

function busBarNodeDoc() {
  return sldFixture({
    vl: { x: 0, y: 0 },
    bay: { w: 4, h: 1 },
    bayName: 'BB1',
    children: `
      <ConnectivityNode name="L" pathName="S1/V1/BB1/L">
        <Private type="OpenSCD-SLD-Layout">
          <smth:Section smth:bus="true">
            <smth:Vertex smth:x="2.5" smth:y="2.5"/>
            <smth:Vertex smth:x="5.5" smth:y="2.5"/>
          </smth:Section>
        </Private>
      </ConnectivityNode>`,
  });
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
