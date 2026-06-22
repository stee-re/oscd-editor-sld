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

## Current Next Steps

1. **Introduce an explicit interaction mode.** Replace the scattered
   `placing`/`resizingBR`/`resizingTL`/`placingLabel`/`connecting` mode fields
   with one discriminated mode shape or enum, keeping the base layer stack always
   rendered and centralizing only overlay composition by mode.
2. **Later structural candidates.** Extract `<sld-substation-header>`, rework or
   hoist the coordinate tooltip, review the `SldEditor`/`SldSubstationEditor`
   names, and expose hardcoded artifact colours as CSS variables.

## Completed Workstreams

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
- [x] **Split large SVG renderers only after lower-risk extractions — decompose `render()` into explicit, content-named *layer* sub-renderers.** The agreed strategy (worked out in mentoring): because SVG has no `z-index`, **paint order *is* the design** — the sequence in which children are emitted is exactly their stacking order (last-drawn wins). So `SldSubstationEditor.render()` (currently ~483 lines) should become a short, readable **stack of layer calls in paint order**, where the call order *is* the documented z-order.
  - **✅ DONE (2026-06-19, all steps verified tsc + format + 470 tests green after each cut).** `SldSubstationEditor.render()` is now fully flattened: Part-1 is just the substation-dim destructure, and the body is a pure stack of `render*()` calls. Methods created (in paint order):
    `renderHeader` (h2 toolbar) · `renderVoltageLevelPlacingTarget` (VL drop-zone, back) · `renderVoltageLevelLayer` · `renderConnectionPreviewLayer` · `renderConnectModeEquipmentLayer` (renamed from the confusing `renderConnectEquipmentLayer`; + doc comment on the suppress-below/re-paint-on-top trick) · `renderConnectivityLayer` (collapsed the two busbar/non-busbar passes into one stable "busbars last" sort) · `renderPowerTransformerLayer` · `renderIedLayer` · `renderLabelLayer` · `renderPlacingTargetsLayer` (transformer/ied/label, front) · `renderPlacingPreview` (the ghost, top) · `renderCoordinateTooltip` (DOM overlay outside the `<svg>`, owns the placing/resizingBR/resizingTL invalid/hidden/coords math — no `Layer` suffix as it is not a z-band) · `renderResizeDialog`.
    The placing targets kept their deliberate TOP/BOTTOM z-split (VL target back; transformer/ied/label targets front) — preserved exactly, with comments. `handleExport` and `this.sld` left untouched (export is a view concern — see the litmus-test workstream below).
  - **REMAINING — Phase 3 (separate, not done):** apply the same layer treatment to the *container-internal* sub-stack in `equipment-container.ts` `render()` (frame → contained equipment → transformers → IEDs → handles → drop-targets, lines ~299–349). These are the nested sub-layers; lower priority than the cross-cutting moves below.
  - **The `Layer` naming convention.** Use the `…Layer` suffix **only** where a method renders a *band* whose position in the call sequence is z-critical — i.e. reordering the call would visibly change what sits on top (`renderConnectivityLayer`, `renderLabelLayer`, `renderPlacingTargetsLayer`, `renderConnectionPreviewLayer`, `renderResizeOverlayLayer`, …). Do **not** suffix per-element artifact renderers (`renderEquipment`, single-element `renderLabel`) or order-independent helpers — they render one thing in one spot and make no stacking claim. Rule of thumb: *if reordering the call would change the picture, it's a `Layer`; if it only draws one item in a place, it isn't.* The word `Layer` is a signal to the reader "this is a distinct stacking level — when it is called (the order) is crucial."
  - **Layers nest (two scales).** Not everything is a flat substation-root band. The **container** subtree (`equipment-container.ts`) is itself an internal z-stack (frame → contained equipment → transformers → IEDs → handles → drop-targets, lines ~299–349) — those are *sub-layers*. Contained equipment is painted *inside* its container's `<g>`, not as a flat top-level band, so the layer model applies recursively rather than flattening everything to the root.
  - **Invariants (this is a behaviour-preserving extraction).** (1) The call order in `render()` must match the current emit order **exactly**. (2) Each layer method must preserve its *internal* order (e.g. non-busbar connectivity nodes before busbar nodes — the deliberate split at `sld-substation-editor.ts:693–714` exists purely so busbars paint on top). The existing integration specs guard the structural order; a wrong reorder makes elements silently vanish under one another.
  - **Two problems this framing resolves along the way (so they need no separate tracking):**
    - *An earlier worry — "if I extract a `renderSubstationContents` sub-method, how does it get the SVG the other sub-methods produced? Pass it in as arguments, or have it call them itself?" — no longer applies.* That dilemma only exists if the bands depend on each other's output. They don't: every layer reads from the SCL document independently and emits its own SVG, and nothing consumes another layer's result. So `render()` is just a flat list of independent layer calls in paint order — no layer passes anything to another. (This supersedes the older sketch that proposed a single `renderSubstationContents` method with that dependency question attached.)
    - *The two near-identical connectivity-node passes at `sld-substation-editor.ts:693–714` (one filters `!isBusBar`, the next `isBusBar`, split only so busbars paint on top) are **not** a separate cleanup item.* Collapsing them into one block with an explicit "busbars last" stable ordering is simply part of building `renderConnectivityLayer` — it happens as a side effect of the extraction, not as its own task.
