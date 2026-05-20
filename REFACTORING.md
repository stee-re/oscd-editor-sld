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
- [x] Extract edit builders from `sld-editor.ts`
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
- `sld-editor.ts` reduced from 848 → 369 lines.
- `foundations/edits.ts` grew to 868 lines (split planned).

## Edit Builder Extraction — Complete

Edit builders extracted from `sld-editor.ts` (848 → 369 lines).
`sld-editor.ts` is now a thin orchestrator (state + event routing), while
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

### Naming: `edits.ts` is fine (for now)

The name is generic, but contextually clear (lives in `foundations/`, parallels
`events.ts`). Alternatives considered: `sld-edit-builders.ts`, `sld-mutations.ts`,
`edit-factories.ts` — none improve clarity enough to justify a rename.

784 lines total. render() spans lines 203–701 — that's ~500 lines of template. That's the core problem.

Breakdown of render()

┌─────────┬──────────────────────────────────────┬─────┬─────────────────────────────────┐
│ Lines   │ Section                              │ LOC │ Issue                           │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 204–212 │ Guard clauses                        │ 9   │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 214–248 │ IED data computation                 │ 35  │ Logic in render                 │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 253–275 │ Equipment FABs                       │ 22  │ Already uses eqTypes.map — OK   │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 277–301 │ BusBar + Bay FABs                    │ 24  │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 303–462 │ VoltageLevel + Import + IED menu     │ 160 │ Dense and deeply nested         │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 464–471 │ Substation FAB                       │ 8   │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 473–596 │ Power Transformer FABs ×6            │ 123 │ Highly repetitive               │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 598–651 │ Toggle + Zoom buttons                │ 53  │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 655–674 │ Cancel/About                         │ 20  │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 676–686 │ <sld-editor> child                   │ 10  │ Fine                            │
├─────────┼──────────────────────────────────────┼─────┼─────────────────────────────────┤
│ 688–701 │ About dialog                         │ 14  │ Fine                            │
└─────────┴──────────────────────────────────────┴─────┴─────────────────────────────────┘

------------------------------------------------------------------------------------------------------------

Top 3 opportunities

1. Power Transformer FABs (lines 473–596) — 6 FABs that differ only by winding count (1/2/3) and kind ('auto'
| 'earthing' | undefined). A single data-driven loop or factory function eliminates ~100 lines:

 const transformerConfigs = [
   { windings: 1, kind: 'auto', label: 'Single Winding Auto' },
   { windings: 2, kind: 'auto', label: 'Two Winding Auto' },
   ...
 ];

1. IED menu (lines 350–462) — Self-contained but deeply nested. Extract to a renderIedMenu() method or even a
separate template helper. It handles 3 sections (delete unmatched, unused IEDs, used IEDs) that each have
their own map/filter logic.

2. Data computation (lines 214–248) — IED sorting/filtering runs every render. Could move to a dedicated
method (e.g. get iedData()) to keep render() focused on template structure.

------------------------------------------------------------------------------------------------------------

Secondary opportunities

- The entire <nav> toolbar (250–675) could be renderToolbar() — the component's actual layout is trivially

<nav> + <sld-editor> + <dialog>.
 - Several conditional ternaries (this.doc.querySelector(...) ? ... : nothing) repeat the same "does X exist
in the doc" pattern — could be named booleans computed once at the top.

------------------------------------------------------------------------------------------------------------

Summary

The low-hanging fruit is the transformer FABs (repetition) and the IED menu (complexity). Together those
account for ~280 of the 500 template lines and could reduce render() to ~250 lines with no architectural
change — just extraction of template helpers.
