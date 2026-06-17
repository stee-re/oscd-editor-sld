# SLD Editor Refactoring

## Goals

- Make the editor easier to understand and maintain
- Preserve behavior unless explicitly changing it
- Prefer small, testable, behavior-preserving extractions
- Keep UI/component files focused on rendering and orchestration
- After each refactor, ask the maintainer to run `npm run format` and `npm run test`; both should pass without remaining complaints

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
- [x] Simplify `oscd-editor-sld.ts` root component rendering (toolbar extraction)
- [x] Promise-based placement API in `sld-editor.ts`
- [x] Extract diagram symbols and delete mixed-purpose `icons.ts`
- [x] Introduce functional artifact descriptor pattern
- [x] Extract ConductingEquipment artifact descriptor
- [x] Extract IED reference artifact descriptor
- [x] Extract BusBar artifact descriptor
- [x] Extract label renderer helper
- [x] Discipline pass on `SldArtifactContext` (per-artifact `TContext` generic)
- [x] Consolidate duplicated `isSelectable`/highlight helpers into `artifacts/highlight.ts`
- [x] Extract PowerTransformer artifact descriptor
- [x] Backfill co-located unit specs for every extracted artifact (`highlight`, `power-transformer`, `bus-bar`, `ied-reference`, `conducting-equipment`, `label`) via shared `test-context.ts` spy builder
- [x] Extract connectivity-node renderer (`artifacts/connectivity-node.ts`); dissolves the bus-bar `renderConnectivityNode` context-callback cycle
- [x] Extract container renderer (Bay/VoltageLevel) into `artifacts/equipment-container.ts` — with `EquipmentContainerContext` carrying child-renderer callbacks
- [x] Split the container renderer into explicit `renderVoltageLevel`/`renderBay` entry points over a shared private `renderContainer(element, context, preview, kind, childContainers)` helper; `ContainerKind` constants (`voltageLevelKind`/`bayKind`) funnel the VL/Bay differences. Removes the dead Bay→Bay "recursion" branch (the SCL hierarchy is fixed-depth: bays never nest).
- [ ] Split large SVG renderers only after lower-risk extractions
- [x] Clean up structural conventions opportunistically — reviewed: code already satisfies the repo's enforced conventions (no one-liner `if`s, consistent `SldArtifactDescriptor` shape, co-located specs, consistent `render*`/`handle*` naming). Import grouping is intentionally left as-is (the repo's `import-x` ESLint config enforces no import-order rule).
- [x] Consolidate remaining duplicated test fixtures/helpers — added `sldFixture({ vl, bay, bayName, children })` to `test-helpers.ts`; migrated the 6 artifact specs sharing the `Substation > VoltageLevel > Bay` scaffold (container, conducting-equipment, power-transformer, label, bus-bar, connectivity-node) to it. `ied-reference`/`highlight` keep bespoke fixtures (different shapes).

## Current File Layout

### Root & Editor

- `src/oscd-editor-sld.ts` (210 lines) — Thin plugin orchestrator: lifecycle, namespace detection, event wiring between toolbar and editor
- `src/sld-editor.ts` (402 lines) — Editing kernel: placement state machine, resize, connect, rotate. Promise-based `startPlacing()` API.
- `src/sld-substation-editor.ts` (1087 lines) — SVG rendering orchestration + context menu delegation. Future split target for viewer extraction.

### Toolbar (`src/toolbar/`)

- `src/toolbar/sld-toolbar.ts` (470 lines) — Layout compositor with data-driven FAB groups. Equipment, structural, transformer, and view-control sections. Owns the about dialog and `insertSubstation` logic.
- `src/toolbar/sld-toolbar.spec.ts` — Unit tests: substation insertion, zoom events, placement events, view toggles, about/cancel
- `src/toolbar/sld-ied-importer.ts` (93 lines) — FAB + hidden file input for bay typical import. Parses SCL, converts layout, emits placement event with IEDs.
- `src/toolbar/sld-ied-importer.spec.ts` — Unit tests: FAB rendering, file input, event dispatch
- `src/toolbar/sld-ied-menu.ts` (251 lines) — IED selection menu with 3 sections (unmatched refs, available IEDs, used IEDs). Emits `start-placing`.
- `src/toolbar/sld-ied-menu.spec.ts` — Unit tests: menu items, status markers, start-placing event, remove unmatched