- [x] **Split `equipment-container.ts` internal render stack into named sub-layers.** DONE: extracted the nested container stack into named helpers while keeping the wrapper `<g>` in the parent template to preserve SVG DOM composition. Paint order remains unchanged: highlight/frame → child containers → equipment → transformers → IEDs → preview connectivity → preview labels → resize handles → placing target → resizing target. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`476 passed, 0 failed`), and `npm run format`.
- [x] **Skip idle mouse-coordinate-only re-renders.** DONE: `SldSubstationEditor.shouldUpdate()` now skips updates while idle when the only changed properties are `mouseX/mouseY/mouseX2/mouseY2/mouseX2f/mouseY2f`. The stored mouse state is still updated on every move and remains load-bearing during active gestures, so previews continue to follow the cursor. Gesture-*start* handlers compute their coordinate input from the live click event via shared `gridPosition(event)` / `halfGridPosition(event)` context helpers. Synthetic zero-coordinate tests still fall back to stored mouse state to preserve existing test ergonomics, but real pointer events use event-time coordinates.
  - **Step 1 (prerequisite): DONE.** Gesture-start offsets for containers, busbars/connectivity nodes, power transformers, and labels now read live event-time coordinates. Focused artifact specs assert offset calculation from `clientX`/`clientY`. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`476 passed, 0 failed`), and `npm run format`.
  - **Step 2 (payoff): DONE.** Added focused `SldSubstationEditor` update-scheduling specs for idle mouse-coordinate-only skips, active mouse-coordinate updates, and idle non-mouse updates. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`479 passed, 0 failed`), and `npm run format`.
  - Caveat to weigh: event-time reading relocates (does not remove) the screen→grid transform + the three quantizations (`floor` / `round-to-half` / `floor-to-half`), and makes those handlers depend on receiving the event. Each step wants its own tests.
- [x] Clean up structural conventions opportunistically — reviewed: code already satisfies the repo's enforced conventions (no one-liner `if`s, consistent `SldArtifactDescriptor` shape, co-located specs, consistent `render*`/`handle*` naming). Import grouping is intentionally left as-is (the repo's `import-x` ESLint config enforces no import-order rule).
- [x] Consolidate remaining duplicated test fixtures/helpers — added `sldFixture({ vl, bay, bayName, children })` to `test-helpers.ts`; migrated the 6 artifact specs sharing the `Substation > VoltageLevel > Bay` scaffold (container, conducting-equipment, power-transformer, label, bus-bar, connectivity-node) to it. `ied-reference`/`highlight` keep bespoke fixtures (different shapes).
- [ ] **Review the names of `sld-editor.ts` (`SldEditor`) and `sld-substation-editor.ts` (`SldSubstationEditor`).** The names misrepresent the responsibilities:
  - `SldEditor` is the **controller / interaction state-machine** for the whole diagram. It renders one `SldSubstationEditor` per `:root > Substation` and broadcasts the single active gesture (`placing`/`resizingBR`/`resizingTL`/`placingLabel`/`connecting`) down to all of them. It intercepts the gesture events bubbling up, and on completion **builds the `EditV2` document edits and dispatches `newEditEventV2` upward** to the OpenSCD host (which actually applies them). It owns the promise-based placement API.
  - `SldSubstationEditor` is, for the most part, a **per-substation view**: it renders one substation's subtree to SVG for the current gesture and reports raw user gestures back to its parent. It owns almost no durable state (only transient mouse coordinates).
  - In MVC terms, `SldEditor` ≈ **Controller**, `SldSubstationEditor` ≈ **View** — i.e. the current names are roughly inverted. This seam is also the future **viewer / editor / plugin** module split (the render-only view = viewer; the gesture+edit layer = editor). Candidate renames to weigh: `SldSubstationEditor` → `SldSubstationView`/`SldSubstationCanvas`; `SldEditor` → a controller-flavoured name. Park as its own deliberate cross-file rename (not mid-`render()` work).

