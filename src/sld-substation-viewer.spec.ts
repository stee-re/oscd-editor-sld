import { fixture, html, expect } from '@open-wc/testing';

import { SldSubstationViewer } from './sld-substation-viewer.js';
import * as interactions from './foundations/interaction-mode.js';

customElements.define('perf-sld-substation-viewer', SldSubstationViewer);

const SLD_NS = 'https://openscd.org/SCL/SSD/SLD/v0';

/**
 * Scale of the generated substation. Kept modest by default so the spec stays a
 * few hundred milliseconds in CI; bump the grid to reproduce the "large file"
 * (1000+ equipment) numbers from `demo/sample-large.scd` locally.
 */
const VL_COLS = 6;
const VL_ROWS = 4;
const BAY_COLS = 5;
const BAY_ROWS = 4;
const EQ_PER_BAY = 4;

const BAY_W = 6;
const BAY_H = 6;
const MARGIN = 1;

const VL_W = BAY_COLS * (BAY_W + MARGIN) + MARGIN;
const VL_H = BAY_ROWS * (BAY_H + MARGIN) + MARGIN;
const SUB_W = VL_COLS * (VL_W + MARGIN) + MARGIN;
const SUB_H = VL_ROWS * (VL_H + MARGIN) + MARGIN;

const EQ_TYPES = ['CBR', 'DIS', 'CTR', 'VTR', 'SMC', 'BAT'];

/**
 * Build a schema-valid substation laid out on a regular grid: `VL_COLS×VL_ROWS`
 * voltage levels, each holding `BAY_COLS×BAY_ROWS` bays, each holding
 * `EQ_PER_BAY` conducting equipment plus a connectivity node. All SLD layout
 * coordinates are absolute in substation space and non-overlapping.
 */
function largeSubstationDoc(): XMLDocument {
  const parts: string[] = [];
  parts.push(
    `<?xml version="1.0" encoding="UTF-8"?>` +
      `<SCL xmlns="http://www.iec.ch/61850/2003/SCL" version="2007" revision="B" xmlns:sld="${SLD_NS}">` +
      `<Substation name="S1">` +
      `<Private type="OpenSCD-SLD-Layout"><sld:SLDAttributes sld:w="${SUB_W}" sld:h="${SUB_H}"/></Private>`,
  );

  let vlIndex = 0;
  for (let vr = 0; vr < VL_ROWS; vr++) {
    for (let vc = 0; vc < VL_COLS; vc++) {
      vlIndex++;
      const vlX = MARGIN + vc * (VL_W + MARGIN);
      const vlY = MARGIN + vr * (VL_H + MARGIN);
      parts.push(
        `<VoltageLevel name="V${vlIndex}">` +
          `<Private type="OpenSCD-SLD-Layout"><sld:SLDAttributes ` +
          `sld:x="${vlX}" sld:y="${vlY}" sld:w="${VL_W}" sld:h="${VL_H}" ` +
          `sld:lx="${vlX}" sld:ly="${vlY}"/></Private>`,
      );

      let bayIndex = 0;
      for (let br = 0; br < BAY_ROWS; br++) {
        for (let bc = 0; bc < BAY_COLS; bc++) {
          bayIndex++;
          const bayX = vlX + MARGIN + bc * (BAY_W + MARGIN);
          const bayY = vlY + MARGIN + br * (BAY_H + MARGIN);
          const bayName = `B${vlIndex}_${bayIndex}`;
          parts.push(
            `<Bay name="${bayName}">` +
              `<Private type="OpenSCD-SLD-Layout"><sld:SLDAttributes ` +
              `sld:x="${bayX}" sld:y="${bayY}" sld:w="${BAY_W}" sld:h="${BAY_H}" ` +
              `sld:lx="${bayX}" sld:ly="${bayY}"/></Private>`,
          );

          for (let e = 0; e < EQ_PER_BAY; e++) {
            const eqX = bayX + 1 + (e % (BAY_W - 1));
            const eqY = bayY + 1 + Math.floor(e / (BAY_W - 1));
            const type = EQ_TYPES[e % EQ_TYPES.length];
            parts.push(
              `<ConductingEquipment type="${type}" name="${bayName}_${type}${e}">` +
                `<Private type="OpenSCD-SLD-Layout"><sld:SLDAttributes ` +
                `sld:x="${eqX}" sld:y="${eqY}" sld:rot="${e % 4}" ` +
                `sld:lx="${eqX}" sld:ly="${eqY}"/></Private>` +
                `</ConductingEquipment>`,
            );
          }

          parts.push(
            `<ConnectivityNode name="L1" pathName="S1/V${vlIndex}/${bayName}/L1"/>`,
          );
          parts.push(`</Bay>`);
        }
      }
      parts.push(`</VoltageLevel>`);
    }
  }

  parts.push(`</Substation></SCL>`);
  return new DOMParser().parseFromString(parts.join(''), 'application/xml');
}

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    n: s.length,
    min: +s[0].toFixed(1),
    median: +q(0.5).toFixed(1),
    p90: +q(0.9).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
    mean: +mean.toFixed(1),
  };
}