### Context Menu (`src/context-menu/`)

- `src/context-menu/sld-context-menu.ts` — `SldContextMenu` component, discriminated union types, `MenuContext`, `MenuItemContext`
- `src/context-menu/sld-context-menu-factory.ts` — all menu builder functions, `createContextMenuItems()` entry point
- `src/context-menu/sld-context-menu.spec.ts` — component tests (rendered fixture, no mouse commands)
- `src/context-menu/sld-context-menu-factory.spec.ts` — pure function tests for menu item generation

### Foundations (`src/foundations/`)

- `src/foundations/geometry.ts` — pure rectangle/point math (Rect, Point tuples, no DOM)
- `src/foundations/element-geometry.ts` — Element-aware geometry bridge (`containsRect`, `overlapsRect`)
- `src/foundations/sld-placement.ts` — SLD placement/resize validation rules (`canPlaceAt`, `canResizeTo`, `canResizeToTL`)
- `src/foundations/equipment.ts` — Type constants & guards
- `src/foundations/transformer.ts` — Rendering geometry for windings
- `src/foundations/sld-attributes.ts` — Read/write SLD namespace attributes
- `src/foundations/events.ts` — Custom event factories & types
- `src/foundations/export.ts` — XML pretty-print & download
- `src/foundations/ied.ts` — IED resolution + one edit builder
- `src/foundations/connectivity.ts` — Queries (isBusBar, busSections, connectionStartPoints, connectivityPath, makeBusBar)
- `src/foundations/connectivity-edits.ts` — Connectivity edit builders (removeNode, removeTerminal, reparentElement, uniqueName)
- `src/foundations/edits.ts` — Pure edit builders (ground, flip, delete, copy, connect)

### Other

- `src/oscd-sld-icon.ts` — `OscdSldIcon` component with `SLD_ICONS` map
- `src/converter.ts` — SLD namespace conversion (old ↔ new format)

### Drawing (`src/drawing/`)