- [ ] **Make the interaction modes an explicit `Mode` enum, then drive overlay-layer composition declaratively by mode.** (Depends on the layer extraction above being finished — you can only compose layers by mode once they exist as named `render*Layer()` units.) Today the five interaction modes live as separate scattered properties on `SldEditor` (`placing`/`resizingBR`/`resizingTL`/`placingLabel`/`connecting`) plus an `idle` getter; the editor is always in exactly one mode but that is never expressed as a single value. Each overlay layer self-gates on mode (e.g. `renderConnectModeEquipmentLayer` opens with `if (!connecting) return nothing`; `placingTarget` is `nothing` unless placing a VL; `connectionPreview` is empty unless connecting). The proposal: replace the booleans with one discriminated `Mode` enum (`Idle | Placing | PlacingLabel | ResizingBR | ResizingTL | Connecting`) and hoist the per-layer gating into one place that declares, per mode, *which overlay layers render and in what z-order* — so at a glance you can read "in `Connecting` mode we paint X, then Y, then Z." This also helps the idle-render-skip workstream (a `shouldUpdate` can simply test `mode === Idle`).
  - **Two traps to avoid (the model is NOT "a full layer stack per mode"):**
    1. *Base vs overlays.* Most layers render in **every** mode — VLs, connectivity, transformers, IEDs, labels are the static diagram, always painted. Only a handful are mode-specific overlays (connection preview, connect-mode equipment, placing targets, ghost). So the real shape is **`base stack + overlays(mode)`**, not a distinct stack per mode. Enumerating every layer in every mode would duplicate the base across all six modes.
    2. *Some always-on layers are parameterised by mode internally.* The container layer (`renderVoltageLevelLayer`) renders in all modes, but its content changes by mode (draws inner drop-zones, highlights, filters the dragged subtree — all via context flags passed down). So mode-composition cleanly handles the **pure overlays** but does **not** remove the context-flag plumbing into the always-on layers.
  - **Per-mode relevance is not universal.** `Connecting` is relevant only to the **source** substation (`connecting.from.closest('Substation') === this.substation`), so a per-substation "effective mode" getter can downgrade to `Idle` there. But **`Placing` is relevant to ALL substations** — a brand-new element belongs to no substation yet, so every editor offers itself as a drop target (ties back to Q1). So the relevance rule is per-mode, not a single "is this our gesture?" gate.
  - **Trade-off being made:** self-gating layers (today) optimise for layer **independence** (each is standalone/testable); a central mode→layers dispatcher optimises for **seeing the whole ordered composition at once**, at the cost of coupling the dispatcher to every layer. Given that "z-order is the design", the legibility win is judged worth the coupling here.

