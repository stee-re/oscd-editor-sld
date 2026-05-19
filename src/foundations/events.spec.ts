import { expect } from '@open-wc/testing';

import {
  newResizeEvent,
  newResizeTLEvent,
  newPlaceEvent,
  newPlaceLabelEvent,
  newConnectEvent,
  newRotateEvent,
  newStartResizeTLEvent,
  newStartResizeBREvent,
  newStartPlaceEvent,
  newStartPlaceLabelEvent,
  newStartConnectEvent,
  newSelectEvent,
  newSclEditDialogEvent,
  newEditIedEvent,
} from './events.js';

describe('events', () => {
  let element: Element;

  beforeEach(() => {
    element = document.createElement('div');
  });

  describe('newResizeEvent', () => {
    it('creates a bubbling composed event with correct type', () => {
      const event = newResizeEvent({ w: 5, h: 10, element });
      expect(event.type).to.equal('oscd-sld-resize');
      expect(event.bubbles).to.be.true;
      expect(event.composed).to.be.true;
    });

    it('carries the detail payload', () => {
      const event = newResizeEvent({ w: 5, h: 10, element });
      expect(event.detail.w).to.equal(5);
      expect(event.detail.h).to.equal(10);
      expect(event.detail.element).to.equal(element);
    });
  });

  describe('newResizeTLEvent', () => {
    it('creates event with type oscd-sld-resize-tl', () => {
      const event = newResizeTLEvent({ x: 1, y: 2, w: 3, h: 4, element });
      expect(event.type).to.equal('oscd-sld-resize-tl');
      expect(event.detail).to.deep.include({ x: 1, y: 2, w: 3, h: 4 });
    });
  });

  describe('newPlaceEvent', () => {
    it('creates event with type oscd-sld-place', () => {
      const parent = document.createElement('div');
      const event = newPlaceEvent({ x: 2, y: 3, element, parent });
      expect(event.type).to.equal('oscd-sld-place');
      expect(event.detail.x).to.equal(2);
      expect(event.detail.y).to.equal(3);
      expect(event.detail.element).to.equal(element);
      expect(event.detail.parent).to.equal(parent);
    });
  });

  describe('newPlaceLabelEvent', () => {
    it('creates event with type oscd-sld-place-label', () => {
      const event = newPlaceLabelEvent({ x: 7, y: 8, element });
      expect(event.type).to.equal('oscd-sld-place-label');
      expect(event.detail.x).to.equal(7);
      expect(event.detail.y).to.equal(8);
    });
  });

  describe('newConnectEvent', () => {
    it('creates event with type oscd-sld-connect', () => {
      const from = document.createElement('div');
      const to = document.createElement('div');
      const event = newConnectEvent({
        from,
        path: [[0, 0], [1, 1]],
        fromTerminal: 'T1',
        to,
        toTerminal: 'T2',
      });
      expect(event.type).to.equal('oscd-sld-connect');
      expect(event.detail.fromTerminal).to.equal('T1');
      expect(event.detail.toTerminal).to.equal('T2');
      expect(event.detail.path).to.have.length(2);
    });
  });

  describe('newRotateEvent', () => {
    it('creates event with type oscd-sld-rotate', () => {
      const event = newRotateEvent(element);
      expect(event.type).to.equal('oscd-sld-rotate');
      expect(event.detail).to.equal(element);
    });
  });

  describe('newStartResizeTLEvent', () => {
    it('creates event with type oscd-sld-start-resize-tl', () => {
      const event = newStartResizeTLEvent(element);
      expect(event.type).to.equal('oscd-sld-start-resize-tl');
      expect(event.detail).to.equal(element);
    });
  });

  describe('newStartResizeBREvent', () => {
    it('creates event with type oscd-sld-start-resize-br', () => {
      const event = newStartResizeBREvent(element);
      expect(event.type).to.equal('oscd-sld-start-resize-br');
      expect(event.detail).to.equal(element);
    });
  });

  describe('newStartPlaceEvent', () => {
    it('creates event with type oscd-sld-start-place', () => {
      const event = newStartPlaceEvent(element);
      expect(event.type).to.equal('oscd-sld-start-place');
      expect(event.detail.element).to.equal(element);
      expect(event.detail.offset).to.deep.equal([0, 0]);
    });

    it('accepts custom offset', () => {
      const event = newStartPlaceEvent(element, [3, 4]);
      expect(event.detail.offset).to.deep.equal([3, 4]);
    });
  });

  describe('newStartPlaceLabelEvent', () => {
    it('creates event with type oscd-sld-start-place-label', () => {
      const event = newStartPlaceLabelEvent(element);
      expect(event.type).to.equal('oscd-sld-start-place-label');
      expect(event.detail.element).to.equal(element);
      expect(event.detail.offset).to.deep.equal([0, 0]);
    });

    it('accepts custom offset', () => {
      const event = newStartPlaceLabelEvent(element, [1, 2]);
      expect(event.detail.offset).to.deep.equal([1, 2]);
    });
  });

  describe('newStartConnectEvent', () => {
    it('creates event with type oscd-sld-start-connect', () => {
      const from = document.createElement('div');
      const event = newStartConnectEvent({
        from,
        fromTerminal: 'T2',
        path: [[0, 0]],
      });
      expect(event.type).to.equal('oscd-sld-start-connect');
      expect(event.detail.from).to.equal(from);
      expect(event.detail.fromTerminal).to.equal('T2');
    });
  });

  describe('newSelectEvent', () => {
    it('creates event with type oscd-sld-selected', () => {
      const event = newSelectEvent(element);
      expect(event.type).to.equal('oscd-sld-selected');
      expect(event.detail.element).to.equal(element);
    });
  });

  describe('newSclEditDialogEvent', () => {
    it('creates event with type oscd-sld-edit-scl', () => {
      const event = newSclEditDialogEvent(element);
      expect(event.type).to.equal('oscd-sld-edit-scl');
      expect(event.detail.element).to.equal(element);
    });
  });

  describe('newEditIedEvent', () => {
    it('creates event with type oscd-sld-edit-ied', () => {
      const event = newEditIedEvent(element);
      expect(event.type).to.equal('oscd-sld-edit-ied');
      expect(event.detail.element).to.equal(element);
    });
  });

  describe('all event factories', () => {
    it('produce bubbling composed CustomEvents', () => {
      const factories = [
        () => newResizeEvent({ w: 1, h: 1, element }),
        () => newResizeTLEvent({ x: 0, y: 0, w: 1, h: 1, element }),
        () => newPlaceEvent({ x: 0, y: 0, element, parent: element }),
        () => newPlaceLabelEvent({ x: 0, y: 0, element }),
        () => newConnectEvent({ from: element, path: [], fromTerminal: 'T1', to: element }),
        () => newRotateEvent(element),
        () => newStartResizeTLEvent(element),
        () => newStartResizeBREvent(element),
        () => newStartPlaceEvent(element),
        () => newStartPlaceLabelEvent(element),
        () => newStartConnectEvent({ from: element, fromTerminal: 'T1', path: [] }),
        () => newSelectEvent(element),
        () => newSclEditDialogEvent(element),
        () => newEditIedEvent(element),
      ];

      factories.forEach((factory) => {
        const event = factory();
        expect(event.bubbles, `${event.type} should bubble`).to.be.true;
        expect(event.composed, `${event.type} should be composed`).to.be.true;
      });
    });
  });
});
