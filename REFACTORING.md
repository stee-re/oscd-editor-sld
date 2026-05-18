# SLD Editor Refactoring

## Goals

- Make the editor easier to understand and maintain
- Preserve behavior unless explicitly changing it
- Prefer small, testable, behavior-preserving extractions
- Keep UI/component files focused on rendering and orchestration
- After each refactor, run `npm run format` and `npm run test`; both should pass without remaining complaints

## Guiding Star

The immediate goal of this refactor is to reduce cognitive load: each file
should have a clear responsibility, and behavior should be easier to understand,
test, and change without reading the whole plugin.

The longer-term goal is to make SLD functionality much easier to integrate with
other plugins by enabling a future split into reusable npm modules. That split
has not been analyzed yet, and the exact package boundaries, names, and APIs are
not decided. The current refactor should create the conditions for that future
analysis by making responsibilities clearer and dependencies easier to see.

This is only a guiding star for the current work. We are not trying to design the
future package split yet, but refactors should avoid making that future harder.

The code should move toward boundaries that could support a shape like this:

- `oscd-sld-viewer`: renders an SLD from an SCL `Element`. It should own the
  read-only SVG/grid rendering and expose user intent through events, such as
  selecting a rendered artifact or clicking a grid position. The ideal core API
  may be as simple as SCL `Element` in, SVG out; whether that is exposed as a
  function, a web component, or both remains open.
- `oscd-sld-editor`: builds on top of the viewer and translates editing intent
  into a clean Edit API. It should likely build and surface edits so the owning
  plugin can intercept, amend, or apply them and know when changes have
  completed. The exact event/API shape is still unclear and should emerge from
  behavior-preserving extractions.
- `oscd-editor-plugin`: the OpenSCD plugin wrapper. It should eventually become
  a thin container for plugin-specific toolbar/menu wiring, document integration,
  and the reusable SLD editor.

Because the module split is not final, current refactors should avoid hardening
temporary package boundaries too early. Prefer extracting cohesive rendering,
validation, edit-building, and plugin-orchestration responsibilities in small
steps that preserve behavior and keep future options open.

## Workstreams

- [x] Convert menu items to data-driven `ContextMenuAction` shape (discriminated union)
- [x] Create `OscdSldIcon` for SLD-specific action icons
- [x] Extract `<sld-context-menu>` as standalone component
- [x] Extract menu builder methods into `sld-context-menu-factory.ts`
- [x] Move `EditWizardDetail` & `newSclEditDialogEvent` to `foundations/events.ts`
- [x] Delete dead code `sld-context-menu-item.ts`
- [x] Extract placement and resize validation helpers
- [ ] Extract edit builders from `sld-editor.ts`
- [ ] Simplify `oscd-editor-sld.ts` root component rendering
- [ ] Split large SVG renderers only after lower-risk extractions
- [ ] Clean up structural conventions opportunistically
- [ ] Consolidate duplicated test fixtures/helpers

## Current Notes

- Context-menu refactoring complete and committed on `feat_the-big-restructure`.
- `SldContextMenu` component (`src/context-menu/sld-context-menu.ts`) owns all menu rendering, positioning/overflow correction, scrim click-away, and Escape key handling. API is fire-and-forget via `open(context: MenuContext)`.
- All 7 menu builder methods extracted to `src/context-menu/sld-context-menu-factory.ts` with a single entry point `createContextMenuItems(context)`. Helpers `flipElement`, `addTextTo`, `groundTerminal` also live there.
- Types (`ContextMenuAction`, `ContextMenuDivider`, `ContextMenuHeader`, `ContextMenuItem`, `MenuContext`, `MenuItemContext`) exported from `src/context-menu/sld-context-menu.ts`.
- `OscdSldIcon` component (`src/oscd-sld-icon.ts`) extends `OscdIcon` with an `SLD_ICONS` map for SLD-specific action icons (`sld_move`, `sld_resize`, `sld_resizeTL`, `sld_resizeBR`). Falls back to `OscdIcon` (SCL_ICONS → Material Symbols).
- `sld-substation-editor.ts` now only registers `<sld-context-menu>` in scoped elements and calls `this.contextMenu?.open(...)` on right-click. No menu building or rendering logic remains there.
- `EditWizardDetail`, `newSclEditDialogEvent`, and `newEditIedEvent` live in `src/foundations/events.ts`.
- Old `MenuItem` type, `isMenuAction()` guard, and `sld-context-menu-item.ts` are all deleted.
- The `headline` field on `ContextMenuAction` is `string` only (no `TemplateResult`).
- Icon comparison Storybook stories added to oscd-ui for future discussion on icon consolidation (uncommitted in oscd-ui repo).