- [ ] **Consider extracting the coordinate tooltip into its own web component (option worth further consideration, not yet decided).** `renderCoordinateTooltip()` has two separable concerns: (1) **content** — `coordinates`/`invalid`/`hidden`, derived from gesture state + the live doc via `canPlaceAt`/`canResizeTo` (belongs computed in the parent — see the "don't cache derived state" decision); (2) **position** — set *imperatively* by `positionCoordinates()` (sld-substation-editor.ts:233-238) poking `style.top/left` through `coordinatesRef`, wired to a window `click` listener (:314) and the svg `mousemove` (:452). That imperative screen-space positioning is the actual awkward part.
  - **Option A — dumb presentational component** (`<sld-coordinate-tooltip .coordinates .invalid .hidden>`, parent computes & passes in): LOW merit. It's a `<div>` + `classMap`; adds scoped-element boilerplate for ~no encapsulation, and the parent would then have to reach into the child's shadow DOM to position it (worse).
  - **Option B — self-contained cursor-follow tooltip** (the component owns its own pointer tracking + positioning; parent feeds only content): MODERATE, genuine merit. Deletes `coordinatesRef`, `positionCoordinates`, and the two listener wirings from the parent, moving the imperative DOM-poking inside the widget as a private detail. Win is separation-of-concern, not line count (~neutral).
  - **Latent smell this would also fix:** the tooltip is rendered PER SUBSTATION, so with N substations there are N tooltip `<div>`s and **N window `click` listeners** (all tracking the same single cursor; only one is ever non-`hidden`). The cleaner design is ONE tooltip owned by the parent `SldEditor` (one cursor → one tooltip → one listener) — which Option B, hoisted to `SldEditor`, would naturally enable.
  - This is a STRUCTURAL change (new component + test surface, possibly relocating to `SldEditor`) — a different category from the behaviour-preserving `render()` method extraction. Park separately.

