import { LitElement } from 'lit';
import { OscdFab } from '@omicronenergy/oscd-ui/fab/OscdFab.js';
import { OscdIcon } from '@omicronenergy/oscd-ui/icon/OscdIcon.js';
import { OscdListItem } from '@omicronenergy/oscd-ui/list/OscdListItem.js';
import { OscdMenu } from '@omicronenergy/oscd-ui/menu/OscdMenu.js';
import { OscdMenuItem } from '@omicronenergy/oscd-ui/menu/OscdMenuItem.js';
declare const SldIedMenu_base: typeof LitElement & import("@open-wc/scoped-elements/lit-element.js").ScopedElementsHostConstructor;
/**
 * A FAB that opens a menu listing IEDs available for placement on the SLD.
 * Shows three sections: unmatched references (deletable), available (unused)
 * IEDs, and already-used IEDs (repositionable).
 */
export declare class SldIedMenu extends SldIedMenu_base {
    static scopedElements: {
        'oscd-fab': typeof OscdFab;
        'oscd-icon': typeof OscdIcon;
        'oscd-list-item': typeof OscdListItem;
        'oscd-menu': typeof OscdMenu;
        'oscd-menu-item': typeof OscdMenuItem;
    };
    doc: XMLDocument;
    docVersion: number;
    nsp: string;
    private menuOpen;
    private menu?;
    private get ieds();
    private get substations();
    private get iedRefs();
    private refForIed;
    private get unusedIeds();
    private get unusedIedRefs();
    private get usedIedRefs();
    private insertOrGetIedReference;
    private closeMenu;
    private handleDeleteUnmatched;
    private handleSelectIed;
    updated(): void;
    private renderUnmatchedSection;
    private renderAvailableSection;
    private renderUsedSection;
    render(): import("lit-html").TemplateResult<1>;
}
export {};
