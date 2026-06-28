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

## Planned Workstreams

The single source of truth for open work, listed in priority order (highest
first). There is no separate "next steps" list.

- [x] **Interaction-state consolidation (`SldEditor` controller / `SldSubstationViewer` view) — DONE (Phases 1–4 complete).** The single highest-value structural item, and the future viewer/editor/plugin seam. Before: the two components **duplicated the whole interaction-state model**: the same six gesture fields (`placing`, `placingOffset`, `placingLabel`, `resizingBR`, `resizingTL`, `connecting`), a byte-identical `interactionMode` getter, and the same inline `connecting` object shape — declared once as `@state` on `SldEditor` (the source of truth) and again as `@property` on `SldSubstationViewer` (a broadcast copy). `SldEditor.render()` then hand-bound all nine props down and wired thirteen gesture events back up. Now: a single owner of the interaction state, with the view receiving **one `.interaction` projection** instead of nine re-declared copies. Responsibilities (already reflected in the names):
  - `SldEditor` ≈ **controller / interaction state-machine**: owns the single active gesture, projects it to each per-substation view, intercepts gesture events bubbling up, and builds + dispatches the `EditV2`s (`newEditEventV2`) to the host. Owns the promise-based placement API.
  - `SldSubstationViewer` ≈ **per-substation view**: renders one substation's subtree to SVG for the current gesture and reports raw user gestures upward. Owns almost no durable state (only transient mouse coordinates).
  - **Agreed design (brainstorm settled):**
    - **State shape — discriminated union** keyed on `mode`, living in `foundations/interaction-mode.ts` (supersedes the `InteractionMode` string union, whose values become the `.mode` tags). Every active variant carries `element` as its subject; mode-specific extras hang off the variant. Makes illegal states unrepresentable and deletes the `interactionMode` getter:
      ```ts
      type Terminal = "T1" | "T2" | "N1" | "N2";
      type Interaction =
        | { mode: "idle" }
        | { mode: "placing"; element: Element; offset: Point }
        | { mode: "placingLabel"; element: Element; offset: Point }
        | { mode: "resizingBR"; element: Element }
        | { mode: "resizingTL"; element: Element }
        | {
            mode: "connectingFrom";
            element: Element;
            terminal: Terminal;
            path: Point[];
          };
      ```
      (`connecting` → `connectingFrom`; its `from` → `element`, `fromTerminal` → `terminal`; `path` stays as a mode-specific extra, NOT transient. `placingLabel` **does** carry an `offset` — the grab point computed in `drawing/artifacts/label.ts` and read by the view's `renderedLabelPosition`; an earlier note that it had no extras was inaccurate.)
    - **Ownership & reactivity — `@state() interaction` on `SldEditor` + pure variant constructors in `foundations/interaction-mode.ts`** (e.g. `placing(element, offset): Interaction`). These are typed one-line constructors for each union variant — the *value* side of the state machine only (no DOM, events, or promises); the component's `start*` methods keep their side effects and just assign the result, so Lit reactivity is automatic via the `@state` setter and the constructors are unit-testable without a DOM (matching the repo convention of pure logic in `foundations/`, thin components). Mode exclusivity becomes free — assigning a new variant clears the others. **Deliberately NOT** a single `transition(state, action)` reducer or a `ReactiveController` yet (YAGNI); reserve the reducer as a future step *if* transition guards accumulate (e.g. "only append a point while connecting").
    - **Boundary — cursor state stays view-local.** `mouseX/Y`, `mouseX2/Y2`, `mouseX2f/Y2f` remain per-substation on the view, NOT in the shared `Interaction`.
    - **Channels — downward collapses, upward stays.** The 9 hand-bound downward props become a single `.interaction` property; the 13 upward gesture events are unchanged (that is the view→controller channel — the view reports intent, the controller owns the transition).
  - **Migration is behavior-preserving and guarded** by the existing exclusivity invariant test in `sld-editor.spec.ts`. Verify each step with `tsc --noEmit` + `npm run test` + `npm run format`. Incremental phases:
    - [x] **Phase 1 — additive:** `Interaction` union + `Terminal` type + pure constructors (`idle`, `placing`, `placingLabel`, `resizingBR`, `resizingTL`, `connectingFrom`, `appendConnectionPoint`) added to `foundations/interaction-mode.ts` alongside the still-present `InteractionMode` string union, with a DOM-free `interaction-mode.spec.ts`. No behavior change (502 tests pass).
    - [x] **Phase 2 & 3 (merged) —** `SldEditor` owns a single `@state() interaction`; `reset()`/`start*` assign variants; deleted the `interactionMode` getter (use `this.interaction.mode`). Same change collapsed the downward channel: `render()` passes one `.interaction`; `SldSubstationViewer` replaced its 6 re-declared `@property` fields (and `placingOffset`) with one `interaction` `@property` plus read-only derived getters (`placing`/`placingOffset`/`placingLabel`/`resizingBR`/`resizingTL`/`connecting`) that keep the old names/shapes so the entire render surface, view context objects, and `drawing/artifacts/*` stay untouched. `SldEditor` carries the same derived getters so `oscd-editor-sld.spec.ts` and other read-sites need no change. Behaviour-preserving; verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`502 passed, 0 failed`), and `npm run format`.
    - [x] **Phase 4 —** removed the now-unused `InteractionMode` string union (was only self-referenced) and tidied dead helpers: deleted the immutable `appendConnectionPoint` constructor + its spec (production grows the connect path by in-place array mutation + manual `requestUpdate()`, so the helper was dead — see future item below), and inlined the now-pointless `resetWithOffset()` delegator into its single caller (`oscd-editor-sld.ts` → `reset()`). Also deduplicated the `connecting` getter's return type in both components to reference the existing `StartConnectDetail` type instead of re-declaring its shape. Verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`499 passed, 0 failed` — the 3 dropped tests were `appendConnectionPoint`'s), and `npm run format`.
  - **Two minor smells deliberately left for separate follow-ups** (see future list): (a) the connect-path **in-place mutation + manual `requestUpdate()`** pattern in `sld-substation-viewer.ts`/`connectivity-node.ts` (load-bearing because Lit `@state` does not detect intra-array mutation); converting it to immutable reassignment is a behaviour-sensitive change, not a tidy. (b) `SldEditor`'s derived getters (`placing`/`placingLabel`/`resizingBR`/`resizingTL`/`connecting`) are now **test-only** — no internal production reads — kept for ergonomic spec assertions and editor/viewer symmetry.
  - Note: this did **not** end up subsuming the two smaller boundary findings below (the dead `nsp` in the view; the inline edit dispatch) — they remain open as separate items.
