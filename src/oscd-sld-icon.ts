import { html, svg, type SVGTemplateResult, type TemplateResult } from 'lit';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';

// ─── Action icons (viewBox 0 96 960 960) ───

const sld_move = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960"><path d="M480 976 310 806l57-57 73 73V616l-205-1 73 73-58 58L80 576l169-169 57 57-72 72h206V330l-73 73-57-57 170-170 170 170-57 57-73-73v206l205 1-73-73 58-58 170 170-170 170-57-57 73-73H520l-1 205 73-73 58 58-170 170Z"/></svg>`;

const sld_resize = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960"><path d="M120 616v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm160 0v-80h80v80h-80Zm160 640v-80h80v80h-80Zm0-640v-80h80v80h-80Zm160 640v-80h80v80h-80Zm160 0v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160v-80h80v80h-80Zm0-160V296H600v-80h240v240h-80ZM120 936V696h80v160h160v80H120Z"/></svg>`;

const sld_resizeTL = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960"><path d="m 120,616 v -80 h 80 v 80 z m 0,-160 v -80 h 80 v 80 z m 0,-160 v -80 h 80 v 80 z m 160,0 v -80 h 80 v 80 z m 160,0 v -80 h 80 v 80 z m 320,0 H 600 V 216 H 840 Z M 120,936 V 696 h 80 v 160 z"/></svg>`;

const sld_resizeBR = svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960"><path d="m 440,936 v -80 h 80 v 80 z m 160,0 v -80 h 80 v 80 z m 160,0 v -80 h 80 v 80 z m 0,-160 v -80 h 80 v 80 z m 0,-160 v -80 h 80 v 80 z m 0,-160 V 296 l 80,-80 v 240 z m -640,480 80,-80 h 160 v 80 z"/></svg>`;

/**
 * SLD-specific icon registry.
 *
 * Lookup order: SLD_ICONS → SCL_ICONS (via OscdIcon) → Material Symbols.
 * When the icon consolidation discussion concludes, these entries can be
 * merged into SCL_ICONS and this component replaced with plain OscdIcon.
 */
export const SLD_ICONS: Record<string, SVGTemplateResult> = {
  sld_move,
  sld_resize,
  sld_resizeTL,
  sld_resizeBR,
};

/**
 * Icon component for the SLD editor.
 *
 * Checks {@link SLD_ICONS} first, then falls back to `OscdIcon` which
 * handles SCL_ICONS → Material Symbols.
 *
 * Usage is identical to `<oscd-icon>`:
 * ```html
 * <oscd-sld-icon>sld_move</oscd-sld-icon>   <!-- SLD icon -->
 * <oscd-sld-icon>gooseIcon</oscd-sld-icon>   <!-- SCL icon (fallback) -->
 * <oscd-sld-icon>edit</oscd-sld-icon>        <!-- Material (fallback) -->
 * ```
 */
export class OscdSldIcon extends OscdIcon {
  private _sldName = '';
  private _sldObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this._updateSldName();

    this._sldObserver = new MutationObserver(() => {
      this._updateSldName();
    });

    this._sldObserver.observe(this, {
      characterData: true,
      subtree: true,
      childList: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._sldObserver?.disconnect();
    this._sldObserver = undefined;
  }

  private _updateSldName(): void {
    const name = (this.textContent ?? '').trim();
    if (name !== this._sldName) {
      this._sldName = name;
      this.requestUpdate();
    }
  }

  protected override render(): TemplateResult<1> {
    const sldSvg = SLD_ICONS[this._sldName];
    if (sldSvg) {
      return html`${sldSvg}`;
    }
    return super.render();
  }
}
