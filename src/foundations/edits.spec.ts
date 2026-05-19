import { expect } from '@open-wc/testing';

import {
  copyElementForPlacement,
  createGroundTerminalEdits,
  createFlipElementEdits,
  createAddTextEdit,
  createDeleteBusBarEdits,
  createDeleteContainerEdits,
} from './edits.js';
import { sldNs } from '../foundations.js';
import { createSCLDoc } from '../test-helpers.js';

describe('edits', () => {
  describe('copyElementForPlacement', () => {
    it('returns a deep clone of the element', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="10" smth:h="10"/>
            </Private>
            <Bay name="B1">
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="5" smth:h="5"/>
              </Private>
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const vl = doc.querySelector('VoltageLevel')!;
      const clone = copyElementForPlacement(vl, 'smth');
      expect(clone.tagName).to.equal('VoltageLevel');
      expect(clone.getAttribute('name')).to.equal('V1');
      expect(clone.querySelector('Bay')).to.not.be.null;
      expect(clone).to.not.equal(vl);
    });

    it('removes IED references from Bay/VoltageLevel clones', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="10" smth:h="10"/>
              <smth:Reference smth:type="IED" smth:id="IED1">
                <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="1" smth:h="1"/>
              </smth:Reference>
            </Private>
          </VoltageLevel>
        </Substation>
      `);
      const vl = doc.querySelector('VoltageLevel')!;
      const clone = copyElementForPlacement(vl, 'smth');
      const refs = clone.getElementsByTagNameNS(sldNs, 'Reference');
      expect(refs).to.have.length(0);
    });
  });

  describe('createGroundTerminalEdits', () => {
    it('creates edits for grounding a terminal', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createGroundTerminalEdits(eq, 'T1');
      expect(edits).to.not.be.null;
      expect(edits!.length).to.be.greaterThan(0);
    });

    it('creates a ConnectivityNode named "grounded" if not present', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createGroundTerminalEdits(eq, 'N1')!;
      const insertEdits = edits.filter(
        (e): e is { parent: Element; node: Element; reference: Element | null } =>
          'parent' in e && 'node' in e,
      );
      const cNodeInsert = insertEdits.find(
        e => (e.node as Element).tagName === 'ConnectivityNode',
      );
      expect(cNodeInsert).to.not.be.undefined;
      expect(cNodeInsert!.node.getAttribute('name')).to.equal('grounded');
    });

    it('reuses existing grounded ConnectivityNode', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
              <ConnectivityNode name="grounded" pathName="S1/V1/B1/grounded"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createGroundTerminalEdits(eq, 'T1')!;
      const insertEdits = edits.filter(
        (e): e is { parent: Element; node: Element; reference: Element | null } =>
          'parent' in e && 'node' in e,
      );
      const cNodeInsert = insertEdits.find(
        e => (e.node as Element).tagName === 'ConnectivityNode',
      );
      expect(cNodeInsert).to.be.undefined;
    });

    it('creates a NeutralPoint for N-prefixed terminals', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createGroundTerminalEdits(eq, 'N1')!;
      const insertEdits = edits.filter(
        (e): e is { parent: Element; node: Element; reference: Element | null } =>
          'parent' in e && 'node' in e,
      );
      const npInsert = insertEdits.find(
        e => (e.node as Element).tagName === 'NeutralPoint',
      );
      expect(npInsert).to.not.be.undefined;
    });

    it('returns null when equipment has no Bay parent', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <ConductingEquipment name="Q1" type="CBR"/>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      expect(createGroundTerminalEdits(eq, 'T1')).to.be.null;
    });
  });

  describe('createFlipElementEdits', () => {
    it('returns edit to toggle flip attribute', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createFlipElementEdits(eq, 'smth');
      expect(edits.length).to.be.greaterThan(0);
    });

    it('sets flip to "true" when currently not flipped', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createFlipElementEdits(eq, 'smth');
      const updateEdit = edits[0] as { attributesNS: Record<string, Record<string, string | null>> };
      const nsAttrs = updateEdit.attributesNS[sldNs];
      expect(nsAttrs[`smth:flip`]).to.equal('true');
    });

    it('removes flip when currently flipped', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:flip="true"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edits = createFlipElementEdits(eq, 'smth');
      const updateEdit = edits[0] as { attributesNS: Record<string, Record<string, string | null>> };
      const nsAttrs = updateEdit.attributesNS[sldNs];
      expect(nsAttrs[`smth:flip`]).to.be.null;
    });

    it('also removes first winding terminals for PowerTransformer', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1">
                  <Terminal name="T1" connectivityNode="S1/V1/B1/L1"/>
                  <Terminal name="T2" connectivityNode="S1/V1/B1/L1"/>
                </TransformerWinding>
                <TransformerWinding name="W2">
                  <Terminal name="T1" connectivityNode="S1/V1/B1/L1"/>
                </TransformerWinding>
              </PowerTransformer>
              <ConnectivityNode name="L1" pathName="S1/V1/B1/L1"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const pt = doc.querySelector('PowerTransformer')!;
      const edits = createFlipElementEdits(pt, 'smth');
      expect(edits.length).to.be.greaterThan(1);
      const nodeEdits = edits.filter(
        e => 'node' in e && (e as { node: Node }).node instanceof Element,
      );
      expect(nodeEdits.length).to.be.greaterThan(0);
    });

    it('also removes NeutralPoints for earthing transformers', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:kind="earthing"/>
                </Private>
                <TransformerWinding name="W1">
                  <Terminal name="T1" connectivityNode="S1/V1/B1/L1"/>
                  <NeutralPoint name="N1" connectivityNode="S1/V1/B1/L1"/>
                </TransformerWinding>
              </PowerTransformer>
              <ConnectivityNode name="L1" pathName="S1/V1/B1/L1"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const pt = doc.querySelector('PowerTransformer')!;
      const edits = createFlipElementEdits(pt, 'smth');
      expect(edits.length).to.be.greaterThan(1);
    });
  });

  describe('createAddTextEdit', () => {
    it('creates a Text element with label position', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="5" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const eq = doc.querySelector('ConductingEquipment')!;
      const edit = createAddTextEdit(eq, 'smth') as {
        node: Element;
        parent: Element;
        reference: Element | null;
      };
      expect(edit.node.tagName).to.equal('Text');
      expect(edit.parent).to.equal(eq);
    });
  });

  describe('createDeleteBusBarEdits', () => {
    it('removes the connectivity node and the bay', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="BB1">
              <ConnectivityNode name="L" pathName="S1/V1/BB1/L">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:Section smth:bus="true">
                    <smth:Vertex smth:x="0.5" smth:y="0.5"/>
                    <smth:Vertex smth:x="1.5" smth:y="0.5"/>
                  </smth:Section>
                </Private>
              </ConnectivityNode>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const bay = doc.querySelector('Bay')!;
      const edits = createDeleteBusBarEdits(bay);
      expect(edits.length).to.be.greaterThan(1);
      const removedNodes = edits
        .filter((e): e is { node: Element } => 'node' in e && !('parent' in e))
        .map(e => e.node);
      expect(removedNodes).to.include(bay);
    });
  });

  describe('createDeleteContainerEdits', () => {
    it('removes the container element', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="10" smth:h="10"/>
            </Private>
            <Bay name="B1">
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="5" smth:h="5"/>
              </Private>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const vl = doc.querySelector('VoltageLevel')!;
      const edits = createDeleteContainerEdits(vl);
      const removedNodes = edits
        .filter((e): e is { node: Element } => 'node' in e && !('parent' in e))
        .map(e => e.node);
      expect(removedNodes).to.include(vl);
    });

    it('removes foreign connectivity nodes when terminals reference external nodes', () => {
      const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="20" smth:h="20"/>
            </Private>
            <Bay name="B1">
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="5" smth:h="5"/>
              </Private>
              <ConductingEquipment name="Q1" type="CBR">
                <Terminal name="T1" connectivityNode="S1/V1/B2/L1"/>
              </ConductingEquipment>
            </Bay>
            <Bay name="B2">
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="10" smth:y="2" smth:w="5" smth:h="5"/>
              </Private>
              <ConnectivityNode name="L1" pathName="S1/V1/B2/L1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:Section>
                    <smth:Vertex smth:x="0.5" smth:y="0.5"/>
                  </smth:Section>
                </Private>
              </ConnectivityNode>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
      const b1 = doc.querySelector('Bay[name="B1"]')!;
      const edits = createDeleteContainerEdits(b1);
      expect(edits.length).to.be.greaterThan(1);
    });
  });
});