- [x] **Make the connect-path growth immutable (remove in-place array mutation). DONE.** While connecting, the path was grown by mutating the `Interaction`'s `path` array in place and calling `requestUpdate()` by hand (`sld-substation-viewer.ts` `renderConnectionPreviewLayer`, `drawing/artifacts/connectivity-node.ts`), which worked only because Lit `@state` does not detect intra-array mutation. Fixed by making the growth a pure, immutable reassignment owned by the controller rather than a view-side mutation. Added pure `extendConnectPointPaths(path, corner, ...rest): Point[]` in `foundations/geometry.ts` (returns a fresh, `cleanPath`-normalised array; never mutates the input) with DOM-free unit tests. The **view reports intent**: `renderConnectionPreviewLayer`'s waypoint click now computes the next path with `extendConnectPointPaths` and dispatches a new `oscd-sld-extend-connect-point` event (`foundations/events.ts`) instead of mutating + `requestUpdate()`; the **controller owns the transition**: `SldEditor.extendConnectPoint(path)` reassigns `this.interaction = connectingFrom(element, terminal, path)` so reactivity is automatic and the value is never mutated behind its back. `connectivity-node.ts`'s connect-on-click likewise builds the new path immutably and passes it in `newConnectEvent` (it already dispatched immediately, so no interaction reassignment is needed there). Behaviour-preserving — the click/preview ordering is unchanged (extend dispatched first, then the conditional connect). Verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`512 passed, 0 failed`), and `npm run format`.
- [ ] **Reconsider `SldEditor`'s test-only derived getters.** After the interaction-state consolidation, `SldEditor`'s `placing`/`placingLabel`/`resizingBR`/`resizingTL`/`connecting` getters have **no internal production readers** — they exist only so specs can assert `sldEditor.placing?.tagName` etc. Either keep them as a deliberate public read API (current choice — also keeps editor/viewer symmetric) or drop them and have the specs read `sldEditor.interaction` directly. Low priority; decide when next touching `sld-editor.spec.ts`.
- [x] **Fix the view's `nsp` prefix divergence / unify the defaults.** *(Original framing "remove the dead `nsp`" was inaccurate — the property is NOT dead.)* Three drifting defaults existed — root `'eosld'`, `SldEditor` `'eoscd'`, `SldSubstationViewer` `'esld'` — and the editor never forwarded `.nsp` to the view, which never detects it, so the view was permanently `'esld'`. The view **does** feed its `nsp` into reachable edit paths (`<sld-context-menu>` → `updateSLDAttributes`/`createFlipElementEdits`/`createAddTextEdit`; `copyElementForPlacement` during shift-click placing), and `setSLDAttributes` writes `setAttributeNS(sldNs, '${nsp}:${key}', …)` — so the **prefix** on view-built edits was `esld` while the rest of the document used the detected prefix. Same namespace **URI**, so all `getAttributeNS(sldNs, …)` reads (and every spec assertion) were unaffected — which is exactly why the suite (and the deliberate `nsp:'smth'` artifact-test prefix) never caught it: those guard against *hardcoded-prefix* assumptions, not a *mismatch* between two components' prefixes. Fix (Option A — wire honestly): editor now passes `.nsp=${this.nsp}` to `<sld-substation-viewer>`; all six default declarations replaced with a single shared `defaultSldNsPrefix = 'eosld'` constant in `foundations.ts` (the house prefix the root already propagates), killing the drift (incl. the root-vs-editor fallback divergence for docs lacking the namespace). Added two **prefix-aware** regression tests (`SLD namespace prefix forwarding` in `sld-editor.spec.ts`) that assert the *literal* prefix (red before → green after); updated the one pre-existing test that hardcoded `xmlns:eoscd` to reference the constant. Verified `tsc --noEmit`, `npm run test` (`501 passed, 0 failed`), `npm run format`.
  - **Follow-up (derive-from-doc, done) —** Option A's fix unified the *fallback literal* but still left two deeper smells the user flagged: the detect-and-declare logic was **byte-identical duplicated** in root (`oscd-editor-sld.ts`) and `SldEditor`, and `nsp` was stored/threaded as a `@property`/`@state` on six components even though it is a **pure projection of `.doc`** (never independently chosen) — the very copying that enabled the divergence bug. Refactored to derive on demand: `foundations.ts` now owns `sldPrefix(doc)` (pure read, single fallback site via `?? defaultSldNsPrefix`; `lookupPrefix` is O(1) in doc size) and `ensureSldNamespace(doc)` (the single, idempotent *writer* of the `xmlns` declaration). Root + `SldEditor` (the edit-owning document boundaries) call `ensureSldNamespace(this.doc)` once in `willUpdate('doc')`; all six components replaced their stored `nsp` field with `get nsp() { return sldPrefix(this.doc); }`. Removed the now-redundant downward `.nsp` bindings (root→toolbar, toolbar→ied-menu, editor→viewer) — each component derives identically from the *same* shared `.doc`, so divergence is structurally impossible and prop-threading is unnecessary. **Exception:** `sld-ied-importer.ts` has no main `.doc` (it parses a separate `bayTypicalDoc` template and needs the *destination* prefix), so it keeps a fed `.nsp` prop from the toolbar with `defaultSldNsPrefix` as its lone doc-less fallback. Behaviour-preserving; the prefix-forwarding regression tests stay green because divergence is now impossible by construction. Verified `tsc --noEmit`, `npm run test` (`501 passed, 0 failed`), `npm run format`.
  - **Follow-up (declaration-as-edit, done) — supersedes the eager `ensureSldNamespace` writer above.** The user flagged that calling `ensureSldNamespace(this.doc)` in `willUpdate('doc')` **mutates the document on load, outside the `EditV2` mechanism** — a domain-law violation ("persist changes as edits, never by mutating the document directly"), and semantically wrong: an SCL file with no SLD metadata should render at defaults and only acquire the namespace when the user *first writes* SLD content. Verified the eager declaration was never a correctness requirement — `handleEdit` uses `setAttributeNS`/`createElementNS` (no pre-declared prefix needed) and the `XMLSerializer` emits valid `xmlns:` declarations at save regardless. So the declaration is now a **tracked edit, bundled into the same commit as the first SLD-writing edit**, making it a single undoable step (one `undo` restores the original document byte-for-byte). `foundations/edits.ts` gained: `requiresSldNamespace(edit)` (true iff the edit sets an `attributesNS` entry in `sldNs` or inserts a node that is/contains `sldNs` content — removals are ignored, moot under the declaration guard), `declareSldNamespaceEdit(doc)` (a `SetAttributes` declaring `xmlns:${defaultSldNsPrefix}` on `documentElement`), and `withSldNamespace(doc, edits)` (prepends the declaration **iff** the doc doesn't already `lookupPrefix(sldNs)` *and* `requiresSldNamespace(edits)` — otherwise returns the input unchanged by reference). `ensureSldNamespace` deleted; both `willUpdate` declaration blocks removed (`SldEditor`'s `willUpdate` is now empty → deleted). **Enforcement is centralised at the plugin boundary:** `oscd-editor-sld` (the `.doc` owner) binds `@oscd-edit-v2=${this.normalizeEditsWithSldNS}` on **both** edit-capable children (`<sld-editor>`, `<sld-toolbar>`); the handler runs `withSldNamespace`, and if the edit changed, `stopPropagation()`s the original and re-dispatches the augmented edit **on the root**. Because the root is an *ancestor* of both children, the replacement bubbles root→shell and never re-enters the listener — **loop-free with no guard**. The root's own two edits (`insertIed`, `convertSldAttributes`) dispatch *above* the children, so they wrap with `withSldNamespace(this.doc, …)` directly at their sites. This means **no per-dispatch-site wrapping** in `sld-editor`/`sld-substation-viewer`/`sld-context-menu`/`sld-toolbar`/`sld-ied-menu` — they fire plain `newEditEventV2(...)` as before and stay namespace-agnostic (exactly what the viewer/editor split wants). Inverted the two "adds the SLD XML namespace on load" tests (now assert *absence* on load + empty `xmlEditor.past`); added a round-trip test (`oscd-editor-sld.spec.ts`): one child SLD edit ⇒ namespace declared + edit applied in a single commit (`past.length === 1`), then `undo()` ⇒ serialised doc identical to the pre-edit snapshot. **Caveat:** relies on bubble-phase ordering (verified: `@omicronenergy/oscd-shell` listens bubble-phase as the outermost ancestor, so the root sees every edit first) — would break only under a capture-phase host, which is against OpenSCD convention. Verified `tsc --noEmit`, `npm run test` (`502 passed, 0 failed`), `npm run format`.