- `src/drawing/diagram-symbols.ts` — Diagram SVG defs, grid patterns, markers, resize paths, transformer paths, and equipment symbol paths used by the rendered SLD diagram.
- `src/drawing/artifacts/artifact.ts` — Shared functional artifact descriptor/context types.
- `src/drawing/artifacts/conducting-equipment.ts` — ConductingEquipment artifact descriptor: state, actions, preview labels, and SVG rendering.
- `src/drawing/artifacts/conducting-equipment.spec.ts` — Unit tests: matches/state/actions (place, copy-on-shift, rotate, ground, connect) and render ports.
- `src/drawing/artifacts/ied-reference.ts` — IED reference artifact descriptor: state, actions, preview label, and SVG rendering.
- `src/drawing/artifacts/ied-reference.spec.ts` — Unit tests: matches/state (resolved IED, hidden IEDs), actions (place, start-place, context menu), render.
- `src/drawing/artifacts/bus-bar.ts` — BusBar artifact descriptor: state, placement action, labels, and direct connectivity-node composition (its context is now `ConnectivityNodeContext`).
- `src/drawing/artifacts/bus-bar.spec.ts` — Unit tests: matches/state (diagram id), placement into voltage level, disabled no-op, render.
- `src/drawing/artifacts/connectivity-node.ts` — Connectivity-node renderer (`renderConnectivityNode(cNode, context)`): busbar section geometry, intersection circles, place/resize/connect/context-menu handlers. `ConnectivityNodeContext` carries `connecting`, `mouseX/Y`, `mouseX2/Y2`, `resizingBR`.
- `src/drawing/artifacts/connectivity-node.spec.ts` — Unit tests: nothing-guard, node group/lines render, busbar place/resize/context-menu actions, disabled no-op.
- `src/drawing/artifacts/equipment-container.ts` — Equipment-container renderers for `VoltageLevel`/`Bay`. Exports thin `renderVoltageLevel(vl, context, preview)` (renders the VL then its non-busbar bays) and `renderBay(bay, context, preview)`; both delegate to a shared private `renderContainer(element, context, preview, kind, childContainers)` doing placement/resize math, resize handles, highlight, and fan-out to child renderers. A `ContainerKind` (`voltageLevelKind`/`bayKind`) supplies the few VL/Bay differences (className, stroke, dash, placing-child tag, placement-parent resolution). `EquipmentContainerContext` carries `highlight`, `mouseX/Y`, `nsp`, `resizingBR/TL`, `svgCoordinates`, and child-render callbacks (`renderEquipment`, `renderPowerTransformer`, `renderIed`, `renderConnectivityNode`; `renderLabel` from the shared context).
- `src/drawing/artifacts/equipment-container.spec.ts` — Unit tests for `renderVoltageLevel`/`renderBay`: VL/Bay structure, placing-self nothing-guard, VL→Bay nesting + equipment/transformer delegation, start-place/copy/place/context-menu actions, resize-handle visibility.
- `src/drawing/artifacts/power-transformer.ts` — PowerTransformer artifact descriptor: state, actions, transformer-winding rendering, and `transformerHighlight` helper.
- `src/drawing/artifacts/power-transformer.spec.ts` — Unit tests: matches/state (windings, highlight), actions (start-place, place, select, rotate), render windings.
- `src/drawing/artifacts/label.ts` — Label renderer helper: label text, label events, unresolved IED label color, and label selection behavior.
- `src/drawing/artifacts/label.spec.ts` — Unit tests: hidden labels, name/tspan text, start-place-label, select, Text edit dialog.
- `src/drawing/artifacts/highlight.ts` — Shared `isSelectable`, `isToBeHighlighted`, `getHighlightStyle` helpers (previously duplicated across artifacts and the editor).
- `src/drawing/artifacts/highlight.spec.ts` — Unit tests for the shared selection/highlight helpers.
- `src/drawing/artifacts/test-context.ts` — Shared spy `makeArtifactContext` builder + `renderToSvg` helper for artifact specs.

## Toolbar Architecture

The toolbar is extracted into three self-contained components, each with their own
scoped element registrations.

### `<sld-toolbar>`

Layout compositor. Receives `doc`, `docVersion`, `nsp`, `templateElements`,
`inAction`, `gridSize` as properties. Handles `insertSubstation` and the about
dialog internally. Emits events upward:

| Event | Detail | Purpose |
|-------|--------|---------|
| `start-placing` | `{ element }` | Equipment/structural/transformer FAB clicked |
| `start-placing-typical` | `{ bayTypical, ieds }` | Bay typical imported (from ied-importer) |
| `view-change` | `{ showLabels, showIeds }` | Toggle labels or IED visibility |
| `zoom` | `{ direction: 'in' \| 'out' }` | Zoom in/out |
| `cancel` | — | Cancel action |

Data-driven transformer configs (`TransformerConfig[]`) replace 6 repetitive FAB
blocks with a single config array + `createTransformerElement(config)` factory.

### `<sld-ied-importer>`

FAB + hidden file input. On file selection: parses SCL, runs `convertSldLayout()`,
dispatches `EditV2` for conversion edits, then emits `start-placing-typical`
with `{ bayTypical, ieds }`. The root component uses the promise-based placement
API to await placement and then imports the IEDs.

### `<sld-ied-menu>`

