import { expect } from '@open-wc/testing';
import { transformerWindingMeasures } from './transformer.js';
import { createSCLDoc } from '../test-helpers.js';
describe('transformer', () => {
    describe('transformerWindingMeasures', () => {
        describe('single winding - default kind', () => {
            it('returns center, size, and terminal positions', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center).to.deep.equal([5.5, 3.5]);
                expect(result.size).to.equal(0.7);
                expect(result.terminals.N1).to.not.be.undefined;
                expect(result.terminals.N2).to.not.be.undefined;
            });
            it('provides arc geometry for single default winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.arc).to.not.be.undefined;
                expect(result.arc.from).to.not.be.undefined;
                expect(result.arc.to).to.not.be.undefined;
            });
            it('provides T1 terminal when no terminal element exists', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.terminals.T1).to.not.be.undefined;
                expect(result.terminals.T2).to.not.be.undefined;
            });
            it('omits T1 terminal when terminal element T1 exists', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1">
                    <Terminal name="T1" connectivityNode="S1/V1/B1/L1"/>
                  </TransformerWinding>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.terminals.T1).to.be.undefined;
            });
        });
        describe('single winding - earthing kind', () => {
            it('provides N1 terminal and no arc', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'earthing', flip: false }, '');
                expect(result.terminals.N1).to.not.be.undefined;
                expect(result.arc).to.be.undefined;
                expect(result.zigZagTransform).to.equal('');
            });
            it('provides grounded N1 when neutral is grounded', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1">
                    <NeutralPoint name="N1" cNodeName="grounded"/>
                  </TransformerWinding>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'earthing', flip: false }, '');
                expect(result.grounded.N1).to.not.be.undefined;
                expect(result.grounded.N1).to.have.length(2);
            });
        });
        describe('two windings - default kind', () => {
            it('returns measures for first winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[0];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center).to.deep.equal([5.5, 3.5]);
                expect(result.terminals.T1).to.not.be.undefined;
            });
            it('shifts center for second winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[1];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center).to.deep.equal([5.5, 4.5]);
            });
        });
        describe('two windings - auto kind', () => {
            it('returns arc for first winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[0];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'auto', flip: false }, '');
                expect(result.arc).to.not.be.undefined;
            });
            it('returns T1 terminal for second winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[1];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'auto', flip: false }, '');
                expect(result.terminals.T1).to.not.be.undefined;
            });
        });
        describe('three windings', () => {
            it('returns measures for the first winding', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                  <TransformerWinding name="W3"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[0];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center).to.deep.equal([5.5, 3.5]);
                expect(result.terminals.T1).to.not.be.undefined;
            });
            it('offsets second winding center', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                  <TransformerWinding name="W3"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[1];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center[0]).to.equal(6);
                expect(result.center[1]).to.equal(4.5);
            });
            it('offsets third winding center', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                  <TransformerWinding name="W2"/>
                  <TransformerWinding name="W3"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelectorAll('TransformerWinding')[2];
                const result = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                expect(result.center[0]).to.equal(5);
                expect(result.center[1]).to.equal(4.5);
            });
        });
        describe('rotation', () => {
            it('adjusts terminal positions based on rotation', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const rot0 = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                const rot1 = transformerWindingMeasures(winding, [5, 3], { rot: 1, kind: 'default', flip: false }, '');
                expect(rot0.terminals.N1).to.not.deep.equal(rot1.terminals.N1);
            });
        });
        describe('flip', () => {
            it('inverts terminal positions when flipped', () => {
                const doc = createSCLDoc(`
          <Substation name="S1">
            <VoltageLevel name="V1">
              <Bay name="B1">
                <PowerTransformer name="T1">
                  <TransformerWinding name="W1"/>
                </PowerTransformer>
              </Bay>
            </VoltageLevel>
          </Substation>
        `);
                const winding = doc.querySelector('TransformerWinding');
                const noFlip = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: false }, '');
                const flipped = transformerWindingMeasures(winding, [5, 3], { rot: 0, kind: 'default', flip: true }, '');
                expect(noFlip.terminals.T1).to.not.deep.equal(flipped.terminals.T1);
            });
        });
    });
});
//# sourceMappingURL=transformer.spec.js.map