- [ ] **Test-helper sharp edge: `getSldSubstationViewer` assumes a single viewer.** The spec helper uses `shadowRoot.querySelector('sld-substation-viewer')` (returns the *first*); the editor renders one viewer per `:root > Substation`. Safe for all current call sites (single-substation fixtures, or called before a 2nd substation exists), but a latent footgun — e.g. the `copies voltage levels on move handle shift click` test does `insertBefore(S2, S1)`, briefly rendering viewers in `[S2, S1]` order (it doesn't use the helper afterward). If/when the first genuine multi-viewer assertion is added, give the helper a **name/element-based selector** (`getSldSubstationViewer(editor, substation?)`) rather than a positional index, since document order is counterintuitive. Low priority; test-only.
- [ ] **Consolidate the hardcoded artifact colours (dedup now; theming later).** Not just a future-theming nicety — there are ~26 hardcoded colour literals for only three colours (`#BB1326`×15, `#12579B`×6, `#F5E214`×5), scattered across files, plus a casing inconsistency (`#BB1326` vs `#bb1326`). Step 1: hoist to shared named constants, killing the duplication and the casing drift. Step 2: expose them as CSS custom properties so plugin/future-module consumers can theme the rendered diagram.
- [ ] **Split `renderConnectionPreviewLayer` (76 lines).** Now the largest remaining `render*` method; extract the connection-polyline geometry into a small helper. Low priority.
- [ ] **Extract `renderHeader` → `<sld-substation-header>` component.** Lower risk, lower payoff; **do after the controller/rename work**, which settles the header's mixed contract. The header is legitimately per-substation (name + edit/delete/resize/export buttons), so it does NOT collapse to a single instance. Contract: inputs = name + disabled; outputs = edit / delete (controller) events; Export stays a view concern because it reads `this.sld` — keep it inside the component or re-emit.
- [ ] **Hoist the coordinate tooltip to a single parent-owned instance.** Still one `<sld-coordinate-tooltip>` per substation, each registering two `window` listeners (`pointermove` + `click`) — so 2N global listeners for N substations. Hoisting to `SldEditor` removes the per-substation instances/listeners, but only if the child→parent tooltip-state event stays simple and does not duplicate grid interaction state.
- [ ] **Normalize edit dispatch in `SldEditor.render()` (consistency).** Most gesture handlers delegate to named controller methods (`placeElement`, `connectEquipment`, `handleSubstationResize`), but `@oscd-sld-resize-tl` and `@oscd-sld-place-label` build + dispatch + `reset()` **inline in the Lit template**. Extract `resizeTLElement` / `placeLabelElement` so every edit follows the same controller-method pattern (per the edit-vs-view litmus test). May fold into the controller work above.
- [ ] **`SldSubstationViewer` (and the context menu it opens) dispatch `EditV2`s directly — route them through the editor in the split.** Surfaced while centralising SLD-namespace enforcement. The *view* layer currently builds and fires edits itself: `sld-substation-viewer.ts` has two direct sites (`groundTerminal` → `createGroundTerminalEdits`; the Delete-Substation header button → `{ node: substation }`), and `<sld-context-menu>` (opened *by* the viewer) dispatches ~26 edits via its factory (`sld-context-menu-factory.ts`). Per the edit-vs-view litmus test these all belong in the **editor/controller** layer; in the eventual read-only `oscd-sld-viewer` package the viewer must emit *intent* events and let `oscd-sld-editor` build the `EditV2`. The new namespace interceptor (root listening on `<sld-editor>` + `<sld-toolbar>`) **already covers these for free** today, because the events bubble through `<sld-editor>` — but that coverage depends on the current DOM nesting and masks the boundary violation. When the viewer is extracted, re-home these dispatches behind domain events. Note the Delete-Substation button is the same "borderline, already-a-complete-edit" case flagged in the litmus-test table below. Behaviour-preserving for now; this is a boundary/architecture item, not a bug.
- [ ] **Fixture cleanup follow-up.** Opportunistically, when touching the specs, review remaining hand-built SCL fixtures in `context-menu/sld-context-menu.spec.ts`, `foundations/edits.spec.ts`, `sld-editor.spec.ts`, and `oscd-editor-sld.spec.ts`. Many are scenario/integration fixtures or non-Bay shapes, so convert only where `sldFixture()` reduces noise without hiding important document shape.

## Completed Workstreams

- [x] **Rename `SldSubstationEditor` → `SldSubstationViewer` (tag `sld-substation-editor` → `sld-substation-viewer`, file `sld-substation-editor.ts` → `sld-substation-viewer.ts`).** Names-first, deliberately ahead of the interaction-state consolidation so the brainstorm uses unambiguous vocabulary. The child component is view-only (renders one substation to SVG, reports gestures upward, never builds an `EditV2`), so "Editor" was a misnomer that collided with its parent `sld-editor`. Chose **viewer** over "view"/"controller": it mirrors the edit→view / **editor→viewer** symmetry, matches the future npm-module API (`sld-editor` + `sld-viewer`, the latter delegating to 0..n `sld-substation-viewer`s), and avoids colliding with Lit's `ReactiveController` concept. `SldEditor` / `sld-editor` deliberately unchanged (it is the future editor; `oscd-editor-*` is the OpenSCD plugin-host namespace, not a duplicate). Mechanical rename of class/tag/file/import + spec helpers; verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`492 passed, 0 failed`), and `npm run format`.
- [x] **Make the base-layer / mode-layer split explicit in `render()` (interaction-mode vocabulary).** Replaced the misleading "overlay-layer composition" framing with a **base layer** (always present) vs **mode layer** (present only during one interaction mode) distinction — deliberately dropping "overlay", which wrongly implies a top tier when mode layers are interleaved at fixed z-positions (the VL placing target paints at the back, the connection preview in the middle). Documented this on `SldSubstationViewer.render()` (the stack is base + mode layers in paint order; order is load-bearing and must not change). Centralized the placing-suppression predicate — `this.placing && el.closest(this.placing.localName) === this.placing`, previously repeated in 5 sites — into a single named `isPartOfPlacingElement(element)` helper, naming the one way a base layer's appearance is parameterised by the placing mode (the placed element is suppressed in base layers and re-painted as the preview ghost; the position helpers shift it to follow the cursor). Behaviour-preserving; existing mode fields remain the single source of truth and `interactionMode` is used only for pure mode/idle questions. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`492 passed, 0 failed`), and `npm run format`.
  - **Earlier sub-steps (already in place):** `sld-editor.spec.ts` invariant test that the mode model is exclusive (exactly one active mode; each start method clears the others); and the derived `interactionMode` projection in `foundations/interaction-mode.ts` with getters on `SldEditor`/`SldSubstationViewer` (fields stay the source of truth; the getter answers `idle`/`shouldUpdate`).
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
- [x] **Split large SVG renderers only after lower-risk extractions — decompose `render()` into explicit, content-named _layer_ sub-renderers.** The agreed strategy (worked out in mentoring): because SVG has no `z-index`, **paint order _is_ the design** — the sequence in which children are emitted is exactly their stacking order (last-drawn wins). So `SldSubstationViewer.render()` (currently ~483 lines) should become a short, readable **stack of layer calls in paint order**, where the call order _is_ the documented z-order.
  - **✅ DONE (2026-06-19, all steps verified tsc + format + 470 tests green after each cut).** `SldSubstationViewer.render()` is now fully flattened: Part-1 is just the substation-dim destructure, and the body is a pure stack of `render*()` calls. Methods created (in paint order):
    `renderHeader` (h2 toolbar) · `renderVoltageLevelPlacingTarget` (VL drop-zone, back) · `renderVoltageLevelLayer` · `renderConnectionPreviewLayer` · `renderConnectModeEquipmentLayer` (renamed from the confusing `renderConnectEquipmentLayer`; + doc comment on the suppress-below/re-paint-on-top trick) · `renderConnectivityLayer` (collapsed the two busbar/non-busbar passes into one stable "busbars last" sort) · `renderPowerTransformerLayer` · `renderIedLayer` · `renderLabelLayer` · `renderPlacingTargetsLayer` (transformer/ied/label, front) · `renderPlacingPreview` (the ghost, top) · `renderCoordinateTooltip` (DOM overlay outside the `<svg>`, owns the placing/resizingBR/resizingTL invalid/hidden/coords math — no `Layer` suffix as it is not a z-band) · `renderResizeDialog`.
    The placing targets kept their deliberate TOP/BOTTOM z-split (VL target back; transformer/ied/label targets front) — preserved exactly, with comments. `handleExport` and `this.sld` left untouched (export is a view concern — see the litmus-test workstream below).
  - **Phase 3 later completed separately:** apply the same layer treatment to the _container-internal_ sub-stack in `equipment-container.ts` `render()` (frame → contained equipment → transformers → IEDs → handles → drop-targets, lines ~299–349). These are the nested sub-layers; tracked as its own completed checkbox below.
  - **The `Layer` naming convention.** Use the `…Layer` suffix **only** where a method renders a _band_ whose position in the call sequence is z-critical — i.e. reordering the call would visibly change what sits on top (`renderConnectivityLayer`, `renderLabelLayer`, `renderPlacingTargetsLayer`, `renderConnectionPreviewLayer`, `renderResizeOverlayLayer`, …). Do **not** suffix per-element artifact renderers (`renderEquipment`, single-element `renderLabel`) or order-independent helpers — they render one thing in one spot and make no stacking claim. Rule of thumb: _if reordering the call would change the picture, it's a `Layer`; if it only draws one item in a place, it isn't._ The word `Layer` is a signal to the reader "this is a distinct stacking level — when it is called (the order) is crucial."
  - **Layers nest (two scales).** Not everything is a flat substation-root band. The **container** subtree (`equipment-container.ts`) is itself an internal z-stack (frame → contained equipment → transformers → IEDs → handles → drop-targets, lines ~299–349) — those are _sub-layers_. Contained equipment is painted _inside_ its container's `<g>`, not as a flat top-level band, so the layer model applies recursively rather than flattening everything to the root.
  - **Invariants (this is a behaviour-preserving extraction).** (1) The call order in `render()` must match the current emit order **exactly**. (2) Each layer method must preserve its _internal_ order (e.g. non-busbar connectivity nodes before busbar nodes — the deliberate split at `sld-substation-viewer.ts:693–714` exists purely so busbars paint on top). The existing integration specs guard the structural order; a wrong reorder makes elements silently vanish under one another.
  - **Two problems this framing resolves along the way (so they need no separate tracking):**
    - _An earlier worry — "if I extract a `renderSubstationContents` sub-method, how does it get the SVG the other sub-methods produced? Pass it in as arguments, or have it call them itself?" — no longer applies._ That dilemma only exists if the bands depend on each other's output. They don't: every layer reads from the SCL document independently and emits its own SVG, and nothing consumes another layer's result. So `render()` is just a flat list of independent layer calls in paint order — no layer passes anything to another. (This supersedes the older sketch that proposed a single `renderSubstationContents` method with that dependency question attached.)
    - _The two near-identical connectivity-node passes at `sld-substation-viewer.ts:693–714` (one filters `!isBusBar`, the next `isBusBar`, split only so busbars paint on top) are **not** a separate cleanup item._ Collapsing them into one block with an explicit "busbars last" stable ordering is simply part of building `renderConnectivityLayer` — it happens as a side effect of the extraction, not as its own task.
- [x] **Split `equipment-container.ts` internal render stack into named sub-layers.** DONE: extracted the nested container stack into named helpers while keeping the wrapper `<g>` in the parent template to preserve SVG DOM composition. Paint order remains unchanged: highlight/frame → child containers → equipment → transformers → IEDs → preview connectivity → preview labels → resize handles → placing target → resizing target. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`476 passed, 0 failed`), and `npm run format`.
- [x] **Skip idle mouse-coordinate-only re-renders.** DONE: `SldSubstationViewer.shouldUpdate()` now skips updates while idle when the only changed properties are `mouseX/mouseY/mouseX2/mouseY2/mouseX2f/mouseY2f`. The stored mouse state is still updated on every move and remains load-bearing during active gestures, so previews continue to follow the cursor. Gesture-_start_ handlers compute their coordinate input from the live click event via shared `gridPosition(event)` / `halfGridPosition(event)` context helpers. Synthetic zero-coordinate tests still fall back to stored mouse state to preserve existing test ergonomics, but real pointer events use event-time coordinates.
  - **Step 1 (prerequisite): DONE.** Gesture-start offsets for containers, busbars/connectivity nodes, power transformers, and labels now read live event-time coordinates. Focused artifact specs assert offset calculation from `clientX`/`clientY`. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`476 passed, 0 failed`), and `npm run format`.
  - **Step 2 (payoff): DONE.** Added focused `SldSubstationViewer` update-scheduling specs for idle mouse-coordinate-only skips, active mouse-coordinate updates, and idle non-mouse updates. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`479 passed, 0 failed`), and `npm run format`.
  - Caveat to weigh: event-time reading relocates (does not remove) the screen→grid transform + the three quantizations (`floor` / `round-to-half` / `floor-to-half`), and makes those handlers depend on receiving the event. Each step wants its own tests.
