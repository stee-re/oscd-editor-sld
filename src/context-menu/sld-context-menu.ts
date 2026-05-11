import { css, html, LitElement, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ref } from 'lit/directives/ref.js';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdList } from '@omicronenergy/oscd-ui/list/OscdList.js';
import { OscdListItem } from '@omicronenergy/oscd-ui/list/OscdListItem.js';
import { OscdMenuItem } from '@omicronenergy/oscd-ui/menu/OscdMenuItem.js';

import { OscdSldIcon } from '../oscd-sld-icon.js';
import {
  bayGraphic,
  equipmentGraphic,
  ptrIcon,
  voltageLevelGraphic,
} from '../icons.js';
import { isBusBar } from '../foundations/connectivity.js';
import { isIedReferenceElement } from '../foundations/ied.js';
import { attributes } from '../foundations/sld-attributes.js';
import { createContextMenuItems } from './sld-context-menu-factory.js';

export type ContextMenuAction = {
  type?: 'action';
  handler: () => void;
  headline: string;
  icon: string;
  style?: string;
};

export type ContextMenuDivider = {
  type: 'divider';
};

export type ContextMenuHeader = {
  type: 'header';
  element: Element;
};

export type ContextMenuItem =
  | ContextMenuAction
  | ContextMenuDivider
  | ContextMenuHeader;

export type MenuContext = {
  element: Element;
  x: number;
  y: number;
  gridX: number;
  gridY: number;
};

export type MenuItemContext = MenuContext & {
  doc: XMLDocument;
  nsp: string;
  dispatch: (event: Event) => void;
};

function menuHeaderHeight(element: Element): number {
  // TODO: Reassess whether CSS/measurement can replace this fixed estimate.
  return element.hasAttribute('desc') ||
    element.hasAttribute('type') ||
    (element.tagName === 'Text' && element.textContent)
    ? 73
    : 57;
}

export class SldContextMenu extends ScopedElementsMixin(LitElement) {
  static scopedElements = {
    'oscd-icon': OscdIcon,
    'oscd-list': OscdList,
    'oscd-list-item': OscdListItem,
    'oscd-menu-item': OscdMenuItem,
    'oscd-sld-icon': OscdSldIcon,
  };

  @property({ attribute: false })
  doc!: XMLDocument;

  @property()
  nsp!: string;

  @state()
  private context?: MenuContext;

  open(context: MenuContext): void {
    this.context = context;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeydown);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeydown);
  }

  private handleKeydown = ({ key }: KeyboardEvent) => {
    if (key === 'Escape') {
      this.close();
    }
  };

  private handleScrimClick = (event: MouseEvent) => {
    event.stopImmediatePropagation();
    this.close();
  };

  private close(): void {
    this.context = undefined;
  }

  private action(handler: () => void): () => void {
    return () => {
      handler();
      this.close();
    };
  }

  private buildItems(): ContextMenuItem[] {
    if (!this.context) {
      return [];
    }

    return createContextMenuItems({
      ...this.context,
      doc: this.doc,
      nsp: this.nsp,
      dispatch: event => this.dispatchEvent(event),
    });
  }

  private renderAction(item: ContextMenuAction): TemplateResult {
    return html`<oscd-menu-item
      style=${item.style ?? nothing}
      @click=${this.action(item.handler)}
    >
      <div slot="headline">${item.headline}</div>
      <oscd-sld-icon slot="start">${item.icon}</oscd-sld-icon>
    </oscd-menu-item>`;
  }

  private static renderDivider(): TemplateResult {
    return html`<li divider role="separator"></li>`;
  }

  private static renderHeader({ element }: ContextMenuHeader): TemplateResult {
    let name = element.getAttribute('name') || element.tagName;
    let detail: string | null | TemplateResult<1> =
      element.getAttribute('desc');
    const type = element.getAttribute('type');

    if (type) {
      if (detail) {
        detail = html`${type} &mdash; ${detail}`;
      } else {
        detail = type;
      }
    }

    let footerGraphic = equipmentGraphic(null);
    if (element.tagName === 'PowerTransformer') {
      const windings = element.querySelectorAll('TransformerWinding').length;
      const { kind } = attributes(element);

      if (windings === 3) {
        footerGraphic = ptrIcon(3, { slot: 'start' });
      } else if (windings === 2) {
        footerGraphic = ptrIcon(2, { slot: 'start', kind });
      } else {
        footerGraphic = ptrIcon(1, { slot: 'start', kind });
      }
    } else if (element.tagName === 'TransformerWinding') {
      footerGraphic = ptrIcon(1, { slot: 'start' });
    } else if (element.tagName === 'ConductingEquipment') {
      footerGraphic = equipmentGraphic(type);
    } else if (element.tagName === 'Bay' && isBusBar(element)) {
      footerGraphic = html`<oscd-icon slot="start">horizontal_rule</oscd-icon>`;
    } else if (element.tagName === 'Bay') {
      footerGraphic = bayGraphic;
    } else if (element.tagName === 'VoltageLevel') {
      footerGraphic = voltageLevelGraphic;
    } else if (isIedReferenceElement(element)) {
      name = 'IED';
      footerGraphic = html`<oscd-icon slot="start">developer_board</oscd-icon>`;
    } else if (element.tagName === 'Text') {
      footerGraphic = html`<oscd-icon slot="start">title</oscd-icon>`;
      detail = element.textContent;
    }

    return html`<oscd-list-item type="text">
      <div slot="headline">${name}</div>
      ${detail
        ? html`<div
            slot="supporting-text"
            style="display: inline-block; max-width: 15em; overflow: hidden; text-overflow: ellipsis;"
          >
            ${detail}
          </div>`
        : nothing}
      ${footerGraphic}
    </oscd-list-item>`;
  }

  private renderMenuItem(item: ContextMenuItem): TemplateResult {
    switch (item.type) {
      case 'divider':
        return SldContextMenu.renderDivider();
      case 'header':
        return SldContextMenu.renderHeader(item);
      default:
        return this.renderAction(item);
    }
  }

  protected override render(): TemplateResult {
    if (!this.context) {
      return html``;
    }

    const { element, x, y } = this.context;
    const items = this.buildItems();

    return html`
      <div
        class="scrim"
        @click=${this.handleScrimClick}
        @keydown=${this.handleKeydown}
      ></div>
      <menu
        id="sld-context-menu"
        style="top: ${y - menuHeaderHeight(element)}px; left: ${x}px;"
        ${ref(async (menu?: Element) => {
          if (!(menu instanceof HTMLElement)) {
            return;
          }

          await this.updateComplete;
          const { bottom, right } = menu.getBoundingClientRect();
          if (bottom > window.innerHeight) {
            menu.style.removeProperty('top');
            menu.style.bottom = '0px';
            menu.style.maxHeight = 'calc(100vh - 68px)';
          }
          if (right > window.innerWidth) {
            menu.style.removeProperty('left');
            menu.style.right = '0px';
          }
        })}
      >
        <oscd-list>
          ${SldContextMenu.renderHeader({ type: 'header', element })}
          ${items.map(item => this.renderMenuItem(item))}
        </oscd-list>
      </menu>
    `;
  }

  static styles = css`
    :host {
      display: contents;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 99;
    }

    menu {
      position: fixed;
      z-index: 100;
      background: var(--oscd-base3, white);
      margin: 0px;
      padding: 0px;
      box-shadow:
        0 10px 20px rgba(0, 0, 0, 0.19),
        0 6px 6px rgba(0, 0, 0, 0.23);
      --mdc-list-vertical-padding: 0px;
      overflow-y: auto;
    }
  `;
}