Sectioned menu (unmatched refs, available IEDs, used IEDs). Contains
`insertOrGetIedReference()` logic (moved from root). Emits `start-placing`
with `{ element }` — handled by root as a regular placement.

## Promise-Based Placement API

`sld-editor.ts` exposes a promise-returning `startPlacing()`:

```typescript
type PlacementResult = { element: Element; parent: Element; x: number; y: number };

startPlacing(element, offset?): Promise<PlacementResult | undefined>
```

**Resolution rules:**

- `placeElement()` resolves with the result (successful placement)
- `reset()` resolves with `undefined` (cancel / Escape)

**Why promises over events:**

- 1:1 correlation between initiator and completion — no ambiguity about "was this
  event mine or someone else's?"
- Eliminates special-case state (`placingBayTypical`) and its code paths
- Fits naturally: downward calls (parent → child) are already imperative; upward
  signals (child → parent) remain events

**Usage pattern (bay typical import):**

```typescript
@start-placing-typical=${async ({ detail }) => {
  const result = await this.sldEditor?.startPlacing(detail.bayTypical);
  if (result) {
    const scl = this.doc.querySelector('SCL')!;
    detail.ieds.forEach(ied => {
      this.dispatchEvent(newEditEventV2(insertIed(scl, ied)));
    });
  }
}}
```

## Context-Menu Architecture

`<sld-context-menu>` is a self-contained component. API: `open(context: MenuContext)` — fire and forget. It receives `doc` and `nsp` as properties but does NOT depend on `sclDialogs`.

**Rendering:**

- Uses `<oscd-menu positioning="fixed" quick>` with a zero-size `#ctx-anchor` div positioned at the click location.
- `menuHeaderHeight()` offsets the anchor upward so action items align with the cursor.
- Separators: `<oscd-divider>` (styled by `oscd-menu` via `::slotted`).
- Non-interactive headers: `<oscd-list-item type="text">`. NOT `oscd-menu-item disabled` (that signals "unavailable action").
- Header graphics use `<oscd-sld-icon slot="start">...`, matching `oscd-list-item`'s visible start slot. This intentionally corrects the old mixed slot behavior where some header SVG helpers used `slot="graphic"` and were not consistently visible.

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

- `OscdSldIcon` provides SLD-specific UI icons with a fallback chain (SLD_ICONS → SCL_ICONS → Material Symbols). It owns toolbar and context-menu icon rendering for SLD entities and actions.
- Approved small UI correction: context-menu headers now render SLD entity icons through `<oscd-sld-icon slot="start">...`, so VoltageLevel and ConductingEquipment headers show the same kind of visible start icon as transformer headers. Snapshot updates are expected for this change.
- Prefer functional artifact descriptors over artifact classes for the diagram
  extraction. The class model (`SldConductingEquipment`, etc.) is coherent, but
  the existing codebase already leans toward pure helpers, data-driven configs,
  discriminated unions, and Lit template functions. Functional descriptors keep
  dependencies explicit and avoid hidden coupling through class instances.
- Artifact descriptors expose `matches`, `state`, `actions`, and `render`.
  `SldSubstationEditor` remains the orchestration layer and provides an explicit
  `SldArtifactContext`; artifacts must not receive the concrete editor instance.
- Do not add `index.ts` barrel files for artifact modules. Import specific files
  directly to avoid needless boilerplate and hidden coupling.
- Avoid exported render helper functions that secretly require callers to register scoped child components, instead prefer actual internal components when templates need their own scoped dependencies.
- Avoid adding new inline CSS during refactors unless the value is truly dynamic or cannot cross a shadow DOM boundary cleanly.
- Avoid passing `TemplateResult` through data shapes. Prefer plain strings for labels/headlines.
- Promise-based `startPlacing()` preferred over callbacks-in-events or generic placement-complete events. Maintains 1:1 correlation between placement request and result.
- Test co-location: each component gets its own `.spec.ts` in the same directory. Parent specs test orchestration only, not child internals. When extracting code, tests move with it.
- `docVersion` (incrementing number) must be passed to child components that depend on document content, because mutable `XMLDocument` references don't trigger Lit property changes.