- [ ] **GUIDING PRINCIPLE for the viewer/editor split — the edit-vs-view litmus test.** When deciding where an operation belongs, ask: *does it produce an `EditV2` (mutate the SCL document)?* → it belongs in the **editor/controller** layer (`SldEditor`). *Does it read/serialise the rendered view?* → it belongs in the **view** layer (`SldSubstationEditor`). This is the rule that should drive the eventual `viewer / editor / plugin` module split. Confirmed state of the four `renderHeader` buttons against this test:
  | button | what it does | belongs to | status |
  |---|---|---|---|
  | **Resize dialog** | builds `updateSLDAttributes` → `newEditEventV2` | controller | **✅ hoisted to `SldEditor` via `<sld-resize-substation-dialog>`** |
  | **Delete** | `newEditEventV2({ node: substation })` | controller | borderline; already a complete edit dispatched directly — lower priority |
  | **Edit** | `newSclEditDialogEvent(substation)` (already an event) | host/controller | already fine |
  | **Export** | serialises `this.sld` (the rendered `<svg>` in the view's shadow DOM) via `exportSVG` | **view** | **correctly placed — leave it** |
  Evidence the controller already owns edits: `sld-editor.ts` handles `@oscd-sld-resize`/`-resize-tl`/`-place`/`-place-label`/`-connect`/`-rotate` and dispatches `newEditEventV2` (see `createResizeEdits`/`createResizeTLEdits` etc.). The resize *dialog* is the lone edit-producing operation still committed directly from the view.

- [x] **Hoist the resize dialog up to `SldEditor` (controller), out of the per-substation view.** (User's idea, agreed.) **DONE** via the dedicated-component option (b): extracted `src/sld-resize-substation-dialog.ts` (`<sld-resize-substation-dialog .substation>`), owned as a SINGLE instance by `SldEditor`.
  - `SldSubstationEditor`: the header "Resize" button now fires a bubbling/composed `oscd-sld-resize-substation` event carrying the substation (replaces the local `this.resizeSubstationUI.open = true`). Removed the local `renderResizeDialog()`, the `@query` fields `resizeSubstationUI`/`substationWidthUI`/`substationHeightUI`, and the now-unused `OscdDialog`/`OscdTextButton`/`OscdOutlinedTextField` imports + scoped registrations + `updateSLDAttributes` import.
  - `SldEditor`: registers `<sld-resize-substation-dialog>` once; `connectedCallback` listens for `oscd-sld-resize-substation` and calls `resizeDialog.show(substation)`. The dialog owns the width/height form + `canResizeTo` validation, and on confirm emits a single `oscd-sld-resize` event (reusing the existing `ResizeEvent`). `SldEditor`'s extracted `resizeElement(element, w, h)` handler builds + dispatches `createResizeEdits` → `newEditEventV2`, so the resize edit now flows through the **same path as drag-resize** (`createResizeEdits` is exactly `updateSLDAttributes(el, nsp, {w,h})`).
  - Contract chosen: input = `substation`; output = one `oscd-sld-resize` domain event (controller builds the `EditV2`). This consolidates with the drag-resize edit path rather than dispatching `newEditEventV2` from the view.
  - Tests: added `src/sld-resize-substation-dialog.spec.ts` (open-populated, valid-resize-emits, unchanged-no-op, forbids-undersizing); updated the two `sld-editor.spec.ts` integration tests to drive through `element.resizeDialog`.
  - **Open implementation choice (decided):** went with (b) the dedicated component (cleanest contract: input = substation, output = one resize event).

- [ ] **`renderHeader` → `<sld-substation-header>` component (candidate, genuinely per-substation, NOT a hoist).** Unlike the dialog/tooltip, the header is legitimately per-substation (each substation has its own name + edit/delete/resize/export buttons), so it does NOT collapse to a single instance. Clean contract: inputs = name + disabled; outputs = edit / delete events. Two couplings to resolve when promoting: "Resize" reaches a sibling (`resizeSubstationUI.open` — resolved once the dialog hoist above makes it a `resize-substation` event), and "Export" calls `handleExport()` (which stays a view concern — the component can keep it or re-emit; export reads `this.sld`). Lower priority than the dialog hoist; the `renderHeader()` method extraction is already the stepping-stone.

## Current File Layout

### Root & Editor

- `src/oscd-editor-sld.ts` (210 lines) — Thin plugin orchestrator: lifecycle, namespace detection, event wiring between toolbar and editor
- `src/sld-editor.ts` (402 lines) — Editing kernel: placement state machine, resize, connect, rotate. Promise-based `startPlacing()` API. Owns the single `<sld-resize-substation-dialog>` instance.
- `src/sld-substation-editor.ts` (~1029 lines) — SVG rendering orchestration + context menu delegation. `render()` is now a paint-order layer stack of `render*` sub-methods. Future split target for viewer extraction.
- `src/sld-resize-substation-dialog.ts` (150 lines) — Self-contained substation resize dialog (width/height form + `canResizeTo` validation). Input: `.substation`; output: a single `oscd-sld-resize` event. Owned by `SldEditor`.

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
- `src/drawing/artifacts/equipment-container.ts` — Equipment-container renderers for `VoltageLevel`/`Bay`. Exports thin `renderVoltageLevel(vl, context, preview)` (renders the VL then its non-busbar bays) and `renderBay(bay, context, preview)`; both delegate to a shared module-private `render(element, context, preview, kind, childContainers)` doing placement/resize math, resize handles, highlight, and fan-out to child renderers. A `ContainerKind` (`voltageLevelKind`/`bayKind`) supplies the few VL/Bay differences (className, stroke, dash, placing-child tag, placement-parent resolution). `EquipmentContainerContext` carries `highlight`, `mouseX/Y`, `nsp`, `resizingBR/TL`, `svgCoordinates`, and child-render callbacks (`renderEquipment`, `renderPowerTransformer`, `renderIed`, `renderConnectivityNode`; `renderLabel` from the shared context).
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

| Event                   | Detail                         | Purpose                                      |
| ----------------------- | ------------------------------ | -------------------------------------------- |
| `start-placing`         | `{ element }`                  | Equipment/structural/transformer FAB clicked |
| `start-placing-typical` | `{ bayTypical, ieds }`         | Bay typical imported (from ied-importer)     |
| `view-change`           | `{ showLabels, showIeds }`     | Toggle labels or IED visibility              |
| `zoom`                  | `{ direction: 'in' \| 'out' }` | Zoom in/out                                  |
| `cancel`                | —                              | Cancel action                                |

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

Latest verification after the `render()` layer decomposition (Phase 1 + 2 + E):

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `470 passed, 0 failed` (behaviour preserved — pure method extraction, no z-order change).
- `SldSubstationEditor.render()` is now a short paint-order stack of 13 extracted `render*` methods (see the layer-strategy checklist item near the top). The file grew slightly to ~1150 lines purely from the extra method headers/doc comments; `render()` itself dropped from ~483 lines to a readable stack.
- Remaining: Phase 3 (container-internal sub-layers in `equipment-container.ts`), the resize-dialog hoist, and the header/tooltip component candidates — all logged as workstream items above.

Latest verification after the resize-dialog hoist:

- Extracted `src/sld-resize-substation-dialog.ts` (`<sld-resize-substation-dialog>`), owned as a single instance by `SldEditor`.
- `SldSubstationEditor` header "Resize" button now fires `oscd-sld-resize-substation`; removed the local dialog, its three `@query` fields, and the now-unused `OscdDialog`/`OscdTextButton`/`OscdOutlinedTextField`/`updateSLDAttributes` imports + scoped registrations. `sld-substation-editor.ts` reduced ~1150 → ~1029 lines.
- The dialog emits one `oscd-sld-resize` event; `SldEditor.resizeElement()` consolidates it with the drag-resize edit path (`createResizeEdits` → `newEditEventV2`).
- Added `src/sld-resize-substation-dialog.spec.ts`; updated the two `sld-editor.spec.ts` substation-resize integration tests to drive through `element.resizeDialog`.
- **Behaviour correction (latent bug) + UX enhancement:** the old `renderResizeDialog` relied on mwc-style `autoValidate` + `validityTransform` on the text fields to forbid undersizing — but `OscdOutlinedTextField` is Material Web 3 and silently ignores those APIs, so the bound was never enforced; the old "forbids undersizing" test passed only because it clicked a non-matching `slot="primaryAction"` selector (confirm never fired). The new component feeds the substation-bounds rule into the **standard constraint-validation API** (`setCustomValidity` + `reportValidity()` — Material suppresses the native popup via `invalidEvent.preventDefault()`), validating live on `@input` so the inline error appears/clears immediately, and gating `confirm()` on the result. Each field is checked against the other dimension's committed value so the error is attributed to the dimension the user undersized; persistent `supporting-text` gives guidance before any error.
- Maintainer verified the resize-dialog hoist; the implementation is complete.

## Edit Builder Extraction — Complete

Edit builders extracted from `sld-editor.ts` (848 → 369 lines, now 402 after placement API).
`sld-editor.ts` is now a thin orchestrator (state + event routing + promise-based placement),
while edit-building logic lives as pure functions in `foundations/`.

### Foundations Structure Assessment

Current files are well-grouped by domain concept:

| File                    | Lines | Responsibility                                                                  | Notes        |
| ----------------------- | ----- | ------------------------------------------------------------------------------- | ------------ |
| `geometry.ts`           | 118   | Pure math (Rect, Point, contains, overlaps)                                     | ✅           |
| `element-geometry.ts`   | 37    | Bridges geometry ↔ SCL elements                                                 | ✅           |
| `sld-placement.ts`      | 132   | Validation (`canPlaceAt`, `canResizeTo`)                                        | ✅ read-only |
| `equipment.ts`          | 38    | Type constants & guards                                                         | ✅           |
| `transformer.ts`        | 258   | Rendering geometry for windings                                                 | ✅           |
| `sld-attributes.ts`     | 177   | Read/write SLD namespace attributes                                             | ✅           |
| `events.ts`             | 214   | Custom event factories & types                                                  | ✅           |
| `export.ts`             | 98    | XML pretty-print & download                                                     | ✅           |
| `ied.ts`                | 74    | IED resolution + one edit builder                                               | ✅           |
| `connectivity.ts`       | 106   | Read-only queries (`isBusBar`, `busSections`, `connectionStartPoints`)          | ✅ pure      |
| `connectivity-edits.ts` | 334   | Edit builders (`removeNode`, `removeTerminal`, `reparentElement`, `uniqueName`) | ✅           |
| `edits.ts`              | 838   | Pure edit builders (ground, flip, delete, copy, connect)                        | ✅           |

`connectivity.ts` mixes read-only queries (`isBusBar`, `connectionStartPoints`,
`busSections`) with edit builders (`removeNode`, `removeTerminal`, `reparentElement`,
`makeBusBar`). A future pass could move the edit builders into `edits.ts`, leaving
connectivity as purely read-only. Not a prerequisite for the current work.

## Toolbar Extraction — Complete

The root component's ~500-line `render()` was decomposed into three components:

| Before                                           | After                                           |
| ------------------------------------------------ | ----------------------------------------------- |
| `oscd-editor-sld.ts` 784 lines, ~500-line render | `oscd-editor-sld.ts` 210 lines, ~40-line render |
| 6 repetitive transformer FAB blocks              | Data-driven `TransformerConfig[]` array         |
| IED menu logic embedded in render                | Self-contained `<sld-ied-menu>` component       |
| Bay typical import mixed into root               | Self-contained `<sld-ied-importer>` component   |
| `placingBayTypical` special state                | Promise-based `startPlacing()` with async/await |
| About dialog in root                             | Toolbar-internal (no event needed)              |
| `insertSubstation` in root                       | Toolbar-internal (dispatches `EditV2` directly) |
| 10 verbose `sld-toolbar-*` events                | 5 clean short-name events                       |

## Connectivity Boundary Split — Complete

`connectivity.ts` (433 lines) separated into:

| File                    | Lines | Responsibility                                                                                                                     |
| ----------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `connectivity.ts`       | 106   | Pure read-only queries (`isBusBar`, `busSections`, `connectionStartPoints`, `connectivityPath`, `makeBusBar`). No `EditV2` import. |
| `connectivity-edits.ts` | 334   | Edit builders (`removeNode`, `removeTerminal`, `reparentElement`, `uniqueName`) + private helpers                                  |

`connectivity.ts` is now a clean read-only module suitable for the future viewer package — it
has no dependency on `EditV2`, `@openscd/scl-lib`, or `./ied.js`.

## `sld-substation-editor.ts` Analysis — The Elephant (2,173 lines)

This is the single largest file and the future viewer extraction target. It mixes three
concerns: SVG rendering, interaction state, and edit dispatch.

### Structural breakdown

| Method/Section               | Lines | %   | Responsibility                                                                                                 |
| ---------------------------- | ----- | --- | -------------------------------------------------------------------------------------------------------------- |
| `render()`                   | 483   | 22% | Main diagram composition — placing targets, connection preview, grid, mouse tracking, substation resize dialog |
| `renderEquipment()`          | 251   | 12% | Single ConductingEquipment SVG symbol + click/context handlers                                                 |
| `renderContainer()`          | 251   | 12% | Bay or VoltageLevel rect + children + resize handles                                                           |
| `renderConnectivityNode()`   | 215   | 10% | Connection polylines between terminals                                                                         |
| `renderTransformerWinding()` | 116   | 5%  | Winding circles + ports                                                                                        |
| `renderLabel()`              | 115   | 5%  | Text labels with positioning logic                                                                             |
| `renderPowerTransformer()`   | 101   | 5%  | Transformer windings composition                                                                               |
| `renderIed()`                | 84    | 4%  | IED reference badges                                                                                           |
| `renderBusBar()`             | 45    | 2%  | Busbar lines                                                                                                   |
| Properties/state/lifecycle   | ~170  | 8%  | 30+ properties, mouse state, coordinate transforms                                                             |
| Utility methods              | ~90   | 4%  | `svgCoordinates`, `nearestOpenTerminal`, `groundTerminal`, `handleExport`                                      |
| Top-level helpers            | ~80   | 4%  | `isBay`, `isSelectable`, `getHighlightStyle`, `transformerHighlight`                                           |
| `static styles`              | ~75   | 3%  | CSS                                                                                                            |

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

| New module                                  | Contains                                                               | Lines |
| ------------------------------------------- | ---------------------------------------------------------------------- | ----- |
| `drawing/artifacts/conducting-equipment.ts` | ConductingEquipment artifact descriptor: state, actions, SVG rendering | ~460  |
| `drawing/artifacts/artifact.ts`             | Shared artifact descriptor/context types                               | ~60   |
| `drawing/artifacts/equipment-container.ts`  | Bay/VoltageLevel artifact descriptor                                   | ~250  |
| `drawing/artifacts/connectivity-node.ts`    | ConnectivityNode artifact descriptor                                   | ~215  |
| `drawing/artifacts/power-transformer.ts`    | PowerTransformer + TransformerWinding artifact descriptor              | ~220  |
| `drawing/artifacts/label.ts`                | Label artifact descriptor/helper                                       | ~115  |
| `drawing/artifacts/ied-reference.ts`        | IED reference artifact descriptor: state, actions, SVG rendering       | ~185  |
| `drawing/artifacts/bus-bar.ts`              | BusBar artifact descriptor                                             | ~45   |

Current descriptor shape:

```typescript
type SldArtifactDescriptor<TState, TActions> = {
  matches(element: Element): boolean;
  state(element, context, options?): TState | undefined;
  actions(element, context, state): TActions;
  render(element, state, actions, context, options?): SVGTemplateResult;
};
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

| Type                      | Owner module                        | Fields                                                                                                                                                                     |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SldSharedContext`        | `artifacts/artifact.ts`             | `disabled`, `dispatch`, `idle`, `openContextMenu`, `placing`, `placingLabel`, `renderLabel`, `renderedPosition`, `selectable`, `substation`, `view` (used by ≥2 artifacts) |
| `EquipmentContext`        | `artifacts/conducting-equipment.ts` | shared + `connecting`, `resizingTL`, `resizingBR`, `nearestOpenTerminal`, `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nsp`                                         |
| `PowerTransformerContext` | `artifacts/power-transformer.ts`    | shared + `connecting`, `resizingTL`, `resizingBR`, `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nsp`                                                                |
| `LabelContext`            | `artifacts/label.ts`                | shared + `mouseX2`, `mouseY2`, `renderedLabelPosition`                                                                                                                     |
| `BusBarContext`           | `artifacts/bus-bar.ts`              | shared + `renderConnectivityNode`                                                                                                                                          |
| (ied-reference)           | uses `SldSharedContext` directly    | —                                                                                                                                                                          |

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

| Consumer                   | Uses                                                                      |
| -------------------------- | ------------------------------------------------------------------------- |
| `sld-toolbar.ts`           | SLD entity/action icons for FAB `slot="icon"`                             |
| `sld-context-menu.ts`      | SLD entity/action icons for menu/list `slot="start"`                      |
| `sld-substation-editor.ts` | Diagram `<defs>`, resize paths, transformer paths, equipment symbol paths |

Phase B resolves this by deleting `icons.ts`:

- `src/drawing/diagram-symbols.ts` owns diagram renderer SVG primitives.
- `src/oscd-sld-icon.ts` owns SLD UI icon names and rendering for toolbar/context-menu slots.

## Remaining Work

### Near-term (before module split)

1. ~~**Extract diagram symbols (Phase B)**~~ — Done. SVG defs/resize paths live in
   `drawing/diagram-symbols.ts`; UI icon ownership lives in `OscdSldIcon`.
2. ~~**Extract SVG renderers (Phase A)**~~ — Mostly done. The core artifact
   renderers now live under `drawing/artifacts/` with co-located specs. The
   remaining renderer cleanup is the lower-risk `equipment-container.ts`
   internal sub-layer split tracked above.
3. **Separate interaction from rendering (Phase C)** — Create viewer/editor
   boundary. This should wait until the current layer, mode, and idle-render
   workstreams settle.
4. ~~**`connectivity.ts` boundary**~~ — Done. Split into queries + edit builders.
5. ~~**Clean up structural conventions**~~ — Reviewed as done; no broad import-order
   churn needed because the repo does not enforce import ordering.
6. ~~**Consolidate test fixtures/helpers**~~ — Done for the repeated artifact SLD
   scaffolds via `sldFixture()` in `test-helpers.ts`.
7. **Expose themable artifact colours as CSS variables.** Hardcoded colours such
   as the equipment top-indicator `#BB1326` should eventually become CSS custom
   properties so plugin/future-module consumers can theme the rendered diagram.

### Future (module split preparation)

1. Define viewer API boundary (SCL Element in, SVG + events out)
2. Identify which foundations belong to viewer vs editor
3. Design edit event API for editor → plugin communication
4. Decide whether SLD UI icons should eventually merge into oscd-ui/SCL icon registries
