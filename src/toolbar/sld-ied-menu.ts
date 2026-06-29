import { LitElement, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { newEditEventV2 } from '@openscd/oscd-api/utils.js';
import { identity } from '@openscd/scl-lib';

import type { EditV2 } from '@openscd/oscd-api';
import { OscdFab } from '@omicronenergy/oscd-ui/fab/OscdFab.js';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdListItem } from '@omicronenergy/oscd-ui/list/OscdListItem.js';
import { OscdMenu } from '@omicronenergy/oscd-ui/menu/OscdMenu.js';
import { OscdMenuItem } from '@omicronenergy/oscd-ui/menu/OscdMenuItem.js';

import { sldThemeStyles } from '../theme.js';
import { sldNs, sldPrefix } from '../foundations.js';
import {
  createRemoveIedReferenceEdit,
  iedReferences,
  unresolvedIedReferences,
} from '../foundations/ied.js';
import { getSLDAttributes } from '../foundations/sld-attributes.js';

/**
 * A FAB that opens a menu listing IEDs available for placement on the SLD.
 * Shows three sections: unmatched references (deletable), available (unused)
 * IEDs, and already-used IEDs (repositionable).
 */
export class SldIedMenu extends ScopedElementsMixin(LitElement) {
  static styles = [sldThemeStyles];

  static scopedElements = {
    'oscd-fab': OscdFab,
    'oscd-icon': OscdIcon,
    'oscd-list-item': OscdListItem,
    'oscd-menu': OscdMenu,
    'oscd-menu-item': OscdMenuItem,
  };

  @property({ type: Object })
  doc!: XMLDocument;

  @property({ type: Number })
  docVersion: number = -1;

  get nsp(): string {
    return sldPrefix(this.doc);
  }

  @state()
  private menuOpen = false;

  @query('oscd-menu') private menu?: OscdMenu;

  private get ieds(): Element[] {
    return Array.from(this.doc.querySelectorAll(':root > IED'));
  }

  private get substations(): Element[] {
    return Array.from(this.doc.querySelectorAll(':root > Substation'));
  }

  private get iedRefs(): Element[] {
    return this.substations.flatMap(sub => iedReferences(sub));
  }

  private refForIed(ied: Element): Element | undefined {
    return this.iedRefs.find(
      ref => ref.getAttributeNS(sldNs, 'id') === identity(ied),
    );
  }

  private get unusedIeds(): Element[] {
    return this.ieds.filter(ied => !this.refForIed(ied));
  }

  private get unusedIedRefs(): Element[] {
    return this.substations.flatMap(sub => unresolvedIedReferences(sub));
  }

  private get usedIedRefs(): Element[] {
    return this.ieds
      .sort((a, b) => {
        const aName = a.getAttribute('name') ?? '';
        const bName = b.getAttribute('name') ?? '';

        const aRef = this.refForIed(a);
        const aIsUsed = !!aRef && !!getSLDAttributes(aRef, 'x');

        const bRef = this.refForIed(b);
        const bIsUsed = !!bRef && !!getSLDAttributes(bRef, 'x');

        if (aIsUsed !== bIsUsed) {
          return aIsUsed ? -1 : 1;
        }

        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      })
      .filter(ied => !!getSLDAttributes(this.refForIed(ied) ?? ied, 'x'));
  }

  private insertOrGetIedReference(ied: Element): Element {
    const existing = iedReferences(this.doc).find(
      ref => ref.getAttributeNS(sldNs, 'id') === identity(ied),
    );
    if (existing) {
      return existing;
    }

    const newRef = this.doc.createElementNS(sldNs, `${this.nsp}:Reference`);
    newRef.setAttributeNS(sldNs, `${this.nsp}:id`, String(identity(ied)));
    newRef.setAttributeNS(sldNs, `${this.nsp}:type`, 'IED');
    return newRef;
  }

  private closeMenu() {
    this.menuOpen = false;
    if (this.menu) {
      this.menu.open = false;
    }
  }

  private handleDeleteUnmatched() {
    const edits: EditV2[] = this.unusedIedRefs.map(ref =>
      createRemoveIedReferenceEdit(ref),
    );
    this.dispatchEvent(newEditEventV2(edits));
    this.closeMenu();
  }

  private handleSelectIed(ied: Element) {
    const element = this.insertOrGetIedReference(ied);
    this.closeMenu();
    this.dispatchEvent(
      new CustomEvent('start-placing', {
        bubbles: true,
        composed: true,
        detail: { element },
      }),
    );
  }

  updated() {
    if (this.menu) {
      this.menu.anchorElement = this.menu.previousElementSibling as HTMLElement;
    }
  }

  private renderUnmatchedSection() {
    if (this.unusedIedRefs.length === 0) {
      return nothing;
    }

    return html`<oscd-menu-item
      data-name="Delete Unmatched"
      style="color: var(--oscd-sld-unresolved-reference-color);"
      @click=${() => this.handleDeleteUnmatched()}
    >
      <oscd-icon slot="start">delete</oscd-icon>
      <div slot="headline">
        Remove reference to ${this.unusedIedRefs.length} missing
        IED${this.unusedIedRefs.length > 1 ? 's' : ''} from the SLD
      </div>
    </oscd-menu-item>`;
  }

  private renderAvailableSection() {
    if (this.unusedIeds.length === 0) {
      return nothing;
    }

    return html`<oscd-list-item type="text">
        <div slot="headline"><strong>Available IEDs</strong></div>
      </oscd-list-item>
      ${this.unusedIeds.map(
        ied => html`<oscd-menu-item
          data-name="${ied.getAttribute('name')!}"
          @click=${() => this.handleSelectIed(ied)}
        >
          <div slot="headline">${ied.getAttribute('name')!}</div>
          <div slot="supporting-text">
            ${[
              ied.getAttribute('manufacturer'),
              ied.getAttribute('type'),
              ied.getAttribute('desc'),
            ]
              .filter(a => !!a)
              .join(' - ')}
          </div>
        </oscd-menu-item>`,
      )}`;
  }

  private renderUsedSection() {
    if (this.usedIedRefs.length === 0) {
      return nothing;
    }

    return html`<oscd-list-item type="text">
        <div slot="headline"><strong>Used IEDs</strong></div>
      </oscd-list-item>
      ${this.usedIedRefs.map(
        ied => html`<oscd-menu-item
          data-name="${ied.getAttribute('name')!}"
          @click=${() => {
            const foundIed = this.ieds.find(
              item =>
                item.getAttribute('name') === ied.getAttribute('name'),
            );
            if (!foundIed) {
              return;
            }
            this.handleSelectIed(foundIed);
          }}
        >
          <div slot="headline">${ied.getAttribute('name')!}</div>
          <div slot="supporting-text">
            ${[
              ied.getAttribute('manufacturer'),
              ied.getAttribute('type'),
              ied.getAttribute('desc'),
            ]
              .filter(a => !!a)
              .join(' - ')}
          </div>
          <oscd-icon slot="end">pin_drop</oscd-icon>
        </oscd-menu-item>`,
      )}`;
  }

  render() {
    return html`<oscd-fab
        size="small"
        aria-label="Add IED"
        title="Add IED"
        @click=${() => {
          this.menuOpen = true;
          if (this.menu) {
            this.menu.open = true;
          }
        }}
        ><oscd-icon slot="icon">developer_board</oscd-icon></oscd-fab
      >
      <oscd-menu positioning="fixed" id="iedMenu">
        ${this.renderUnmatchedSection()} ${this.renderAvailableSection()}
        ${this.renderUsedSection()}
      </oscd-menu>`;
  }
}