## Verification Requirements

- After each refactor, ask the maintainer to run `npm run format` and `npm run test`.
- Both should pass without complaints.
- If DOM snapshots intentionally change, update snapshots with `--update-snapshots` then rerun normally.

## Last Verified State

- `npm run format` passed.
- `npm run test` passed with `395 passed, 0 failed`.
- `oscd-editor-sld.ts` reduced from 784 → 210 lines.
- `sld-editor.ts` at 402 lines (was 848 before edit builder extraction).
- `sld-toolbar.ts` at 470 lines (new, includes about dialog and insertSubstation).
- `connectivity.ts` split: 106 lines (queries) + 334 lines (edits).
- Code coverage: 90.81%.
- Test co-location: each toolbar component has its own `.spec.ts` alongside it.

Latest verification after BusBar extraction:

- npm run format - by human - passed
- `npm run format` - by human - passed - 395 tests
- `./node_modules/.bin/tsc --noEmit` passed.

Latest verification after label renderer extraction:

- `npm run format` passed.
- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run test` passed with `395 passed, 0 failed` and 90.76% coverage.

Latest verification after artifact unit-spec backfill:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `452 passed, 0 failed` (395 baseline + 57 new co-located artifact unit tests).

Latest verification after connectivity-node extraction:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `459 passed, 0 failed` (+7 connectivity-node unit tests).
- `sld-substation-editor.ts` reduced 1529 → 1331 lines.
- Bus-bar no longer receives `renderConnectivityNode` through its context; it imports the renderer directly, removing the temporary cycle.

Latest verification after container extraction:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `470 passed, 0 failed` (+11 container unit tests).
- `sld-substation-editor.ts` reduced 1331 → 1087 lines.
- `renderContainer` now lives in `drawing/artifacts/equipment-container.ts`; the editor keeps a thin `containerContext()` builder and delegates. Pruned 13 now-unused editor imports/helpers.

Latest verification after the container VL/Bay split:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `470 passed, 0 failed` (behavior preserved; specs now exercise `renderVoltageLevel`/`renderBay`).
- `equipment-container.ts` now exports `renderVoltageLevel`/`renderBay` over a shared private `renderContainer(element, context, preview, kind, childContainers)`; the dead Bay→Bay recursion branch is gone (bays never nest). The editor's `renderContainer` method dispatches on `tagName === 'VoltageLevel'`.
- Renamed the module `container.ts` → `equipment-container.ts` and the exported context type `ContainerContext` → `EquipmentContainerContext` to match the IEC 61850 base type of `VoltageLevel`/`Bay`. Local variables, the private `renderContainer` helper, the `ContainerKind` constants, and the editor's internal `containerContext()` builder keep the short `container` name. Verified: tsc/format/470 tests still pass.

## Edit Builder Extraction — Complete

Edit builders extracted from `sld-editor.ts` (848 → 369 lines, now 402 after placement API).
`sld-editor.ts` is now a thin orchestrator (state + event routing + promise-based placement),
while edit-building logic lives as pure functions in `foundations/`.

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
| `connectivity.ts` | 106 | Read-only queries (`isBusBar`, `busSections`, `connectionStartPoints`) | ✅ pure |
| `connectivity-edits.ts` | 334 | Edit builders (`removeNode`, `removeTerminal`, `reparentElement`, `uniqueName`) | ✅ |
| `edits.ts` | 838 | Pure edit builders (ground, flip, delete, copy, connect) | ✅ |

`connectivity.ts` mixes read-only queries (`isBusBar`, `connectionStartPoints`,
`busSections`) with edit builders (`removeNode`, `removeTerminal`, `reparentElement`,
`makeBusBar`). A future pass could move the edit builders into `edits.ts`, leaving
connectivity as purely read-only. Not a prerequisite for the current work.

## Toolbar Extraction — Complete

The root component's ~500-line `render()` was decomposed into three components:

| Before | After |
|--------|-------|
| `oscd-editor-sld.ts` 784 lines, ~500-line render | `oscd-editor-sld.ts` 210 lines, ~40-line render |
| 6 repetitive transformer FAB blocks | Data-driven `TransformerConfig[]` array |
| IED menu logic embedded in render | Self-contained `<sld-ied-menu>` component |
| Bay typical import mixed into root | Self-contained `<sld-ied-importer>` component |
| `placingBayTypical` special state | Promise-based `startPlacing()` with async/await |
| About dialog in root | Toolbar-internal (no event needed) |
| `insertSubstation` in root | Toolbar-internal (dispatches `EditV2` directly) |
| 10 verbose `sld-toolbar-*` events | 5 clean short-name events |

## Connectivity Boundary Split — Complete

`connectivity.ts` (433 lines) separated into:

| File | Lines | Responsibility |
|------|-------|----------------|
| `connectivity.ts` | 106 | Pure read-only queries (`isBusBar`, `busSections`, `connectionStartPoints`, `connectivityPath`, `makeBusBar`). No `EditV2` import. |
| `connectivity-edits.ts` | 334 | Edit builders (`removeNode`, `removeTerminal`, `reparentElement`, `uniqueName`) + private helpers |

`connectivity.ts` is now a clean read-only module suitable for the future viewer package — it
has no dependency on `EditV2`, `@openscd/scl-lib`, or `./ied.js`.

## `sld-substation-editor.ts` Analysis — The Elephant (2,173 lines)

This is the single largest file and the future viewer extraction target. It mixes three
concerns: SVG rendering, interaction state, and edit dispatch.

### Structural breakdown

| Method/Section | Lines | % | Responsibility |
|----------------|-------|---|----------------|
| `render()` | 483 | 22% | Main diagram composition — placing targets, connection preview, grid, mouse tracking, substation resize dialog |
| `renderEquipment()` | 251 | 12% | Single ConductingEquipment SVG symbol + click/context handlers |
| `renderContainer()` | 251 | 12% | Bay or VoltageLevel rect + children + resize handles |
| `renderConnectivityNode()` | 215 | 10% | Connection polylines between terminals |
| `renderTransformerWinding()` | 116 | 5% | Winding circles + ports |
| `renderLabel()` | 115 | 5% | Text labels with positioning logic |
| `renderPowerTransformer()` | 101 | 5% | Transformer windings composition |
| `renderIed()` | 84 | 4% | IED reference badges |
| `renderBusBar()` | 45 | 2% | Busbar lines |
| Properties/state/lifecycle | ~170 | 8% | 30+ properties, mouse state, coordinate transforms |
| Utility methods | ~90 | 4% | `svgCoordinates`, `nearestOpenTerminal`, `groundTerminal`, `handleExport` |
| Top-level helpers | ~80 | 4% | `isBay`, `isSelectable`, `getHighlightStyle`, `transformerHighlight` |
| `static styles` | ~75 | 3% | CSS |

### Three concerns interleaved

1. **Pure SVG rendering** — Given an SCL element + display flags, produce SVG templates.
   Most `render*` methods are effectively pure: they read element attributes and produce
   `SVGTemplateResult`. No state mutation.

2. **Interaction state machine** — Placement, resizing, connecting. The 483-line `render()`
   is mostly interaction overlays: placing targets, invalid-placement feedback, connection
   preview polylines, coordinate tooltip. This is editing logic, not viewing.

3. **Edit dispatch** — `groundTerminal()`, context menu wiring, and various `@click`
   handlers that build and dispatch `EditV2` events.

### Current decomposition strategy

**Phase A: Extract functional artifact descriptors**

Each artifact type moves toward a functional descriptor in `src/drawing/artifacts/`.
The descriptor owns artifact-specific state derivation, action wiring, and SVG
composition. `SldSubstationEditor` builds a shared `SldArtifactContext` and calls
`renderArtifact(descriptor, element, options)`.

| New module | Contains | Lines |
|------------|----------|-------|
| `drawing/artifacts/conducting-equipment.ts` | ConductingEquipment artifact descriptor: state, actions, SVG rendering | ~460 |
| `drawing/artifacts/artifact.ts` | Shared artifact descriptor/context types | ~60 |
| `drawing/artifacts/equipment-container.ts` | Bay/VoltageLevel artifact descriptor | ~250 |
| `drawing/artifacts/connectivity-node.ts` | ConnectivityNode artifact descriptor | ~215 |
| `drawing/artifacts/power-transformer.ts` | PowerTransformer + TransformerWinding artifact descriptor | ~220 |
| `drawing/artifacts/label.ts` | Label artifact descriptor/helper | ~115 |
| `drawing/artifacts/ied-reference.ts` | IED reference artifact descriptor: state, actions, SVG rendering | ~185 |
| `drawing/artifacts/bus-bar.ts` | BusBar artifact descriptor | ~45 |

Current descriptor shape:

```typescript
type SldArtifactDescriptor<TState, TActions> = {
  matches(element: Element): boolean;
  state(element, context, options?): TState | undefined;
  actions(element, context, state): TActions;
  render(element, state, actions, context, options?): SVGTemplateResult;
}
```

Current implemented wrappers:

- `renderEquipment()` delegates to `conductingEquipmentArtifact`
- `renderIed()` delegates to `iedReferenceArtifact`
- `renderBusBar()` delegates to `busBarArtifact`
- `renderPowerTransformer()` delegates to `powerTransformerArtifact`
- `renderLabel()` delegates to `drawing/artifacts/label.ts`

The current `SldArtifactContext` is useful but must be kept disciplined. Shared
context should contain truly common editor/render services only. Artifact-specific
needs should stay in the artifact module or be passed through an artifact-specific
factory.

### `SldArtifactContext` discipline pass — Complete

The flat `SldArtifactContext` (~24 fields) was split so single-consumer
dependencies are no longer shared. The descriptor now carries a `TContext`
generic, and each artifact declares its own context type extending a small
shared base:

```typescript
type SldArtifactDescriptor<TState, TActions, TContext extends SldSharedContext>
```

| Type | Owner module | Fields |
|------|--------------|--------|
| `SldSharedContext` | `artifacts/artifact.ts` | `disabled`, `dispatch`, `idle`, `openContextMenu`, `placing`, `placingLabel`, `renderLabel`, `renderedPosition`, `selectable`, `substation`, `view` (used by ≥2 artifacts) |
| `EquipmentContext` | `artifacts/conducting-equipment.ts` | shared + `connecting`, `resizingTL`, `resizingBR`, `nearestOpenTerminal`, `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nsp` |
| `PowerTransformerContext` | `artifacts/power-transformer.ts` | shared + `connecting`, `resizingTL`, `resizingBR`, `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nsp` |
| `LabelContext` | `artifacts/label.ts` | shared + `mouseX2`, `mouseY2`, `renderedLabelPosition` |
| `BusBarContext` | `artifacts/bus-bar.ts` | shared + `renderConnectivityNode` |
| (ied-reference) | uses `SldSharedContext` directly | — |

The editor builds the shared bag once in `sharedContext()` and spreads it into
per-artifact builders (`equipmentContext()`, `powerTransformerContext()`,
`labelContext()`, `busBarContext()`). `renderArtifact()` now takes the context
as an argument. The `Connecting` type lives in `artifact.ts` (shared by the
equipment and power-transformer contexts).

Remaining smell (deferred): the shared `renderLabel` and bus-bar's
`renderConnectivityNode` are editor render callbacks, creating
artifact→editor→artifact cycles. Removing those cycles belongs to the
connectivity-node/label artifact extractions (Phase A), not this pass.

Open cleanup identified before the next extraction:

- Avoid letting `SldArtifactContext` become a "world and its mother" bag. If an
  artifact needs something narrow and specific, keep that dependency local to
  that artifact rather than adding it to the shared context by default.

**Phase B: Extract diagram symbols**

Move diagram-specific SVG primitives into `drawing/diagram-symbols.ts`:

- `symbols` (SVG `<defs>` block with equipment symbols, grid patterns, markers)
- `resizePath`, `resizeTLPath`, `resizeBRPath`
- `zigZagPath`, `zigZag2WTransform`, `eqRingPath`
- `equipmentPath`

These are diagram renderer internals, not shared UI icons. This removes the
large mixed-purpose `icons.ts` module and leaves UI icon rendering with
`OscdSldIcon`.

**Phase C: Separate interaction from rendering**

The `render()` method's placing/resizing/connecting logic could become a Lit
reactive controller or a separate interaction-layer component. This would create
a clean viewer/editor boundary:

- **Viewer**: takes SCL + display flags, renders static SVG, emits selection events
- **Editor overlay**: adds placing targets, resize handles, connection previews

This is the most complex phase and should come last.

### Key challenge: shared context

The render methods reference `this.mouseX`, `this.placing`, `this.placingOffset`,
`this.disabled`, `this.showLabels`, etc. The extraction requires threading a context
object. The interface is stable (the properties already exist) so this is mechanical
but touches many lines.

### Icon Ownership Status

The former `icons.ts` served three unrelated consumers:

| Consumer | Uses |
|----------|------|
| `sld-toolbar.ts` | SLD entity/action icons for FAB `slot="icon"` |
| `sld-context-menu.ts` | SLD entity/action icons for menu/list `slot="start"` |
| `sld-substation-editor.ts` | Diagram `<defs>`, resize paths, transformer paths, equipment symbol paths |

Phase B resolves this by deleting `icons.ts`:

- `src/drawing/diagram-symbols.ts` owns diagram renderer SVG primitives.
- `src/oscd-sld-icon.ts` owns SLD UI icon names and rendering for toolbar/context-menu slots.

## Remaining Work

### Near-term (before module split)

1. **~Extract diagram symbols~ (Phase B)** — Move SVG defs/resize paths out of `icons.ts`
   into `drawing/diagram-symbols.ts`, and move UI icon ownership to `OscdSldIcon`.
2. **Extract SVG renderers (Phase A)** — Biggest impact. Start with
   ConductingEquipment as the first functional artifact descriptor. Artifact
   descriptors live in `drawing/artifacts/` and expose `matches`, `state`,
   `actions`, and `render`. The editor supplies an explicit
   `SldArtifactContext` and remains the orchestration layer. For now,
   `SldSubstationEditor.renderArtifact()` is the generic descriptor invocation
   path, with `renderEquipment()` and `renderIed()` kept as compatibility
   wrappers.
3. **Separate interaction from rendering (Phase C)** — Create viewer/editor boundary.
4. ~~**`connectivity.ts` boundary**~~ — ✅ Done. Split into queries + edit builders.
5. **Clean up structural conventions** — consistent file naming, import ordering.
6. **Consolidate test fixtures/helpers** — shared helpers scattered across spec files.
7. Refactor ALL themable styles (most notably colours) out into css variables (so developers using this plugin/future module) can override the colours used for the various artifacts. e.g. TopIndicator in equipment is hardcoded to #BB1326, we should probably expose this as --oscd-sld-equip-top-indicator-color:#BB1326; or something like that.

### Future (module split preparation)

1. Define viewer API boundary (SCL Element in, SVG + events out)
2. Identify which foundations belong to viewer vs editor
3. Design edit event API for editor → plugin communication
4. Decide whether SLD UI icons should eventually merge into oscd-ui/SCL icon registries
