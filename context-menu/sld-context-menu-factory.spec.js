import { expect } from '@open-wc/testing';
import { createContextMenuItems } from './sld-context-menu-factory.js';
import { createSCLDoc } from '../test-helpers.js';
import { sldNs } from '../foundations.js';
function actions(items) {
    return items.filter((i) => !('type' in i) || i.type === 'action');
}
function headlines(items) {
    return actions(items).map(i => i.headline);
}
function makeContext(element, overrides = {}) {
    return {
        element,
        x: 100,
        y: 100,
        gridX: 5,
        gridY: 5,
        doc: element.ownerDocument,
        nsp: 'smth',
        dispatch: () => { },
        ...overrides,
    };
}
describe('sld-context-menu-factory', () => {
    describe('ConductingEquipment', () => {
        it('returns standard equipment menu items', () => {
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
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            const labels = headlines(items);
            expect(labels).to.include('Mirror');
            expect(labels).to.include('Rotate');
            expect(labels).to.include('Copy');
            expect(labels).to.include('Move');
            expect(labels).to.include('Move Label');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete');
        });
        it('includes connect options when no terminal connected', () => {
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
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            const labels = headlines(items);
            expect(labels.some(l => l.startsWith('Connect'))).to.be.true;
            expect(labels.some(l => l.startsWith('Ground'))).to.be.true;
        });
        it('includes disconnect when terminal is present', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Terminal name="T1" connectivityNode="S1/V1/B1/L1"/>
              </ConductingEquipment>
              <ConnectivityNode name="L1" pathName="S1/V1/B1/L1"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            const labels = headlines(items);
            expect(labels.some(l => l.startsWith('Detach'))).to.be.true;
        });
        it('offers Add Text when no Text child exists', () => {
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
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            expect(headlines(items)).to.include('Add Text');
        });
        it('offers Remove Text when Text child exists', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>Label</Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            expect(headlines(items)).to.include('Remove Text');
        });
        it('does not offer bottom connect for single-terminal equipment', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="G1" type="GEN">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const eq = doc.querySelector('ConductingEquipment');
            const items = createContextMenuItems(makeContext(eq));
            const labels = headlines(items);
            const connectLabels = labels.filter(l => l.startsWith('Connect'));
            // Single-terminal (GEN): only top connect, no bottom
            expect(connectLabels.length).to.equal(1);
        });
        it('dispatches events from handlers', () => {
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
            const eq = doc.querySelector('ConductingEquipment');
            const dispatched = [];
            const ctx = makeContext(eq, { dispatch: e => dispatched.push(e) });
            const items = createContextMenuItems(ctx);
            const rotateAction = actions(items).find(i => i.headline === 'Rotate');
            rotateAction.handler();
            expect(dispatched.length).to.equal(1);
        });
    });
    describe('PowerTransformer', () => {
        it('returns standard transformer menu items', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1"/>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const pt = doc.querySelector('PowerTransformer');
            const items = createContextMenuItems(makeContext(pt));
            const labels = headlines(items);
            expect(labels).to.include('Rotate');
            expect(labels).to.include('Copy');
            expect(labels).to.include('Move');
            expect(labels).to.include('Move Label');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete');
        });
        it('includes Mirror for auto kind', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:kind="auto"/>
                </Private>
                <TransformerWinding name="W1"/>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const pt = doc.querySelector('PowerTransformer');
            const items = createContextMenuItems(makeContext(pt));
            expect(headlines(items)).to.include('Mirror');
        });
        it('includes Mirror for earthing kind with 2 windings', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:kind="earthing"/>
                </Private>
                <TransformerWinding name="W1"/>
                <TransformerWinding name="W2"/>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const pt = doc.querySelector('PowerTransformer');
            const items = createContextMenuItems(makeContext(pt));
            expect(headlines(items)).to.include('Mirror');
        });
        it('excludes Mirror for default kind', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1"/>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const pt = doc.querySelector('PowerTransformer');
            const items = createContextMenuItems(makeContext(pt));
            expect(headlines(items)).to.not.include('Mirror');
        });
    });
    describe('TransformerWinding', () => {
        it('returns winding items followed by transformer items', () => {
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
                </TransformerWinding>
              </PowerTransformer>
              <ConnectivityNode name="L1" pathName="S1/V1/B1/L1"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const winding = doc.querySelector('TransformerWinding');
            const items = createContextMenuItems(makeContext(winding));
            const labels = headlines(items);
            expect(labels).to.include('Detach Terminal');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Rotate');
        });
        it('includes Add Tap Changer when none exists', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1"/>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const winding = doc.querySelector('TransformerWinding');
            const items = createContextMenuItems(makeContext(winding));
            expect(headlines(items)).to.include('Add Tap Changer');
        });
        it('includes Remove/Edit Tap Changer when one exists', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1">
                  <TapChanger name="LTC" type="LTC"/>
                </TransformerWinding>
              </PowerTransformer>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const winding = doc.querySelector('TransformerWinding');
            const items = createContextMenuItems(makeContext(winding));
            const labels = headlines(items);
            expect(labels).to.include('Remove Tap Changer');
            expect(labels).to.include('Edit Tap Changer');
            expect(labels).to.not.include('Add Tap Changer');
        });
        it('includes Detach Neutral Point when present', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <PowerTransformer name="T1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <TransformerWinding name="W1">
                  <NeutralPoint name="N1" connectivityNode="S1/V1/B1/L1"/>
                </TransformerWinding>
              </PowerTransformer>
              <ConnectivityNode name="L1" pathName="S1/V1/B1/L1"/>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const winding = doc.querySelector('TransformerWinding');
            const items = createContextMenuItems(makeContext(winding));
            expect(headlines(items)).to.include('Detach Neutral Point');
        });
    });
    describe('Bay (busbar)', () => {
        it('returns busbar menu items', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="BB1">
              <ConnectivityNode name="L1" pathName="S1/V1/BB1/L1">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:Section smth:bus="true">
                    <smth:Vertex smth:x="1" smth:y="1"/>
                    <smth:Vertex smth:x="5" smth:y="1"/>
                  </smth:Section>
                </Private>
              </ConnectivityNode>
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="5" smth:h="1"/>
              </Private>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const bay = doc.querySelector('Bay');
            const items = createContextMenuItems(makeContext(bay));
            const labels = headlines(items);
            expect(labels).to.include('Resize');
            expect(labels).to.include('Move');
            expect(labels).to.include('Move Label');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete');
            expect(labels).to.not.include('Copy');
        });
    });
    describe('Bay / VoltageLevel (container)', () => {
        it('returns container menu items for Bay', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <Private type="OpenSCD-SLD-Layout">
                <smth:SLDAttributes smth:x="2" smth:y="2" smth:w="5" smth:h="5"/>
              </Private>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const bay = doc.querySelector('Bay');
            const items = createContextMenuItems(makeContext(bay));
            const labels = headlines(items);
            expect(labels).to.include('Resize');
            expect(labels).to.include('Copy');
            expect(labels).to.include('Move');
            expect(labels).to.include('Move Label');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete');
        });
        it('returns container menu items for VoltageLevel', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Private type="OpenSCD-SLD-Layout">
              <smth:SLDAttributes smth:x="1" smth:y="1" smth:w="20" smth:h="15"/>
            </Private>
          </VoltageLevel>
        </Substation>
      `);
            const vl = doc.querySelector('VoltageLevel');
            const items = createContextMenuItems(makeContext(vl));
            const labels = headlines(items);
            expect(labels).to.include('Resize');
            expect(labels).to.include('Copy');
            expect(labels).to.include('Move');
            expect(labels).to.include('Delete');
        });
    });
    describe('IED reference', () => {
        it('returns IED menu items', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <Private type="OpenSCD-SLD-Layout">
            <smth:SLDAttributes smth:x="0" smth:y="0" smth:w="50" smth:h="25"/>
            <smth:Reference smth:type="IED" smth:id="IED1" smth:iedName="IED1">
              <smth:SLDAttributes smth:x="5" smth:y="5" smth:w="1" smth:h="1"/>
            </smth:Reference>
          </Private>
        </Substation>
        <IED name="IED1"/>
      `);
            const ref = doc.getElementsByTagNameNS(sldNs, 'Reference')[0];
            const items = createContextMenuItems(makeContext(ref));
            const labels = headlines(items);
            expect(labels).to.include('Move');
            expect(labels).to.include('Move Label');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete IED');
            expect(labels).to.include('Remove from SLD');
        });
        it('excludes Edit and Delete IED when IED is unresolved', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <Private type="OpenSCD-SLD-Layout">
            <smth:SLDAttributes smth:x="0" smth:y="0" smth:w="50" smth:h="25"/>
            <smth:Reference smth:type="IED" smth:id="MISSING" smth:iedName="MISSING">
              <smth:SLDAttributes smth:x="5" smth:y="5" smth:w="1" smth:h="1"/>
            </smth:Reference>
          </Private>
        </Substation>
      `);
            const ref = doc.getElementsByTagNameNS(sldNs, 'Reference')[0];
            const items = createContextMenuItems(makeContext(ref));
            const labels = headlines(items);
            expect(labels).to.include('Move');
            expect(labels).to.include('Remove from SLD');
            expect(labels).to.not.include('Edit');
            expect(labels).to.not.include('Delete IED');
        });
    });
    describe('Text', () => {
        it('returns text menu items', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>Label</Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const text = doc.querySelector('Text');
            const items = createContextMenuItems(makeContext(text));
            const labels = headlines(items);
            expect(labels).to.include('Rotate');
            expect(labels).to.include('Move');
            expect(labels).to.include('Edit');
            expect(labels).to.include('Delete');
        });
        it('includes color options when not already that color', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>
                  <Private type="OpenSCD-SLD-Layout">
                    <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                  </Private>
                  Label
                </Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const text = doc.querySelector('Text');
            const items = createContextMenuItems(makeContext(text));
            const labels = headlines(items);
            expect(labels).to.include('Red');
            expect(labels).to.include('Blue');
            expect(labels).to.not.include('Reset Color');
        });
        it('includes Reset Color when color is set', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>
                  <Private type="OpenSCD-SLD-Layout">
                    <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:color="#BB1326"/>
                  </Private>
                  Label
                </Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const text = doc.querySelector('Text');
            const items = createContextMenuItems(makeContext(text));
            const labels = headlines(items);
            expect(labels).to.include('Reset Color');
            expect(labels).to.not.include('Red');
            expect(labels).to.include('Blue');
        });
        it('includes Bold when weight is not 500', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>
                  <Private type="OpenSCD-SLD-Layout">
                    <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                  </Private>
                  Label
                </Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const text = doc.querySelector('Text');
            const items = createContextMenuItems(makeContext(text));
            const labels = headlines(items);
            expect(labels).to.include('Bold');
            expect(labels).to.not.include('Remove Formatting');
        });
        it('includes Remove Formatting when weight is 500', () => {
            const doc = createSCLDoc(`
        <Substation name="S1">
          <VoltageLevel name="V1">
            <Bay name="B1">
              <ConductingEquipment name="Q1" type="CBR">
                <Private type="OpenSCD-SLD-Layout">
                  <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1"/>
                </Private>
                <Text>
                  <Private type="OpenSCD-SLD-Layout">
                    <smth:SLDAttributes smth:x="3" smth:y="3" smth:w="1" smth:h="1" smth:weight="500"/>
                  </Private>
                  Label
                </Text>
              </ConductingEquipment>
            </Bay>
          </VoltageLevel>
        </Substation>
      `);
            const text = doc.querySelector('Text');
            const items = createContextMenuItems(makeContext(text));
            const labels = headlines(items);
            expect(labels).to.include('Remove Formatting');
            expect(labels).to.not.include('Bold');
        });
    });
});
//# sourceMappingURL=sld-context-menu-factory.spec.js.map