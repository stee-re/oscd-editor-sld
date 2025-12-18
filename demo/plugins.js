import OscdMenuNew from "@omicronenergy/oscd-menu-commons/oscd-menu-new.js";
import OscdMenuOpen from '@omicronenergy/oscd-menu-open';
import OscdMenuSave from '@omicronenergy/oscd-menu-save';
import OscdBackgroundEditV1 from '@omicronenergy/oscd-background-editv1';
import OscdBackgroundWizardEvents from "@omicronenergy/oscd-background-wizard-events/oscd-background-wizard-events.js";

import OscdEditorSld from '../dist/oscd-editor-sld.js';

customElements.define("oscd-menu-new", OscdMenuNew);
customElements.define('oscd-menu-open', OscdMenuOpen);
customElements.define('oscd-menu-save', OscdMenuSave);
customElements.define('oscd-background-editv1', OscdBackgroundEditV1);
customElements.define('oscd-background-wizard-events', OscdBackgroundWizardEvents);
customElements.define('oscd-editor-sld', OscdEditorSld);

export const plugins = {
  menu: [
    {
      name: "New File",
      translations: { de: "Neu Datei" },
      icon: "create_new_folder",
      requireDoc: false,
      tagName: "oscd-menu-new",
    },
    {
      "name": "Open project",
      "translation": {
        "de": "Project öffnen"
      },
      "icon": "folder_open",
      "tagName": "oscd-menu-open"
    },
    {
      "name": "Save project",
      "translation": {
        "de": "Projekt speichern"
      },
      "icon": "save",
      "requireDoc": true,
      "tagName": "oscd-menu-save"
    },
    {
      "name": "Import IED",
      "translation": {
        "de": "Projekt speichern"
      },
      "icon": "snippet_folder",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/scl-import-ied/scl-import-ied.js"
    },
        {
      name: "Validating",
      translation: {
        de: "Validieren",
      },
      icon: "rule_folder",
      requireDoc: true,
      src: "../plugins/scl-validating/scl-validating.js",
    },
  ],
  editor: [
    {
      "name": "SLD",
      "translations": {
        "de": "SLD"
      },
      "icon": "add_box",
      "active": true,
      "tagName": "oscd-editor-sld"
    },
    {
      "name": "Publisher",
      "icon": "publish",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/oscd-publisher/oscd-publisher.js"
    },
    {
      "name": "Subscriber (Later Binding)",
      "translations": {
        "de": "Subscriber (Later Binding)"
      },
      "icon": "link",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/subscriber-later-binding/oscd-subscriber-later-binding.js"
    },
    {
      "name": "Communication",
      "icon": "settings_ethernet",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/oscd-communication/scl-communication.js"
    },
    {
      "name": "Substation",
      "icon": "margin",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/scl-substation-editor/scl-substation-editor.js"
    },
    {
      "name": "Template Editor",
      "icon": "copy_all",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/scl-template/scl-template.js"
    },
    {
      "name": "Template Generator",
      "icon": "copy_all",
      "active": true,
      "requireDoc": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/oscd-template-generator/oscd-template-generator.js"
    },
    {
      "name": "Start",
      "translations": {
        "de": "Start"
      },
      "icon": "start",
      "active": true,
      "src": "https://openenergytools.github.io/scl-editor/plugins/scl-editor-landing/scl-editor-landing.js"
    }
  ],
  background: [
    {
      name: 'EditV1 Events Listener',
      icon: 'none',
      requireDoc: true,
      tagName: 'oscd-background-editv1',
    },
    {
      name: 'Wizard dialog Events Listener',
      icon: 'none',
      requireDoc: true,
      tagName: 'oscd-background-wizard-events',
    },
  ],
};
