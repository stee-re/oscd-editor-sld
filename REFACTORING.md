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
- [x] Migrate `<sld-context-menu>` from raw `<menu>` to `oscd-menu`
- [ ] Extract edit builders from `sld-editor.ts`
- [ ] Simplify `oscd-editor-sld.ts` root component rendering
- [ ] Split large SVG renderers only after lower-risk extractions
- [ ] Clean up structural conventions opportunistically
- [ ] Consolidate duplicated test fixtures/helpers

## Current File Layout

- `src/context-menu/sld-context-menu.ts` — `SldContextMenu` component, discriminated union types, `MenuContext`, `MenuItemContext`
- `src/context-menu/sld-context-menu-factory.ts` — all menu builder functions, `createContextMenuItems()` entry point
- `src/context-menu/sld-context-menu.spec.ts` — component tests (rendered fixture, no mouse commands)
- `src/context-menu/sld-context-menu-factory.spec.ts` — pure function tests for menu item generation
- `src/oscd-sld-icon.ts` — `OscdSldIcon` component with `SLD_ICONS` map
- `src/foundations/events.ts` — `EditWizardDetail`, `newSclEditDialogEvent`, `newEditIedEvent`, and other SLD event factories
- `src/foundations/geometry.ts` — pure rectangle/point math (Rect, Point tuples, no DOM)
- `src/foundations/element-geometry.ts` — Element-aware geometry bridge (`containsRect`, `overlapsRect`)
- `src/foundations/sld-placement.ts` — SLD placement/resize validation rules (`canPlaceAt`, `canResizeTo`, `canResizeToTL`)
- `src/sld-substation-editor.ts` — registers `<sld-context-menu>`, delegates via `open()` on right-click

## Context-Menu Architecture

`<sld-context-menu>` is a self-contained component. API: `open(context: MenuContext)` — fire and forget. It receives `doc` and `nsp` as properties but does NOT depend on `sclDialogs`.

**Rendering:**

- Uses `<oscd-menu positioning="fixed" quick>` with a zero-size `#ctx-anchor` div positioned at the click location.
- `menuHeaderHeight()` offsets the anchor upward so action items align with the cursor.
- Separators: `<oscd-divider>` (styled by `oscd-menu` via `::slotted`).
- Non-interactive headers: `<oscd-list-item type="text">`. NOT `oscd-menu-item disabled` (that signals "unavailable action").

**Menu close:**

- Action click handlers explicitly clear `this.context`, removing items from DOM.
- `@closed` event on `oscd-menu` handles outside-click and Escape.
- Note: `oscd-menu-item`'s built-in `close-menu` event does NOT propagate under `ScopedElementsMixin` (tag-name mangling breaks the internal mechanism).

**Event dispatch:**

- Most "Edit" actions dispatch `oscd-sld-edit-scl` (handled by the editor).
- IED editing dispatches `oscd-sld-edit-ied`, handled by `handleEditIedRequest()`.
- Ground terminal failure dispatches `sld-ground-hint` (editor shows snackbar).

**Menu items:**

- All 7 builder methods in `sld-context-menu-factory.ts` with entry point `createContextMenuItems(context)`.
- Discriminated union on `type` field (`'action' | 'divider' | 'header'`). Actions default to `'action'` when `type` is omitted.
- `headline` is `string` only (no `TemplateResult`).

## Decisions Made

- `OscdSldIcon` provides SLD-specific icons with a fallback chain (SLD_ICONS → SCL_ICONS → Material Symbols). Icon consolidation with oscd-ui deferred; Storybook comparison stories exist.
- Avoid exported render helper functions that secretly require callers to register scoped child components, instead prefer actual internal components when templates need their own scoped dependencies.
- Avoid adding new inline CSS during refactors unless the value is truly dynamic or cannot cross a shadow DOM boundary cleanly.
- Avoid passing `TemplateResult` through data shapes. Prefer plain strings for labels/headlines.

## Verification Requirements

- After each refactor, run `npm run format` and `npm run test`.
- Both should pass without complaints.
- If DOM snapshots intentionally change, update snapshots with `--update-snapshots` then rerun normally.

## Last Verified State

- `npm run format` passed.
- `npm run test` passed with `352 passed, 0 failed`.
- Integration tests updated

## Edit Builder Extraction — Analysis