## Current File Layout

- `src/context-menu/sld-context-menu.ts` — `SldContextMenu` component, discriminated union types, `MenuContext`, `MenuItemContext`
- `src/context-menu/sld-context-menu-factory.ts` — all menu builder functions, `createContextMenuItems()` entry point
- `src/oscd-sld-icon.ts` — `OscdSldIcon` component with `SLD_ICONS` map
- `src/foundations/events.ts` — `EditWizardDetail`, `newSclEditDialogEvent`, `newEditIedEvent`, and other SLD event factories
- `src/foundations/geometry.ts` — pure rectangle/point math (Rect, Point tuples, no DOM)
- `src/foundations/element-geometry.ts` — Element-aware geometry bridge (`containsRect`, `overlapsRect`)
- `src/foundations/sld-placement.ts` — SLD placement/resize validation rules (`canPlaceAt`, `canResizeTo`, `canResizeToTL`)
- `src/sld-substation-editor.ts` — registers `<sld-context-menu>`, delegates via `open()` on right-click

## Context-Menu Extraction (Completed)

The `<sld-context-menu>` component was extracted as a standalone web component that owns:

- All 7 menu builder methods (via `sld-context-menu-factory.ts`) and helpers (`flipElement`, `addTextTo`, `groundTerminal`)
- Menu rendering, positioning, and overflow correction
- Click-away (scrim) and Escape key handling
- Its own open/close lifecycle via `open(context: MenuContext)` — fire and forget

The component receives `doc` and `nsp` as properties. It does NOT depend on `sclDialogs`:

- Most "Edit" actions dispatch `oscd-edit-wizard-request` (handled by the editor)
- IED editing dispatches `oscd-edit-ied-request`, handled by `handleEditIedRequest()` on the editor
- Ground terminal failure dispatches an `sld-ground-hint` event (editor shows snackbar)

The substation editor's only involvement: call `this.contextMenu.open(context)` on right-click.

## Follow-up (out of scope for current refactor)

- Move `<oscd-scl-dialogs>` and its event handlers (`handleEditWizardRequest`, `handleEditIedRequest`) up from `sld-substation-editor` to `sld-editor`, alongside all other event handlers. Currently creates one listener per substation unnecessarily.

## Decisions Made

- All context menu items use a discriminated union on `type` field (`'action' | 'divider' | 'header'`). Actions default to `'action'` when `type` is omitted.
- `OscdSldIcon` provides SLD-specific icons with a fallback chain (SLD_ICONS → SCL_ICONS → Material Symbols). This is a local solution pending the icon consolidation discussion.
- Icon consolidation between SLD and oscd-ui's SCL_ICONS is deferred. Storybook comparison stories exist in oscd-ui for visual review.
- Context menu is a self-contained component that dispatches events upward. It receives `doc` and `nsp` but NOT `sclDialogs`.
- Avoid exported render helper functions that secretly require callers to register scoped child components.
- Prefer actual internal components when templates need their own scoped dependencies.
- Avoid adding new inline CSS during refactors unless the value is truly dynamic
  or cannot cross a shadow DOM boundary cleanly.
- Avoid passing `TemplateResult` through data shapes. Prefer plain strings for labels/headlines.

## Verification Requirements

- After each refactor, run `npm run format`.
- After each refactor, run `npm run test`.
- `npm run format` should complete without remaining lint complaints.
- `npm run test` should remain green.
- If DOM snapshots intentionally change, update snapshots and then rerun `npm run test` normally.

## Last Verified State

- `npm run format` passed.
- `npm run test` passed with `127 passed, 0 failed`.
- Placement/resize validation extraction committed on `feat_the-big-restructure`.
- Known browser log warnings about Lit scheduling updates remain pre-existing and did not fail tests.

## Suggested Next Steps

- Consider extracting edit builders from `sld-editor.ts`.
- Move `<oscd-scl-dialogs>` and its event handlers up from `sld-substation-editor` to `sld-editor` (see Follow-up section).