- [x] Clean up structural conventions opportunistically — reviewed: code already satisfies the repo's enforced conventions (no one-liner `if`s, consistent `SldArtifactDescriptor` shape, co-located specs, consistent `render*`/`handle*` naming). Import grouping is intentionally left as-is (the repo's `import-x` ESLint config enforces no import-order rule).
- [x] Consolidate remaining duplicated test fixtures/helpers — added `sldFixture({ vl, bay, bayName, children })` to `test-helpers.ts`; migrated the 6 artifact specs sharing the `Substation > VoltageLevel > Bay` scaffold (container, conducting-equipment, power-transformer, label, bus-bar, connectivity-node) to it. Also migrated straightforward `sld-context-menu-factory.spec.ts` Bay/ConductingEquipment/PowerTransformer/Text scaffolds via a local `bayDoc()` wrapper, plus `sld-resize-substation-dialog.spec.ts`. `ied-reference`/`highlight` keep bespoke fixtures (different shapes).
  - **Follow-up:** review remaining hand-built SCL fixtures in `context-menu/sld-context-menu.spec.ts`, `foundations/edits.spec.ts`, `sld-editor.spec.ts`, and `oscd-editor-sld.spec.ts`. Many are scenario/integration fixtures or non-Bay shapes, so convert only where `sldFixture()` reduces noise without hiding important document shape.