The next workstream is extracting edit builders out of `sld-editor.ts` (848 lines).
The goal: `sld-editor.ts` becomes a thin orchestrator (state + event routing), while
edit-building logic lives as pure functions in `foundations/`.

### Foundations Structure Assessment

Current files are well-grouped by domain concept:

| File | Lines | Responsibility | Notes |
|------|-------|----------------|-------|
| `geometry.ts` | 118 | Pure math (Rect, Point, contains, overlaps) | ✅ |
| `element-geometry.ts` | 37 | Bridges geometry ↔ SCL elements | ✅ |
| `sld-placement.ts` | 132 | Validation (`canPlaceAt`, `canResizeTo`) | ✅ read-only |
| `equipment.ts` | 38 | Type constants & guards | ✅ |
| `transformer.ts` | 258 | Rendering geometry for windings | ✅ |
| `sld-attributes.ts` | 177 | Read/write SLD namespace attributes | ✅ |
| `events.ts` | 214 | Custom event factories & types | ✅ |
| `export.ts` | 98 | XML pretty-print & download | ✅ |
| `ied.ts` | 74 | IED resolution + one edit builder | ✅ |
| `connectivity.ts` | 433 | Mixed queries + edit builders | ⚠️ blurry boundary |
| `edits.ts` | 260 | Pure edit builders (ground, flip, delete, copy) | ✅ |

`connectivity.ts` mixes read-only queries (`isBusBar`, `connectionStartPoints`,
`busSections`) with edit builders (`removeNode`, `removeTerminal`, `reparentElement`,
`makeBusBar`). A future pass could move the edit builders into `edits.ts`, leaving
connectivity as purely read-only. Not a prerequisite for the current work.

### Naming: `edits.ts` is fine

The name is generic, but contextually clear (lives in `foundations/`, parallels
`events.ts`). Alternatives considered: `sld-edit-builders.ts`, `sld-mutations.ts`,
`edit-factories.ts` — none improve clarity enough to justify a rename.

### Candidates in `sld-editor.ts`

| Method | Lines | Destination | Complexity |
|--------|-------|-------------|------------|
| `cutSectionAt()` | 51–96 | `edits.ts` or `sld-connect.ts` | Already a pure function at module top |
| `rotateElement()` | 320–336 | `edits.ts` | Small — rotation + terminal removal |
| `placeLabel()` | 338–345 | `edits.ts` | Trivial — single `updateSLDAttributes` |
| Inline resize handlers | 801–834 | `edits.ts` | Small — `updateSLDAttributes` for w/h/x/y |
| `placeElement()` | 347–618 | `edits.ts` (decomposed) | ~270 lines, 6+ sub-responsibilities |
| `connectEquipment()` | 620–758 | New `sld-connect.ts` | ~140 lines, connectivity wiring |

### Proposed file layout after extraction

- **`edits.ts`** — gains: `createRotateEdits`, `createPlaceLabelEdit`,
  `createResizeEdits`, `createResizeTLEdits`, and the decomposed sub-functions
  of `placeElement` (place-grounding, place-descendants, place-ied-wrapper,
  place-busbar-vertex).
- **New `sld-connect.ts`** — `cutSectionAt` + `createConnectEdits`. Conceptually
  "connectivity wiring" (creating sections/vertices/terminals). Adjacent to
  `connectivity.ts` (which provides queries) but distinct because it *creates*
  topology rather than querying/tearing it down.

### `placeElement` decomposition

This method is a grab-bag. It handles:
1. Reparenting (if parent changed)
2. Label offset defaults (per element type and rotation)
3. Coordinate update for the element itself
4. Cascading coordinate shifts to descendants (Bays, ConductingEquipment, Text, Vertices)
5. Terminal disconnection + grounded terminal rewiring
6. Bus-bar vertex special-casing
7. IED Private wrapper creation/cleanup
8. Bay-typical IED insertion

Each of these can become a focused helper. The top-level `createPlaceEdits()`
function composes them.

### Approach

- Extract one method at a time, smallest first (rotate → placeLabel → resize →
  cutSectionAt → connectEquipment → placeElement).
- Each extraction: create pure function, replace method body with call + dispatch,
  add/move unit tests.
- `placeElement` last — decompose into helpers as part of extraction.
- Keep `sld-editor.ts` methods as thin wrappers:
  ```ts
  rotateElement(element: Element) {
    this.dispatchEvent(newEditEventV2(createRotateEdits(element, this.nsp)));
  }
  ```
