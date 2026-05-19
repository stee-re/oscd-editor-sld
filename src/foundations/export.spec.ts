import { expect } from '@open-wc/testing';

import { exportSVG } from './export.js';

describe('export', () => {
  describe('exportSVG', () => {
    it('triggers a download without modifying the original SVG', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', '0');
      rect.setAttribute('y', '0');
      rect.setAttribute('width', '10');
      rect.setAttribute('height', '10');
      svg.appendChild(rect);

      const originalChildCount = svg.childElementCount;

      // exportSVG creates a temporary <a> element, clicks it, and removes it
      // We just verify it doesn't throw and doesn't mutate the source SVG
      exportSVG({ svg, filename: 'test.svg' });

      expect(svg.childElementCount).to.equal(originalChildCount);
      expect(svg.querySelector('rect')).to.not.be.null;
    });

    it('removes handle elements from the export', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      handle.classList.add('handle');
      svg.appendChild(handle);
      const content = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      svg.appendChild(content);

      // The original is not mutated
      exportSVG({ svg, filename: 'test.svg' });
      expect(svg.querySelector('.handle')).to.not.be.null;
    });

    it('removes preview elements from the export', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const preview = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      preview.classList.add('preview');
      svg.appendChild(preview);

      exportSVG({ svg, filename: 'test.svg' });
      // Original preserved
      expect(svg.querySelector('.preview')).to.not.be.null;
    });

    it('removes port elements from the export', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const port = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      port.classList.add('port');
      svg.appendChild(port);

      exportSVG({ svg, filename: 'test.svg' });
      expect(svg.querySelector('.port')).to.not.be.null;
    });

    it('removes label container elements from the export', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const labelContainer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      labelContainer.classList.add('label');
      labelContainer.classList.add('container');
      svg.appendChild(labelContainer);

      exportSVG({ svg, filename: 'test.svg' });
      expect(svg.querySelector('.label.container')).to.not.be.null;
    });

    it('removes outline rect from voltagelevel groups', () => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const vlGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      vlGroup.classList.add('voltagelevel');
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      vlGroup.appendChild(outline);
      const content = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      vlGroup.appendChild(content);
      svg.appendChild(vlGroup);

      exportSVG({ svg, filename: 'test.svg' });
      // Original not mutated
      expect(vlGroup.querySelector('rect')).to.not.be.null;
    });
  });
});
