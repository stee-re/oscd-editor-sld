import { css, html, LitElement } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export class SldCoordinateTooltip extends LitElement {
  @property()
  text = '';

  @property({ type: Boolean })
  invalid = false;

  @property({ type: Boolean })
  tooltipHidden = true;

  @property({ attribute: false })
  anchor?: Element;

  @state()
  private outsideAnchor = false;

  @query('.coordinates')
  private coordinates?: HTMLElement;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('pointermove', this.position);
    window.addEventListener('click', this.position);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointermove', this.position);
    window.removeEventListener('click', this.position);
  }

  private position = (event: MouseEvent | PointerEvent) => {
    this.outsideAnchor = this.anchor
      ? !event.composedPath().includes(this.anchor)
      : false;

    if (!this.coordinates) {
      return;
    }

    this.coordinates.style.top = `${event.clientY}px`;
    this.coordinates.style.left = `${event.clientX + 16}px`;
  };

  render() {
    return html`<div
      class="${classMap({
        coordinates: true,
        invalid: this.invalid,
        hidden: this.tooltipHidden || this.outsideAnchor,
      })}"
    >
      (${this.text})
    </div>`;
  }

  static styles = css`
    .hidden {
      display: none;
    }

    .coordinates {
      position: fixed;
      pointer-events: none;
      font-size: 16px;
      font-family: 'Roboto', sans-serif;
      padding: 8px;
      border-radius: 16px;
      background: #fffd;
      color: rgb(0, 0, 0 / 0.83);
    }

    .coordinates.invalid {
      color: #bb1326;
    }
  `;
}