- [x] **Hoist the resize dialog up to `SldEditor` (controller), out of the per-substation view.** (User's idea, agreed.) **DONE** via the dedicated-component option (b): extracted `src/sld-resize-substation-dialog.ts` (`<sld-resize-substation-dialog .substation>`), owned as a SINGLE instance by `SldEditor`.
  - `SldSubstationViewer`: the header "Resize" button now fires a bubbling/composed `oscd-sld-resize-substation` event carrying the substation (replaces the local `this.resizeSubstationUI.open = true`). Removed the local `renderResizeDialog()`, the `@query` fields `resizeSubstationUI`/`substationWidthUI`/`substationHeightUI`, and the now-unused `OscdDialog`/`OscdTextButton`/`OscdOutlinedTextField` imports + scoped registrations + `updateSLDAttributes` import.
  - `SldEditor`: registers `<sld-resize-substation-dialog>` once; `connectedCallback` listens for `oscd-sld-resize-substation` and calls `resizeDialog.show(substation)`. The dialog owns the width/height form + `canResizeTo` validation, and on confirm emits a single `oscd-sld-resize` event (reusing the existing `ResizeEvent`). `SldEditor`'s extracted `resizeElement(element, w, h)` handler builds + dispatches `createResizeEdits` → `newEditEventV2`, so the resize edit now flows through the **same path as drag-resize** (`createResizeEdits` is exactly `updateSLDAttributes(el, nsp, {w,h})`).
  - Contract chosen: input = `substation`; output = one `oscd-sld-resize` domain event (controller builds the `EditV2`). This consolidates with the drag-resize edit path rather than dispatching `newEditEventV2` from the view.
  - Tests: added `src/sld-resize-substation-dialog.spec.ts` (open-populated, valid-resize-emits, unchanged-no-op, forbids-undersizing); updated the two `sld-editor.spec.ts` integration tests to drive through `element.resizeDialog`.
  - **Open implementation choice (decided):** went with (b) the dedicated component (cleanest contract: input = substation, output = one resize event).
- [x] **Rework the coordinate tooltip.** DONE: extracted the semantic tooltip state into pure `coordinateTooltipState(...)` and extracted `<sld-coordinate-tooltip>` for cursor-following DOM positioning + visual rendering. `SldSubstationViewer` now keeps only the diagram/grid interaction state, passes the derived tooltip state into the component, and no longer owns `coordinatesRef`, `positionCoordinates()`, the per-substation `window.click` listener, or tooltip CSS. The component accepts an optional `anchor` so it preserves the old “hide when the SVG is not hovered” behavior without reintroducing imperative positioning in the editor. Verified with `./node_modules/.bin/tsc --noEmit`, `npm run test` (`492 passed, 0 failed`), and `npm run format`.

## Reference Principles

- **GUIDING PRINCIPLE for the viewer/editor split — the edit-vs-view litmus test.** When deciding where an operation belongs, ask: _does it produce an `EditV2` (mutate the SCL document)?_ → it belongs in the **editor/controller** layer (`SldEditor`). _Does it read/serialise the rendered view?_ → it belongs in the **view** layer (`SldSubstationViewer`). This is the rule that should drive the eventual `viewer / editor / plugin` module split. Confirmed state of the four `renderHeader` buttons against this test:
  | button | what it does | belongs to | status |
  |---|---|---|---|
  | **Resize dialog** | builds `updateSLDAttributes` → `newEditEventV2` | controller | **✅ hoisted to `SldEditor` via `<sld-resize-substation-dialog>`** |
  | **Delete** | `newEditEventV2({ node: substation })` | controller | borderline; already a complete edit dispatched directly — lower priority |
  | **Edit** | `newSclEditDialogEvent(substation)` (already an event) | host/controller | already fine |
  | **Export** | serialises `this.sld` (the rendered `<svg>` in the view's shadow DOM) via `exportSVG` | **view** | **correctly placed — leave it** |
  Evidence the controller already owns edits: `sld-editor.ts` handles `@oscd-sld-resize`/`-resize-tl`/`-place`/`-place-label`/`-connect`/`-rotate` and dispatches `newEditEventV2` (see `createResizeEdits`/`createResizeTLEdits` etc.). The resize _dialog_ is the lone edit-producing operation still committed directly from the view.

## Current File Layout

### Root & Editor

- `src/oscd-editor-sld.ts` — Thin plugin orchestrator: lifecycle, namespace detection, event wiring between toolbar and editor
- `src/sld-editor.ts` — Editing kernel: placement state machine, resize, connect, rotate. Promise-based `startPlacing()` API. Owns the single `<sld-resize-substation-dialog>` instance.
- `src/sld-substation-viewer.ts` — SVG rendering orchestration + context menu delegation. `render()` is now a paint-order layer stack of `render*` sub-methods. Future split target for viewer extraction.
- `src/sld-resize-substation-dialog.ts` — Self-contained substation resize dialog (width/height form + `canResizeTo` validation). Input: `.substation`; output: a single `oscd-sld-resize` event. Owned by `SldEditor`.

### Toolbar (`src/toolbar/`)

- `src/toolbar/sld-toolbar.ts` — Layout compositor with data-driven FAB groups. Equipment, structural, transformer, and view-control sections. Owns the about dialog and `insertSubstation` logic.
- `src/toolbar/sld-toolbar.spec.ts` — Unit tests: substation insertion, zoom events, placement events, view toggles, about/cancel
- `src/toolbar/sld-ied-importer.ts` — FAB + hidden file input for bay typical import. Parses SCL, converts layout, emits placement event with IEDs.
- `src/toolbar/sld-ied-importer.spec.ts` — Unit tests: FAB rendering, file input, event dispatch
- `src/toolbar/sld-ied-menu.ts` — IED selection menu with 3 sections (unmatched refs, available IEDs, used IEDs). Emits `start-placing`.
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
  `SldSubstationViewer` remains the orchestration layer and provides an explicit
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
- `npm run test` passed with `512 passed, 0 failed` (after the immutable connect-path change; +3 new `extendConnectPointPaths` geometry specs).
- Connect-path growth is now immutable: `foundations/geometry.ts` `extendConnectPointPaths` (pure) + `oscd-sld-extend-connect-point` event + `SldEditor.extendConnectPoint` (controller-owned reassignment). No remaining in-place `path` mutation or manual `requestUpdate()` in the connect flow.

## Historical Verified State

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
- `sld-substation-viewer.ts` reduced 1529 → 1331 lines.
- Bus-bar no longer receives `renderConnectivityNode` through its context; it imports the renderer directly, removing the temporary cycle.

Latest verification after container extraction:

- `./node_modules/.bin/tsc --noEmit` passed.
- `npm run format` passed.
- `npm run test` passed with `470 passed, 0 failed` (+11 container unit tests).
- `sld-substation-viewer.ts` reduced 1331 → 1087 lines.
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
- `SldSubstationViewer.render()` is now a short paint-order stack of 13 extracted `render*` methods (see the layer-strategy checklist item near the top). The file grew slightly to ~1150 lines purely from the extra method headers/doc comments; `render()` itself dropped from ~483 lines to a readable stack.
- Remaining: Phase 3 (container-internal sub-layers in `equipment-container.ts`), the resize-dialog hoist, and the header/tooltip component candidates — all logged as workstream items above.

Latest verification after the resize-dialog hoist:

- Extracted `src/sld-resize-substation-dialog.ts` (`<sld-resize-substation-dialog>`), owned as a single instance by `SldEditor`.
- `SldSubstationViewer` header "Resize" button now fires `oscd-sld-resize-substation`; removed the local dialog, its three `@query` fields, and the now-unused `OscdDialog`/`OscdTextButton`/`OscdOutlinedTextField`/`updateSLDAttributes` imports + scoped registrations. `sld-substation-viewer.ts` reduced ~1150 → ~1029 lines.
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

| File                    | Responsibility                                                                  | Notes        |
| ----------------------- | ------------------------------------------------------------------------------- | ------------ |
| `geometry.ts`           | Pure math (Rect, Point, contains, overlaps)                                     | ✅           |
| `element-geometry.ts`   | Bridges geometry ↔ SCL elements                                                 | ✅           |
| `sld-placement.ts`      | Validation (`canPlaceAt`, `canResizeTo`)                                        | ✅ read-only |
| `equipment.ts`          | Type constants & guards                                                         | ✅           |
| `transformer.ts`        | Rendering geometry for windings                                                 | ✅           |
| `sld-attributes.ts`     | Read/write SLD namespace attributes                                             | ✅           |
| `events.ts`             | Custom event factories & types                                                  | ✅           |
| `export.ts`             | XML pretty-print & download                                                     | ✅           |
| `ied.ts`                | IED resolution + one edit builder                                               | ✅           |
| `connectivity.ts`       | Read-only queries (`isBusBar`, `busSections`, `connectionStartPoints`)          | ✅ pure      |
| `connectivity-edits.ts` | Edit builders (`removeNode`, `removeTerminal`, `reparentElement`, `uniqueName`) | ✅           |
| `edits.ts`              | Pure edit builders (ground, flip, delete, copy, connect)                        | ✅           |

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

## `sld-substation-viewer.ts` Analysis — The Elephant (2,173 lines)

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
composition. `SldSubstationViewer` builds a shared `SldArtifactContext` and calls
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
| `sld-substation-viewer.ts` | Diagram `<defs>`, resize paths, transformer paths, equipment symbol paths |

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