async function measureMoves(
  el: SldSubstationViewer,
  samples = 15,
): Promise<number[]> {
  const svg = el.sld;
  const rect = svg.getBoundingClientRect();
  const times: number[] = [];
  for (let i = 0; i < samples; i++) {
    // Step well beyond one grid cell so the mouse @state actually changes and a
    // re-render is forced; wrap inside the svg bounds.
    const cx = rect.left + 20 + ((i * 40) % Math.max(40, rect.width - 40));
    const cy = rect.top + 20 + ((i * 24) % Math.max(40, rect.height - 40));
    const start = performance.now();
    svg.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: cx,
        clientY: cy,
        bubbles: true,
      }),
    );
     
    await el.updateComplete;
    times.push(performance.now() - start);
  }
  return times;
}

describe('SldSubstationViewer large-file render performance', () => {
  it('reports render cost on a large generated substation', async function reportsRenderCost() {
    this.timeout(60_000);
    const doc = largeSubstationDoc();
    const substation = doc.querySelector('Substation')!;

    const t0 = performance.now();
    const el = (await fixture(html`
      <perf-sld-substation-viewer
        .doc=${doc}
        .substation=${substation}
        .docVersion=${1}
        .gridSize=${6}
        .showLabels=${true}
        .showIeds=${true}
      ></perf-sld-substation-viewer>
    `)) as SldSubstationViewer;
    await el.updateComplete;
    const initialRenderMs = performance.now() - t0;

    const gCount = el.sld.querySelectorAll('g').length;
    const bayCount = substation.querySelectorAll('Bay').length;
    const eqCount = substation.querySelectorAll('ConductingEquipment').length;

    // idle hover: whole render() re-runs on every move.
    const idle = await measureMoves(el);

    // bay move: enter placing mode with the first bay, then move.
    const bay = substation.querySelector('Bay')!;
    el.interaction = interactions.placing(bay, [0, 0]);
    await el.updateComplete;
    const placing = await measureMoves(el);
    el.interaction = interactions.idle();
    await el.updateComplete;

     
    console.log('\n=== SldSubstationViewer render baseline ===');
    console.log(
      `substation: ${substation.querySelectorAll('VoltageLevel').length} VLs, ` +
        `${bayCount} bays, ${eqCount} equipment; ${gCount} rendered <g>`,
    );
    console.log(`initial render: ${initialRenderMs.toFixed(1)} ms`);
    console.log('per-move (ms) idle hover:', stats(idle));
    console.log('per-move (ms) bay move :', stats(placing));
     

    // Sanity only — no timing thresholds (machine-dependent).
    expect(gCount).to.be.greaterThan(bayCount);
    expect(eqCount).to.equal(
      VL_COLS * VL_ROWS * BAY_COLS * BAY_ROWS * EQ_PER_BAY,
    );
  });
});
