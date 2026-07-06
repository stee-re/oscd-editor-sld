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

- [ ] **(UX) Make the legacy-coordinate migration screen clear and reassuring.** User-facing polish, not a refactor. Explain — e.g. in a _"read more"_ disclosure — that coordinates were previously stored in a way other tools might not preserve, so for data safety they were moved into a `<Private>` section, which IEC 61850 requires conformant tools to preserve. Frame it as protecting the user's layout, not as a risky conversion.

## Completed Workstreams

- [x] **Expose themable artifact colours as CSS variables. DONE.** The doc's original example — *"the equipment top-indicator `#BB1326`"* — was already resolved by the earlier theming workstream: the rendered diagram is fully tokenised (e.g. `conducting-equipment.ts` draws the top/bottom indicators with `var(--oscd-sld-terminal-color)`). The only remaining literals were in `context-menu/sld-context-menu-factory.ts`, and they split into two categories that were treated differently. **(A) Themeable chrome** — the Delete IED destructive-action colour, which writes nothing to the document — now references theme tokens (`var(--md-sys-color-error, var(--oscd-error))`), and `sld-context-menu.ts` gained `sldThemeStyles` so tokens resolve standalone (matching every other component). **(B) Fixed document-data swatches** — the "Red"/"Blue" label commands are a fixed-value colour picker: each `updateSLDAttributes(text, …, { color })` writes a literal hex into the SCL `<Private>` SLDAttributes, and a coloured label renders with that literal (`label.ts`: `fill: ${attributes(el).color}`), NOT via a token. So a single constant (`SLD_RED`/`SLD_BLUE`) drives all three coupled uses — the show/hide guard, the persisted write, **and the menu-item swatch preview** — guaranteeing the swatch always matches what the command writes and renders. These must stay literal (portable across IEC 61850 tools, identical in unthemed export, theme-independent) and must **not** use the themeable `--oscd-sld-red`/`--oscd-sld-blue` diagram tokens, which retint the *brand* and may by design diverge from these data swatches. The label default `#000` moved to `DEFAULT_LABEL_COLOR` in `sld-attributes.ts` (its read-default), shared with the "Reset Color" no-op check. *(Correction during review: an earlier pass mistakenly themed the Red/Blue swatches with the diagram tokens, which would let the swatch preview drift from the literal it writes/renders under a re-themed brand; reverted so the constant is the single source for guard + write + swatch.)* Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`551 passed, 0 failed`), `npm run format` (only the 2 pre-existing `geometry.ts` tsdoc warnings).

- [x] **Fixture cleanup (opportunistic). DONE.** Converted the hand-built SCL fixtures to `sldFixture()` where it reduces noise without hiding load-bearing shape. `context-menu/sld-context-menu.spec.ts`: all 4 fixtures (`makeDoc`, `ptr3Doc`, `ptr1Doc`, `textDoc`) — the outer `S1 > V1 > B1` scaffold replaced by `sldFixture({ children })`, inner content kept verbatim (the specs only query shadow-DOM menu items, so the added VL/Bay layout is inert; the equipment `Private type="…/SLD/v0"` mismatch was deliberately preserved, not "fixed", to keep coverage identical). `foundations/edits.spec.ts`: **31 of 44** fixtures converted by a guarded pass that matches only `S1 > V1 (no VL-level Private) > single Bay > leaf children` and skips anything with nested containers/siblings. The **13 skipped are shape-dependent and correctly left as `createSCLDoc`**: the no-Bay cases (`createGroundTerminalEdits` null-guard; equipment/VL directly under `Substation`), fixtures whose `VoltageLevel`/`Bay` carry their own layout `Private` with coordinates the container-edit tests assert on, and the VL-clone case. (Assessed and **rejected** for `sld-editor.spec.ts` / `oscd-editor-sld.spec.ts` as before: their module-level doc strings are load-bearing — multiple voltage levels, specific equipment layouts with rotations/label coords, and deliberately _varied_ SLD namespace prefixes (`smth` / `esldoscd` / `eosld`) exercising prefix-agnostic parsing. `sldFixture` hardcodes a single `V1 > Bay B1` under the `smth` prefix, so converting would erase that coverage.) Test-only. Verified `tsc --noEmit` clean, `npm run test` (`551 passed, 0 failed`, coverage `93.31%`), `npm run format`.

- [x] **Add direct, self-documenting `guard`-contract tests to `sld-substation-viewer.spec.ts`. DONE.** The base-layer `guard` memoization (its `baseLayerKey`) is a subtle invariant: drop a key item and the base layers silently go **stale** (fast but wrong). Its behaviour was _already_ covered **indirectly** by `sld-editor.spec.ts` (resize commit-value tests exercise `resizingBR`, connect tests cover `connectingFrom`, placing tests cover placed-element suppression, move/edit tests cover doc-change invalidation) — so this was **not a correctness hole** but a _directness_ gap: a broken key failed an editor test with a confusing symptom (wrong committed width) instead of an obvious "the guard froze the base layers" signal. Added a 7-test `describe('SldSubstationViewer base-layer guard memoization')` that mounts the viewer in isolation and spies the guarded base-layer renderers (`renderVoltageLevelLayer`/`renderLabelLayer`) vs. an unguarded per-render probe (`renderPlacingPreview`): (a) `placing` reuses the base layers on cursor move while `render()` still re-runs; (b) `resizingBR` and (c) `connectingFrom` refresh the base layers on cursor move; (d) `idle` skips `render()` entirely (shouldUpdate gate); (e) a `docVersion` bump refreshes the base layers; (f) toggling `showLabels`/`showIeds` and changing `highlight`/`selectable` each refresh them — the key items most likely to be dropped unnoticed; (g) entering `placing` removes the placed bay's `<g>` from the base layer (drawn only as the preview ghost). Uses a small dedicated `contractSubstationDoc()` (2 VL × 2 bays × 2 equipment) so each test runs in a few ms. Test-only. Verified `tsc --noEmit` clean, `npm run test` (`551 passed, 0 failed`), `npm run format` (only the 2 pre-existing `geometry.ts` tsdoc warnings).

- [x] **Give `getSldSubstationViewer` a substation selector before the first multi-viewer assertion. DONE.** The two spec helpers (`sld-editor.spec.ts`, `oscd-editor-sld.spec.ts`) each did `querySelector('sld-substation-viewer')` (first match), while the editor renders one viewer per `:root > Substation` — safe for all current single-viewer call sites but a latent footgun once a genuine multi-viewer assertion arrives. Both now accept an optional `substation?: Element` and, when supplied, select the viewer whose `.substation` **identity** matches (falling back to first match otherwise), rather than relying on document order. Backward-compatible for every existing call site. Test-only. Verified `tsc --noEmit` clean, `npm run test` (`551 passed, 0 failed`), `npm run format`.

- [x] **Resolve each element's SLD-attribute source node once in `attributes()`. DONE.** `attributes(element)` (the per-element geometry read used by every artifact/layer) called `getSLDAttributes` ~12 times — one per key (`x`,`y`,`w`,`h`,`rot`,`lx`,`ly`,`weight`,`bus`,`flip`,`kind`,`color`) — and each of those re-ran `sldAttributes(element)`, which scans the element's children twice to find the `Private > SLDAttributes` node. So rendering a ~2400-element substation did ~28 800 redundant children scans. `attributes()` now resolves the source node **once** (element itself for `Section`/`Vertex`, else its `SLDAttributes` private) and reads every key off it, preserving `getSLDAttributes`' exact semantics. Same-run per-layer JS build cost on the `sld-substation-viewer.spec.ts` benchmark roughly halved for the two heaviest layers: `renderVoltageLevelLayer` 161 → 69 ms, `renderLabelLayer` 92 → 39 ms. This is a general win (any `attributes()`-heavy path), though the substation viewer's first paint is still DOM-commit-bound (~400 ms creating ~4800 `<g>`). Reducing that first-paint DOM-commit cost (via virtualization or `<g>`-nesting reduction) was considered as a follow-up workstream but **dropped** — too large a change for too little practical gain, since it is a one-time cost and the cursor-driven jank users actually feel is already fixed by the base-layer memoization below. Also deduped a double `attributes()` call on `Text` labels in `label.ts`. Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`543 passed, 0 failed`), `npm run format`.

- [x] **Memoize the static base SVG layers during cursor-driven re-renders. DONE.** `SldSubstationViewer.shouldUpdate` already skips mouse-only re-renders while `idle`, but in every _non-idle_ mode it returns `true`, so a Bay move re-ran the whole `render()` — all five base layers (voltage levels, connectivity, power transformers, IEDs, labels; ~4800 `<g>` on a ~1900-equipment substation) — on **every** `mousemove`, even though only the placing preview changes. The base layers are cursor-_independent_ except in three modes where a base artifact legitimately tracks the mouse: `resizingBR`/`resizingTL` (container resize preview, `equipment-container.ts`) and `connectingFrom` (connect target highlight/snap, `conducting-equipment.ts` + `connectivity-node.ts`); the placed element itself is skipped from base layers (`equipment-container.ts:287`) and drawn only by the preview. So the two base-layer groups in `render()` (kept as two `guard` calls to preserve the interleaved SVG paint order / z-order) are now wrapped in Lit `guard(baseLayerKey, …)`, where `baseLayerKey` covers every base-layer input (`substation`, `docVersion`, `interaction`, `showLabels`, `showIeds`, `gridSize`, `highlight`, `selectable`, `disabled`) and includes the six mouse coords **only** in the three mouse-tracking modes (a constant `0` otherwise, keeping the key stable so guard reuses the memoized layers across cursor moves). New isolated benchmark `sld-substation-viewer.spec.ts` (generated 24-VL / 480-bay / 1920-equipment substation, riding the existing `oscd test` Chromium harness — no server, no Playwright): **Bay-move per-move render median 322 ms → 4.6 ms** (mean 324 → 7.2, max 363 → 21); idle hover unchanged (~0 ms); initial render unchanged (~740 ms, tracked separately above). Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`543 passed, 0 failed`), `npm run format` (only the 2 pre-existing `geometry.ts` tsdoc warnings). **(Regression fix, later.)** The initial mouse-tracking set was incomplete: `placingLabel` (repositioning a `Text`/label, "Move Label"/"Move") also paints from the live cursor — via `renderedLabelPosition` using `mouseX2`/`mouseY2` — but its preview is drawn **inside** the guarded label layer (`renderLabelLayer`), not in `renderPlacingPreview`. Omitting it from `baseLayerTracksMouse` froze the label preview during the drag (the click still committed at the correct spot, so only the preview looked broken). Fixed by adding `placingLabel` to the mouse-tracking modes; `baseLayerKey` already folds in `mouseX2`/`mouseY2` under that flag. The `guard` memoization spec had a corresponding gap (it covered `resizingBR`/`connectingFrom` but not `placingLabel`), so added a `placingLabel` case asserting the base layers refresh on cursor move — verified it fails without the fix. `tsc --noEmit` clean, `npm run test` (`552 passed, 0 failed`).

- [x] **Delete `SldEditor`'s test-only / dead interaction getters. DONE.** `SldEditor` exposed five getters projecting slices of its `interaction: InteractionState` union — none had production readers. Two (`resizingTL`, `connecting`) had **no readers at all** (their live equivalents are the _viewer's_ getters, which render from them) — deleted outright, along with the now-unused `StartConnectDetail` import. The other three (`placing`, `placingLabel`, `resizingBR`) were **test-only**; rather than keep test-only surface on the production class, the ~54 spec assertions now read the union through the existing foundation selector `targetInMode(interaction, mode)` — e.g. `element.placing!` → `targetInMode(element.interaction, 'placing')!`, and the chai `expect(element).property('placing')…` / `.to.have.property('placing', undefined)` forms rewritten accordingly. This reinforces the `interaction-mode.ts` philosophy (read the union via selectors; don't re-fan it into fields) and invents no new API. Fixture-cleanup (#5) was assessed for the two touched specs and **rejected** — their doc strings are load-bearing (multi-VL, equipment layouts, varied namespace prefixes), so `sldFixture()` would erase coverage. Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`542 passed, 0 failed`), `npm run format`.

- [x] **Hoist the coordinate tooltip to a single editor-owned instance. DONE.** There was one `<sld-coordinate-tooltip>` per substation, each registering two `window` listeners (`pointermove` + `click`) — 2N global listeners for N substations, and N tooltips computing state the parent fed down. The tooltip is an **editing** affordance (it only shows text during `placing`/`resizingBR`/`resizingTL`; a read-only viewer would render it permanently collapsed), so it belongs on the controller, not in a future pure `sld-viewer`. Hoisted to a single instance in `SldEditor`. **Key design move: split the tooltip's state by update frequency instead of streaming coords upward.** The _low-frequency_ interaction context (`placing`, `placingOffset`, `resizingBR`, `resizingTL`) is passed as props — it only changes on an interaction transition. The _high-frequency_ grid coordinates are owned by the tooltip itself: it already listens to `window` `pointermove` (for positioning), so in that same handler it finds the substation coordinate surface under the cursor via a `substationOf(surface) => Substation | undefined` resolver prop, converts client→grid through **that** surface's CTM, and calls the existing pure `coordinateTooltipState(...)`, storing the result in its own `@state`. **Result: a moving cursor re-renders only the tooltip's one-`div` template — never the editor's N-substation map** (which the naïve "push mouseX/mouseY up to editor `@state`" design would have done on every move). No child→parent per-move event exists; the viewer no longer references the tooltip at all. The editor owns the `substationOf` resolver (it knows the viewer DOM: a surface is a viewer's `svg#sld`, whose shadow host is the `SldSubstationViewer` carrying the `substation`), keeping the tooltip agnostic of SLD structure. The viewer's now-orphaned `resizingBR` getter and `renderCoordinateTooltip()` method were deleted. Tooltip spec rewritten for the self-contained component (positioning, hide-when-no-surface, computed coords/invalid via a non-identity-CTM surface). Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`533 passed, 0 failed`), `npm run format`.
- [x] **Feed the tooltip the `interaction` union instead of fanned-out slices. DONE.** Follow-up to the hoist above. The tooltip originally took four props (`placing` / `placingOffset` / `resizingBR` / `resizingTL`), each a getter-projected slice of `SldEditor`'s single `interaction: InteractionState` — the editor fanned the union _out_, and the tooltip's `deriveState` immediately fanned it back _in_ to call `coordinateTooltipState(...)`. That round-trip diverged from the sibling `SldSubstationViewer` (which takes one `.interaction` prop and derives locally) and reintroduced the illegal-combo risk the discriminated union exists to prevent (`placing` _and_ `resizingBR` both set). Collapsed **both** fan-out layers: the tooltip now takes a single `.interaction` prop, and `coordinateTooltipState` was refactored to accept the union and `switch (interaction.mode)` — `placingOffset` is read off the narrowed `placing` variant rather than as a free-floating param, so inconsistent inputs are unrepresentable. `SldEditor` renders `.interaction=${this.interaction}` and its now-dead `placingOffset` getter was removed (`placing`/`resizingBR`/`resizingTL` stay, still read by specs). `placingLabel` and `connectingFrom` are explicitly hidden in the switch (a new state-helper test pins the `placingLabel`-hidden invariant). Both specs rewritten to build inputs via the `interactions.*` constructors. Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`534 passed, 0 failed`), `npm run format`.
- [x] **Move the tooltip's pure core into `foundations/` and rename it for accuracy. DONE.** Follow-up to the two above. The pure state function lived at top level as `sld-coordinate-tooltip-state.ts` / `coordinateTooltipState`, but it is a DOM-free projection of `InteractionState` + substation + cursor grid-coords onto a `{ text, invalid, hidden }` verdict — the same species as its `foundations/` peers (`sld-placement.ts`, whose validity checks it calls; `interaction-mode.ts`, whose union it reads). Its old name was inaccurate: named for the _consumer_ (tooltip), while "coordinate" undersold the resize case (it emits **dimensions** when resizing, not coordinates) and "state" overstated it (it owns nothing). Moved to `foundations/interaction-readout.ts`, renamed `interactionReadout(...)` returning `InteractionReadout` — pairs with `interaction-mode.ts` (mode = the gesture; readout = what it displays) and keeps the functional-core / imperative-shell split across the folder boundary (the Lit shell `sld-coordinate-tooltip.ts` stays at top level; its `track()` handler does the actual pointer tracking, its `deriveReadout()`/`readout` @state consume the core). `git mv` preserved history; ~4 files touched, mechanical. Verified `tsc --noEmit` clean, `npm run test` (`534 passed, 0 failed`), `npm run format`.

- [x] **Unify the duplicated connect-elbow geometry. DONE.** The busbar-connect click handler in `drawing/artifacts/connectivity-node.ts` hand-rolled the same "bend the orthogonal path toward a target" math that `connectPreviewElbow` owns (`vertical = oldX1 === oldX2`, `newX2 = vertical ? oldX2 : x3`, …) — computed _twice_ (once toward the raw cursor to pick the `findIntersection` approach start, once toward the busbar-clamped endpoint). Extracted the shared primitive `elbowCorner(path, target): Point` in `foundations/geometry.ts` — the single 90° bend continuing the last committed segment's orientation toward `target`. `connectPreviewElbow` now delegates to it (keeping only the `far`/`near` snap handling), and the busbar handler uses it for both the approach and the re-bend, so the opaque `newX2/newY2` locals are gone; the busbar-specific `findIntersection` clamp stays explicit and local. **De-risked first:** the connect-to-busbar click geometry had _no_ coverage, so 3 characterization specs were added (`connectivity-node.spec.ts`) capturing the exact dispatched `oscd-sld-connect` path for a horizontal last segment, a vertical last segment clamped to a vertex, and the already-connected no-op; they passed against the pre-refactor code and still pass. Added 3 `elbowCorner` unit specs. Behaviour-preserving. Verified `tsc --noEmit` clean, `npm run test` (`532 passed, 0 failed`; +6 specs), `npm run format`.

- [x] **Split `renderConnectionPreviewLayer` — extract the elbow geometry into a pure helper. DONE.** The connect-preview method interleaved pure geometry (which way the previewed segment bends toward the cursor) with view concerns (snap-target resolution, SVG generation, event dispatch). The geometry moved to `foundations/geometry.ts` `connectPreviewElbow(path, cursor, snap?)` — a pure, DOM-free function returning the bend `corner` plus the `far`/`near` cursor endpoints, chosen from the previous segment's orientation (`x1 === oldX2` → leave vertical, turn horizontal, else the reverse). The viewer keeps what only it can do: resolve the optional snap target (`connectionStartPoints`), emit the three `<line>`s, and dispatch `extendConnectPointPaths(path, corner, far, near)` on click. **Preview and commit now consume the same three points**, so they cannot drift. As a readability follow-up the whole preview was recognised as one orthogonal polyline, collapsing the two duplicated line-drawing blocks into a single pass over named points (removing the opaque `x1…x4`/`y1…y4` locals). Behaviour-preserving — the SVG structure and the extend/connect click ordering are unchanged. Added 4 DOM-free `connectPreviewElbow` specs (both bend axes, the snap far/near split, and the preview↔commit round-trip). Verified `tsc --noEmit` clean, `npm run test` (`526 passed, 0 failed`; +4 geometry specs), `npm run format`.

- [x] **Dissolve `SldEditor`'s `reset()` / `start*` lifecycle wrappers — a mode change _is_ the transition. DONE.** With the `InteractionState` union, exclusivity is intrinsic (one field; entering a mode _is_ leaving the previous), so the wrappers that did "reset-then-set-then-emit" were redundant scaffolding — and the redundancy caused a visible flap (every `start*` emitted `in-action:false` via `reset()` then `in-action:true`). Deleted `reset()` and the `startResizingBottomRight/TopLeft`, `startPlacingLabel`, `startConnecting` wrappers; every call site (incl. `handleKeydown` Escape, `handleStartInteraction`, and the edit handlers `handleSubstationResize`/`resizeTLElement`/`placeElement`/`placeLabelElement`/`connectEquipment`) now assigns `this.interaction = interactions.<mode>(…)` directly (cancel → `interactions.idle()`). **`startPlacing` kept** — it is the one wrapper that earns its place, owning the placement Promise (public API awaited by the root's bay-typical import); it now also self-cancels a superseded pending placement (the `placing → placing` case the reactive handler can't see).
  - **Resolved Q1 (assignment mechanism) → (b) raw assignment + reactive `updated()`**, _not_ the doc's leaned (a) funnel. Reason: the `docVersion` setter and `extendConnectPoint` already assign `interaction` directly, so a `setInteraction` funnel would be silently bypassed by them; a reactive `updated(changed)` on the `interaction` `@state` catches **every** transition uniformly. It drives the two genuine side-effects: (1) resolve a still-pending placement Promise with `undefined` when leaving `placing` (`placeElement` opts out by clearing `_resolvePlacement` before it transitions); (2) emit the derived `sld-editor-in-action` boolean **only when active/idle flips** — killing the flap.
  - **Resolved Q2 (event payload) → keep the bare boolean.** The sole consumer (`oscd-editor-sld.ts` → `this.inAction` → `<sld-toolbar>.inAction`) only needs true/false; nothing branches on mode. A typed `sld-editor-interaction-changed { active, mode }` would be speculative generality _and_ semantically different (it should fire on every transition, incl. `placing→resizingBR` and each `connectingFrom` waypoint, whereas the flip-only boolean stays quiet). Deferred until a real consumer needs the active mode (e.g. toolbar highlighting the in-progress gesture) — at which point it supersedes the boolean cleanly. The old "replace the bare-boolean event" workstream item is therefore closed as **won't-do (for now)**.
  - **Root adaptation:** `oscd-editor-sld.reset()` (cancel button / Escape / pre-`startPlacing`) replaced its `sldEditor.reset()` call with `sldEditor.interaction = idle()` — "cancel = go idle", consistent with the refactor and with how specs already set `interaction` directly.
  - Behaviour-preserving; the two component-level "interaction mode exclusivity" specs (which exercised the deleted wrappers) were converted to direct `interaction` assignment — the union's exclusivity itself is covered DOM-free in `interaction-mode.spec.ts`. Verified `tsc --noEmit` clean, `npm run test` (`529 passed, 0 failed`), `npm run format`.

- [x] **Collapse the downward artifact interaction projections — artifacts read `interaction` via selectors. DONE.** The viewer used to _fan out_ its single `interaction` union into six independent context fields (`placing`, `placingLabel`, `resizingBR`, `resizingTL`, `connecting`, `idle`) that each artifact read as flat `Element | undefined` / booleans. That fan-out re-flattened the union and re-admitted illegal combinations (placing _and_ resizing at once) — invisible in production (the viewer getters derive from one union) but real in `test-context.ts`/specs, which hand-built the six fields independently. **Instead of pushing the raw union down** (which would scatter union-shape knowledge across ~72 artifact read-sites) the projection was _single-sourced_ behind three pure, DOM-free-tested selectors in `foundations/interaction-mode.ts`: `isMode(state, ...modes)` (mode-only queries), `targetInMode(state, ...modes)` (mode-scoped subject element, for identity checks — the concrete form of the mooted "interactionTarget"; identity checks are mode-_specific_, hence the mode arg), and `connectDetail(state)` (the connect-from payload). Contexts now carry only `interaction: InteractionState` (`SldSharedContext`); the six flat fields and the now-unused `Connecting` type were deleted. All ~72 artifact read-sites migrated to the selectors — the ~44 mode-only ones read _cleaner_ than before (grouped `isMode(i,'resizingBR','resizingTL',…)`), the ~28 identity ones stay clear via `targetInMode`. The viewer keeps its private getters (46 internal render uses) and now delegates `connecting` to `connectDetail`. `test-context.ts` builds `interaction: idle()` and specs construct states via the `placing(...)` constructors, so **the union's "illegal states unrepresentable" invariant now holds end-to-end — production and tests alike**. Union-internals live in ~3 tested selectors, not 72 scattered sites. Verified `tsc --noEmit` clean, `npm run test` (`522 passed, 0 failed`; +8 selector tests), `npm run format`.

- [x] **Collapse the upward `start*` gesture events into a single interaction-start event. DONE.** The five artifact-emitted events (`newStartPlaceEvent`, `newStartPlaceLabelEvent`, `newStartResizeBREvent`, `newStartResizeTLEvent`, `newStartConnectEvent`) were the un-collapsed mirror of the interaction state union. They are replaced by one `newStartInteractionEvent(intent)` (event id `oscd-sld-start-interaction`), whose `detail` is a new discriminated union `InteractionIntent` — `{ mode:'placing'|'placingLabel', element, offset? }` | `{ mode:'resizingBR'|'resizingTL', element }` | `({ mode:'connecting' } & StartConnectDetail)`. `SldEditor` now wires a single `@oscd-sld-start-interaction` handler (`handleStartInteraction`) on both the viewer and `<sld-context-menu>`, replacing the previous five handlers on each. **Net: 5 events + 4 event/detail types removed from the view→controller vocabulary; 1 event + 1 union added.** As part of the same change the reciprocal naming pair was made legible at the type level: the editor-owned state type `Interaction` was renamed `InteractionState` (flows editor→viewer, includes `idle`), paired with the new `InteractionIntent` (flows viewer→editor, begin-transitions only). The `.interaction` property and `interactions` constructor namespace were intentionally left unchanged; `StartEvent` (rotate) and `StartConnectDetail` were retained. Verified `tsc --noEmit` clean, `npm run test` (`514 passed, 0 failed`), `npm run format`.

- [x] **Hoist the substation header out of the viewer into `SldEditor` via a slotted `<sld-substation-header>`. DONE.** The header (substation name + Edit / Resize / Delete / Export buttons) was the _only_ remaining non-gesture editor concern in the viewer. New scoped component `src/sld-substation-header.ts` (props `substation`, `disabled`; owns the `h2` toolbar CSS + the `resizePath` icon) renders the four buttons and emits UI-only `sld-header-{edit,resize,delete,export}`. `SldEditor` renders it as `slot="header"` inside each `<sld-substation-viewer>` and wires the buttons to editor-side logic over the closed-over `substation`: Edit → `editScl(substation)`, Resize → `resizeDialog.show(substation)`, Delete → `newEditEventV2({ node: substation })`. **Export** is owned by the viewer, which alone knows how it builds the SVG and which nodes are editing chrome: `export.ts` was split into `serializeForExport(svg): string` (viewer-owned normalization/serialization, exposed as `viewer.exportableSvg()`) + `downloadSvg(content, filename)` (editor-triggered file sink, reached via `event.currentTarget` on the viewer). The viewer now renders `<slot name="header">` and emits **only** diagram-gesture intents, making that invariant complete and checkable. **Event-vocabulary net:** two intent event types were fully deleted (`oscd-sld-resize-substation`, `oscd-sld-delete-substation` + their `new*Event` factories, detail types, and `HTMLElementEventMap` entries); `oscd-sld-edit-scl` was **retained** because the context menu and `label.ts` still author it (the header simply stopped emitting it). Verified `tsc --noEmit` clean, `npm run test` (`517 passed, 0 failed`), `npm run format`.

- [x] **Route context-menu action edits through `SldEditor` — RESOLVED AS "no longer applies" (won't do).** The premise (menu must emit _intent_ and let the editor build the `EditV2`) assumed the context menu was a **viewer-side** artifact. That assumption became stale once the `<sld-context-menu>` hoist (completed item below) moved the menu **out of the viewer to the editor** because it is an editing concern. The factory (`sld-context-menu-factory.ts`) is therefore already editor-layer code: when it builds an `EditV2` that _is_ "the editor building the edit", and the viewer/editor package boundary is already satisfied. Interposing a `SldEditor.executeCommand` middle-man + a `MenuCommand` union would add indirection with **zero boundary payoff**, work _against_ the reduce-event-vocabulary goal, and contradict the codebase's YAGNI stance. The distinction that remains is principled, not accidental: the **controller builds the commits whose multi-step lifecycle it owns** (place/connect/resize/rotate — already reused by overlapping menu actions via `start*` intents), while the **menu builds its own one-shot, fire-and-forget commits** (delete, flip, add-text, styling, ground, delete-IED). The host's interception surface is the bubbling `oscd-edit-v2` event, which is uniform regardless of where the edit is authored, so scattering authoring does not degrade the public Edit API. Decision: keep the current design as-is. (A genuinely boundary-relevant follow-up, if ever wanted, is decoupling the dumb menu _component_ from the edit-domain _factory_ — `SldEditor` builds the items and passes them into an edit-agnostic menu — but that is a separate, better-motivated item, not this one.)

- [x] **Consolidate the hardcoded artifact colours → themeable CSS custom properties. DONE (brand/grey palette).** Originally framed as ~26 literals for three colours (`#BB1326`×15, `#12579B`×6, `#F5E214`×5) plus greys, with casing drift. Rather than TS constants, this became a Material-3-style **theming system** (`src/theme.ts` `sldThemeStyles`, included in each top-level component's `static styles`):
  - **Foundation palette** mirrors `@omicronenergy/oscd-shell` (see its THEMING.md): `--oscd-base03…--oscd-base3`, `--oscd-primary/secondary`, `--oscd-error/warning`, each `var(--oscd-theme-X, <shell default>)` — so the plugin inherits the host theme inside the shell and still renders standalone.
  - **SLD brand palette:** `--oscd-sld-red|yellow|blue`.
  - **SLD semantic tokens** consumed by components (named per Material vocabulary — `-color`/`-background-color`/`-outline-color`, not SVG `stroke`/`fill`): entity icons `--oscd-sld-icon-{substation,voltage-level,bay}-{background,foreground}-color`; frames `--oscd-sld-{voltage-level,bay}-color`; terminals `--oscd-sld-terminal-color`/`-terminal-outline-color`/`-neutral-terminal-color`/`-groundable-terminal-color`; states `--oscd-sld-invalid-placement-color`/`-unresolved-reference-color`; `--oscd-sld-grid-color`; `--oscd-sld-label-placeholder-color`.
  - **Two-tier override:** every internal token resolves `var(--oscd-editor-sld-X, <brand/foundation fallback>)`, so distros retune one role, sweep the brand palette, or theme everything via `--oscd-theme-*`. Generic surfaces/text reference `--md-sys-color-*` directly with a base fallback (no bespoke SLD token).
  - **SVG constraint handled:** SVG presentation attributes don't resolve `var()`, so colour moved from `fill=`/`stroke=` attributes into inline `style="…: var(…)"` (and CSS for component chrome) across `diagram-symbols`, `equipment-container`, `conducting-equipment`, `power-transformer`, `label`, `sld-toolbar`, `sld-ied-menu`, `sld-coordinate-tooltip`, `sld-snackbar`, viewer `h2`.
  - **Behaviour notes:** floating panels (toolbar nav, tooltip) now use opaque `--md-sys-color-surface` instead of the old translucent `#fffd`; per-icon foregrounds added (substation/bay white, voltage-level dark on its yellow badge).
  - Verified `tsc --noEmit`, `npm run test` (`512 passed, 0 failed`), `npm run format`.
  - **Follow-ups:**
    ~~(c) structural diagram ink/paper~~ done (item 102, surface/on-surface pairing);
    ~~(d) document the public hooks~~ done (item 97, `THEMING.md`).
    ~~(e) the label-colour **data** picker in `sld-context-menu-factory.ts` (Red/Blue/Reset)~~ — needs the swatch token resolved to a concrete hex at persist time so preview matches persisted data (item 100);
    ~~(f) the "Delete IED" destructive red cue, theme-error vs brand-red decision~~ (item 101).
- [x] **Label-colour data picker: resolve token → hex at persist time (`sld-context-menu-factory.ts`).** The Red/Blue/Reset picker (lines ~608–648) both _previews_ a swatch colour and _writes_ a concrete hex into the document (`updateSLDAttributes(text, …, { color: '#BB1326' })`); the dedupe guards compare the stored value (`color.toUpperCase() !== '#BB1326'`). For these to follow the active theme without the preview disagreeing with persisted data, resolve the themed token to a concrete hex (via `getComputedStyle(...).getPropertyValue('--oscd-sld-…')` on a live element) at persist time, and align the comparisons. Deferred — needs a live element for resolution; pairs naturally with the SVG-export resolution above. **Resolved as won't do**

- [x] **Document the public `--oscd-editor-sld-*` theming tokens. DONE.** Added [`THEMING.md`](THEMING.md) (mirrors `@omicronenergy/oscd-shell`'s convention; better home than the stale template README, which now links to it). Documents the two-tier override model and every public hook (brand palette, surface/on-surface pairing, semantic tokens) with default and effect, plus the monochrome-export caveat. Source of truth remains `src/theme.ts`.
- [x] **SVG export is intentionally monochrome (black/white). DONE.** The theming pass first looked like an export regression — `exportSVG` (`foundations/export.ts`) clones the rendered `<svg>` and serialises it _outside_ the shadow DOM, so `style="…: var(--oscd-sld-…)"` (and inherited `color`/`currentColor`) resolved to nothing standalone. Approach (user's): **pin the variables, keep the markup** — prepend `<style>:root { … }</style>` declaring `sldThemeTokens` (all-or-nothing list, single source of truth next to `sldThemeStyles` in `theme.ts`), markup keeps its `var()` refs. **Then a hard requirement surfaced: the export must be black & white.** So `forceMonochromeTokens(clone)` pins `--oscd-sld-surface-color: white`, `color: black`, and every other token to `black` — overriding the live (possibly dark) theme. Two intentional behaviours confirmed by the user and kept: (a) **VL/Bay frame rects are stripped** (`cleanXML` removes them — _not_ WYSIWYG); (b) **label colours are persisted SCL data** (`color` attr written by the Red/Blue picker), so they survive as colour while everything theme-driven goes mono. Original SVG untouched; the dead interaction `<style>` block rides along as it always has (deliberately left). Specs assert white/black tokens, var() survival, VL/Bay rect strip. Verified `tsc --noEmit`, `npm run test` (`506 passed`), `npm run format`.
- [x] **FAB tonal-elevation lift + custom-icon `currentColor` footgun. DONE.** Dark-mode review found two issues: (1) toolbar FABs read flat because shadows recede on dark surfaces and the shell maps every `surface-container*` tier to `base3` — gave FAB containers a one-step lighter `var(--oscd-base2)` so they tint-elevate (shell-side container ladder noted for a later upstream fix). (2) Custom path icons rendered as raw `<svg>` (header `resize`, `sld_move`/`resize`/`resizeTL`/`resizeBR` in `oscd-sld-icon.ts`) lacked `fill="currentColor"`, defaulting to black and ignoring icon colour — invisible until dark theme. Fixed all five; `<oscd-icon>` font glyphs are fine. Recorded the footgun in the `scl-icons` skill's Known Exceptions.
- [x] **Tokenise the "Delete IED" destructive red cue. DONE.** Two-part: (1) destructive cue now `var(--md-sys-color-error, var(--oscd-error, #BB1326))` — follows the theme error colour, brand red as standalone fallback; (2) **fixed dead mwc remnant** — the menu item is `<oscd-menu-item>` (M3) which ignores `--mdc-theme-text-*` (legacy mwc namespace; zero refs in oscd-ui), so the colour never rendered. Swapped all three menu-item style strings (Delete-IED + Red/Blue label swatches @613/628) to live `--md-menu-item-label-text-color`/`--md-menu-item-leading-icon-color`. No more `mdc-theme` in src. 506 tests pass, tsc clean.
- [x] **Tokenise the structural diagram ink/paper. DONE (surface/on-surface pairing).** Final design (over the earlier `connection`/`symbol` split): two Material-style tokens — `--oscd-sld-surface-color` (paper, default `var(--md-sys-color-surface, var(--oscd-base3))`) and `--oscd-sld-on-surface-color` (ink, default `var(--md-sys-color-on-surface, var(--oscd-base03))`). A dedicated connection token was rejected as too specific: busbars, connection previews, grounding stubs, transformer windings and symbols are all just _ink on the paper_. Implemented by setting `#sld { color: var(--oscd-sld-on-surface-color); }` so the existing `currentColor` symbols follow for free, the canvas `<rect>` uses `style="fill: var(--oscd-sld-surface-color)"`, and every literal `stroke="black"`/`fill="black"` across `sld-substation-viewer`, `connectivity-node`, `conducting-equipment`, `power-transformer` became `currentColor` (inherits the ink token). Resize-handle glyphs in `equipment-container.ts` kept literal black/white — editor chrome, `class="handle"`, stripped on export. Both tokens added to `sldThemeTokens` so they pin into the SVG export. Verified `tsc --noEmit`, `npm run test` (`506 passed`), `npm run format`.
- [x] **Floating-panel translucency: per-panel background-color hooks. DONE.** Two specific hooks (no shared "float" name, no opacity-only indirection) — `--oscd-editor-sld-toolbar-background-color` and `--oscd-editor-sld-tooltip-background-color`, each defaulting to `color-mix(in srgb, var(--md-sys-color-surface,…) 87%, transparent)` to **preserve the pre-refactor `#fffd` translucency** (the interim opaque move was a regression). Exposing the whole background (mirrors M3 `*-container-color` / shell `*-background-color` convention) is more conventional and strictly more capable than an opacity number — distros can set a solid colour, different alpha, or gradient; restating the mix keeps it theme-aware. Documented in THEMING.md. 506 tests pass.
- [x] **Dark-theme demo (`demo/index-themed.html`).** Copy of `index.html` that emulates a distro setting an inverted Solarized base palette (base3 darkest … base03 lightest) on `oscd-shell`, so shell maps `--md-sys-color-surface=base3` dark and everything (chrome + canvas + VL/Bay) themes dark via a single palette flip — no per-plugin overrides needed. Confirmed the surface/on-surface tokens fall back to the shell's md-sys values; B/W export verified against the dark theme.
- [x] **Dropped `--oscd-sld-surface-color`/`-on-surface-color`. DONE.** The bespoke pair was redundant — consumers now reference `--md-sys-color-surface`/`-on-surface` directly (fallback `--oscd-base3`/`-base03`): `#sld { color }`, the canvas `<rect>`, the VL/Bay rect fill. Removed both declarations from `theme.ts` and `sldThemeTokens`; export `forceMonochromeTokens` now pins `--md-sys-color-surface: white`/`-on-surface: black`. THEMING.md "Paper & ink" no longer lists them as override hooks (theme via the shell). 506 tests pass, tsc clean, formatted.

- [x] **Normalize edit dispatch in `SldEditor.render()` (consistency). DONE.** Extracted the two remaining inline edit-building handlers (`@oscd-sld-resize-tl`, `@oscd-sld-place-label`) into named controller methods `resizeTLElement(...)` and `placeLabelElement(...)`. `SldEditor.render()` now delegates those edits the same way it already delegates placement, connection, rotation, and substation resize events. Behaviour-preserving; this just makes the edit-vs-view controller boundary easier to continue in the next workstream.

- [x] **Route `SldSubstationViewer`'s direct `EditV2` dispatches through `SldEditor`. DONE.** Replaced the two remaining direct viewer edit sites with domain intent events: `oscd-sld-ground-terminal` and `oscd-sld-delete-substation`. `SldSubstationViewer` now emits intent only; `SldEditor` builds/dispatches `createGroundTerminalEdits(...)` or `{ node: substation }`. Invalid grounding feedback is editor-owned via a single `oscd-ui` `<oscd-snackbar>`; the old local `sld-snackbar.ts` stopgap was deleted. Added `sld-editor.spec.ts` integration coverage for both routes.

- [x] **Hoist `<sld-context-menu>` from `SldSubstationViewer` to `SldEditor`. DONE.** `SldSubstationViewer` owns no context-menu component. Artifact renderers report semantic intent through `context.requestContextMenu(element, mouseEvent)`; the viewer owns the pointer→grid translation and dispatches `oscd-sld-open-context-menu` with `{ element, x, y, gridX, gridY }`. This deliberately keeps artifacts from knowing the editor-facing event contract while still making the SCL element explicit (not inferred from `event.target`). `SldEditor` renders one `<sld-context-menu>`, opens it from the event detail, and wires the menu's controller-intent events (`start-place`, `start-resize`, `start-connect`, `rotate`, `sld-ground-hint`) to the same controller methods as viewer gestures. Existing menu action edit dispatches are intentionally unchanged for this behaviour-preserving slice and remain tracked as the next workstream.

- [x] **Cache IED reference resolution during viewer renders. DONE.** The large demo file exposed an accidental hot path: label and IED-reference artifacts called `resolveIed(...)` repeatedly while rendering, and `resolveIed` scans `:root > IED` for each reference. `SldSubstationViewer` already had an `iedResolutionCache`, so artifact context now exposes `resolveIed(referencedIed)` and routes those lookups through the viewer cache, invalidated with `doc`/`docVersion`/`substation`. Playwright large-file metric against `demo/index.html` after rebuilding `dist`: start placement improved from ~879 ms to ~125 ms; 30 active mousemove average improved from ~578 ms to ~27 ms; worst move dropped from ~1.1 s to ~53 ms. This absolves the repeated-document-scan mistake, but not all large-file cost: changed-grid active frames still exceed a 16 ms budget.

- [x] **Skip closed IED menu content rendering on document refresh. DONE.** Bay move/undo on the large demo exposed a separate post-commit hot path: the toolbar's closed `<sld-ied-menu>` rebuilt its unmatched/available/used IED sections on every `docVersion`, and `usedIedRefs` repeatedly scanned all SLD IED references through nested getters. Profiling showed `sld-ied-menu.render()` alone consuming ~10.3 s after a Bay move. The menu now renders only its FAB and an empty `<oscd-menu>` while closed; expensive menu sections are created only after the user opens the IED picker. Playwright metric after rebuilding `dist`: Bay place time-to-frame improved from ~10.5-11.0 s to ~510 ms; undo improved to ~477 ms; closed `sld-ied-menu.render()` is ~0 ms. Remaining cost is now the affected substation viewer render, tracked in the open performance workstream.

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
    - **Ownership & reactivity — `@state() interaction` on `SldEditor` + pure variant constructors in `foundations/interaction-mode.ts`** (e.g. `placing(element, offset): Interaction`). These are typed one-line constructors for each union variant — the _value_ side of the state machine only (no DOM, events, or promises); the component's `start*` methods keep their side effects and just assign the result, so Lit reactivity is automatic via the `@state` setter and the constructors are unit-testable without a DOM (matching the repo convention of pure logic in `foundations/`, thin components). Mode exclusivity becomes free — assigning a new variant clears the others. **Deliberately NOT** a single `transition(state, action)` reducer or a `ReactiveController` yet (YAGNI); reserve the reducer as a future step _if_ transition guards accumulate (e.g. "only append a point while connecting").
    - **Boundary — cursor state stays view-local.** `mouseX/Y`, `mouseX2/Y2`, `mouseX2f/Y2f` remain per-substation on the view, NOT in the shared `Interaction`.
    - **Channels — downward collapses, upward stays.** The 9 hand-bound downward props become a single `.interaction` property; the 13 upward gesture events are unchanged (that is the view→controller channel — the view reports intent, the controller owns the transition).
  - **Migration is behavior-preserving and guarded** by the existing exclusivity invariant test in `sld-editor.spec.ts`. Verify each step with `tsc --noEmit` + `npm run test` + `npm run format`. Incremental phases:
    - [x] **Phase 1 — additive:** `Interaction` union + `Terminal` type + pure constructors (`idle`, `placing`, `placingLabel`, `resizingBR`, `resizingTL`, `connectingFrom`, `appendConnectionPoint`) added to `foundations/interaction-mode.ts` alongside the still-present `InteractionMode` string union, with a DOM-free `interaction-mode.spec.ts`. No behavior change (502 tests pass).
    - [x] **Phase 2 & 3 (merged) —** `SldEditor` owns a single `@state() interaction`; `reset()`/`start*` assign variants; deleted the `interactionMode` getter (use `this.interaction.mode`). Same change collapsed the downward channel: `render()` passes one `.interaction`; `SldSubstationViewer` replaced its 6 re-declared `@property` fields (and `placingOffset`) with one `interaction` `@property` plus read-only derived getters (`placing`/`placingOffset`/`placingLabel`/`resizingBR`/`resizingTL`/`connecting`) that keep the old names/shapes so the entire render surface, view context objects, and `drawing/artifacts/*` stay untouched. `SldEditor` carries the same derived getters so `oscd-editor-sld.spec.ts` and other read-sites need no change. Behaviour-preserving; verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`502 passed, 0 failed`), and `npm run format`.
    - [x] **Phase 4 —** removed the now-unused `InteractionMode` string union (was only self-referenced) and tidied dead helpers: deleted the immutable `appendConnectionPoint` constructor + its spec (production grows the connect path by in-place array mutation + manual `requestUpdate()`, so the helper was dead — see future item below), and inlined the now-pointless `resetWithOffset()` delegator into its single caller (`oscd-editor-sld.ts` → `reset()`). Also deduplicated the `connecting` getter's return type in both components to reference the existing `StartConnectDetail` type instead of re-declaring its shape. Verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`499 passed, 0 failed` — the 3 dropped tests were `appendConnectionPoint`'s), and `npm run format`.
  - **Two minor smells deliberately left for separate follow-ups** (see future list): (a) the connect-path **in-place mutation + manual `requestUpdate()`** pattern in `sld-substation-viewer.ts`/`connectivity-node.ts` (load-bearing because Lit `@state` does not detect intra-array mutation); converting it to immutable reassignment is a behaviour-sensitive change, not a tidy. (b) `SldEditor`'s derived getters (`placing`/`placingLabel`/`resizingBR`/`resizingTL`/`connecting`) are now **test-only** — no internal production reads — kept for ergonomic spec assertions and editor/viewer symmetry.
  - Note: this did **not** end up subsuming the two smaller boundary findings below (the dead `nsp` in the view; the inline edit dispatch) — they remain open as separate items.
- [x] **Make the connect-path growth immutable (remove in-place array mutation). DONE.** While connecting, the path was grown by mutating the `Interaction`'s `path` array in place and calling `requestUpdate()` by hand (`sld-substation-viewer.ts` `renderConnectionPreviewLayer`, `drawing/artifacts/connectivity-node.ts`), which worked only because Lit `@state` does not detect intra-array mutation. Fixed by making the growth a pure, immutable reassignment owned by the controller rather than a view-side mutation. Added pure `extendConnectPointPaths(path, corner, ...rest): Point[]` in `foundations/geometry.ts` (returns a fresh, `cleanPath`-normalised array; never mutates the input) with DOM-free unit tests. The **view reports intent**: `renderConnectionPreviewLayer`'s waypoint click now computes the next path with `extendConnectPointPaths` and dispatches a new `oscd-sld-extend-connect-point` event (`foundations/events.ts`) instead of mutating + `requestUpdate()`; the **controller owns the transition**: `SldEditor.extendConnectPoint(path)` reassigns `this.interaction = connectingFrom(element, terminal, path)` so reactivity is automatic and the value is never mutated behind its back. `connectivity-node.ts`'s connect-on-click likewise builds the new path immutably and passes it in `newConnectEvent` (it already dispatched immediately, so no interaction reassignment is needed there). Behaviour-preserving — the click/preview ordering is unchanged (extend dispatched first, then the conditional connect). Verified `./node_modules/.bin/tsc --noEmit`, `npm run test` (`512 passed, 0 failed`), and `npm run format`.

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

- **GUIDING PRINCIPLE for the viewer/editor split — the edit-vs-view litmus test.** When deciding where an operation belongs, ask: _does it produce an `EditV2` (mutate the SCL document)?_ → it belongs in the **editor/controller** layer (`SldEditor`). _Does it read/serialise the rendered view?_ → it belongs in the **view** layer (`SldSubstationViewer`). This is the rule that should drive the eventual `viewer / editor / plugin` module split. State of the four header buttons against this test, now that the header is an **editor-owned** `<sld-substation-header>` slotted into the viewer:
  | button | what it does | belongs to | status |
  |---|---|---|---|
  | **Resize dialog** | builds `updateSLDAttributes` → `newEditEventV2` | controller | **✅ editor-side: header → `resizeDialog.show(substation)`** |
  | **Delete** | `newEditEventV2({ node: substation })` | controller | **✅ editor-side: header → direct `newEditEventV2`** |
  | **Edit** | dialog → `newEditEventV2` | host/controller | **✅ editor-side: header → `editScl(substation)`** |
  | **Export** | serialises the rendered `<svg>` via `serializeForExport` | **view** | **✅ view-owned `viewer.exportableSvg()`; editor triggers `downloadSvg`** |
  Evidence the controller already owns the main gesture edits: `sld-editor.ts` handles `@oscd-sld-resize`/`-resize-tl`/`-place`/`-place-label`/`-connect`/`-rotate` and dispatches `newEditEventV2` (see `createResizeEdits`/`createResizeTLEdits` etc.). The viewer now emits only diagram-gesture intents.

## Current File Layout

### Root & Editor

- `src/oscd-editor-sld.ts` — Thin plugin orchestrator: lifecycle, namespace detection, event wiring between toolbar and editor
- `src/sld-editor.ts` — Editing kernel: placement state machine, resize, connect, rotate. Promise-based `startPlacing()` API. Owns the single `<sld-resize-substation-dialog>` instance.
- `src/sld-substation-viewer.ts` — SVG rendering orchestration + context menu delegation. `render()` is now a paint-order layer stack of `render*` sub-methods. Emits only diagram-gesture intents; renders a `<slot name="header">` for editor-owned chrome. Future split target for viewer extraction.
- `src/sld-substation-header.ts` — Editor-owned substation chrome (name + Edit/Resize/Delete/Export buttons), slotted into the viewer's `header` slot. Reports intent only via `sld-header-{edit,resize,delete,export}`; the editor decides what each command means.
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

- `npm run format` passed; `tsc --noEmit` clean.
- `npm run test` passed with `551 passed, 0 failed` (added 7 direct base-layer `guard`-contract tests to `sld-substation-viewer.spec.ts`; gave both `getSldSubstationViewer` spec helpers an optional `substation` selector matching by `.substation` identity instead of document order).
- Base-layer guard memoization is now covered directly (not only indirectly via `sld-editor.spec.ts`): a spy-based `describe('SldSubstationViewer base-layer guard memoization')` asserts the guarded layers are reused while `placing` (yet `render()` still runs), refreshed while `resizingBR`/`connectingFrom`, skipped entirely while `idle`, and invalidated by `docVersion`/`showLabels`/`showIeds`/`highlight`/`selectable` — plus placed-element suppression from the base layer.
- `npm run format` passed; `tsc --noEmit` clean.
- `npm run test` passed with `543 passed, 0 failed` (base SVG layers wrapped in `guard` to memoize across cursor-driven re-renders; `attributes()` resolves each element's SLD-attribute source node once instead of ~12×; new isolated benchmark `sld-substation-viewer.spec.ts`).
- Coordinate tooltip hoisted: one editor-owned `<sld-coordinate-tooltip>` replaces the per-substation instances. State is split by update frequency — the low-frequency interaction gesture is passed as a single `interaction: InteractionState` prop from `SldEditor` (matching `SldSubstationViewer`); the high-frequency grid coordinates are derived inside the tooltip's own `pointermove` handler, which resolves the surface under the cursor via a `substationOf` resolver prop and CTM-converts client→grid, so a moving cursor re-renders only the tooltip. The pure core lives in `foundations/interaction-readout.ts` (`interactionReadout` / `InteractionReadout`) and consumes the union directly (`switch (interaction.mode)`), so illegal gesture mixes are unrepresentable — a DOM-free peer of `sld-placement.ts` / `interaction-mode.ts`, leaving `sld-coordinate-tooltip.ts` as the imperative Lit shell. The viewer no longer references the tooltip.
- `SldEditor` no longer exposes `placing` / `placingLabel` / `resizingBR` / `resizingTL` / `connecting` getters: the two dead ones (`resizingTL`, `connecting`) were removed outright, and specs now read the interaction union via `targetInMode(interaction, mode)` instead of the three test-only getters.

- `npm run format` passed; `tsc --noEmit` clean.
- `npm run test` passed with `532 passed, 0 failed` (after unifying the connect-elbow geometry; +3 busbar-connect characterization specs, +3 `elbowCorner` unit specs).
- Connect-elbow geometry unified: the shared 90° bend is `foundations/geometry.ts` `elbowCorner(path, target)`; both `connectPreviewElbow` (viewer preview) and `connectivity-node.ts` (busbar-connect click) delegate to it. The busbar-specific `findIntersection` clamp stays local. The connect-to-busbar click path is now covered by characterization specs in `connectivity-node.spec.ts`.

- `npm run format` passed; `tsc --noEmit` clean.
- `npm run test` passed with `522 passed, 0 failed` (after collapsing the downward interaction projections; +8 selector tests).
- Downward projection collapsed: the viewer no longer fans `interaction` out into six flat context fields. Contexts carry only `interaction: InteractionState`; artifacts read it through three pure selectors in `foundations/interaction-mode.ts` — `isMode`, `targetInMode`, `connectDetail`. The unused `Connecting` type was deleted; `test-context.ts`/specs now build interaction via constructors, so illegal-state combinations are unrepresentable in tests as well as production.

- `npm run format` passed; `tsc --noEmit` clean.
- `npm run test` passed with `514 passed, 0 failed` (after collapsing the upward `start*` events).
- Upward gesture channel collapsed: the five `newStart*Event` factories/types (place, place-label, resize-br, resize-tl, connect) replaced by one `newStartInteractionEvent` (`oscd-sld-start-interaction`) carrying an `InteractionIntent` discriminated union; `SldEditor` handles it via a single `handleStartInteraction` switch on both viewer and context-menu. The editor-owned state type `Interaction` was renamed `InteractionState`, forming a legible reciprocal pair with `InteractionIntent` (state flows editor→viewer; intent flows viewer→editor). `.interaction` property / `interactions` namespace unchanged; `StartEvent` and `StartConnectDetail` retained.

- `npm run format` passed.
- `npm run test` passed with `512 passed, 0 failed` (after the immutable connect-path change; +3 new `extendConnectPointPaths` geometry specs).
- Connect-path growth is now immutable: `foundations/geometry.ts` `extendConnectPointPaths` (pure) + `oscd-sld-extend-connect-point` event + `SldEditor.extendConnectPoint` (controller-owned reassignment). No remaining in-place `path` mutation or manual `requestUpdate()` in the connect flow.

- `npm run format` passed.
- `npm run test` passed with `512 passed, 0 failed` (after the colour-theming workstream).
- Colour theming: `src/theme.ts` exposes a two-tier Material-3 token system (foundation mirrors oscd-theme → SLD brand palette → SLD semantic tokens), consumed across the diagram artifacts and component chrome. Public override hooks are `--oscd-editor-sld-*`.

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

## `sld-substation-viewer.ts` Analysis — The (Shrinking) Elephant (~930 lines)

Still the largest single file and the future viewer extraction target, but no
longer the 2,173-line monolith this section originally described: Phase A
(artifact descriptors) and Phase B (diagram symbols) below are **done**, which
moved ~1,200 lines of per-artifact SVG rendering out into `drawing/`. What
remains is a thinner viewer that still mixes three concerns — SVG composition,
interaction-overlay rendering, and edit dispatch — with the interaction/render
split (Phase C) the main outstanding decomposition.

### Structural breakdown (current)

The file is now dominated by small, focused methods rather than a few giant
ones. Grouped by role:

| Group                        | Approx. lines | Contents                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `render()` composition       | ~73           | The `<svg>` scaffold, the `@mousemove` coordinate tracker, and the z-ordered list of `render*Layer` calls. No per-artifact drawing.                                                                                                                                                                                                                                             |
| Interaction-overlay layers   | ~245          | The `render*Layer` band methods: `renderConnectionPreviewLayer` (~73, now the largest), `renderPlacingTargetsLayer` (~51), `renderPlacingPreview` (~25), plus the small VL/connectivity/PT/IED/label band methods. This is the editing overlay — Phase C territory. (The coordinate tooltip is no longer here — it is a single editor-owned `<sld-coordinate-tooltip>`.)        |
| Artifact wrappers + contexts | ~150          | Thin delegating wrappers (`renderEquipment`, `renderPowerTransformer`, `renderConnectivityNode`, `renderBusBar`, `renderIed`, `renderLabel`) that call the generic `renderArtifact(descriptor, element, context, options)`, plus the per-artifact context builders (`sharedContext`, `equipmentContext`, `labelContext`, `powerTransformerContext`, `connectivityNodeContext`). |
| Viewer state + utilities     | ~250          | 30+ `@property`/`@state` fields, mouse-coordinate transforms (`svgCoordinates`, `gridPosition`, `halfGridPosition`, `renderedPosition`, `renderedLabelPosition`), and edit-adjacent helpers (`nearestOpenTerminal`, `groundTerminal`, IED-resolution cache).                                                                                                                    |
| `static styles`              | ~20           | Component chrome CSS (most colour tokens now live in `theme.ts`).                                                                                                                                                                                                                                                                                                               |

The per-artifact renderers the original table listed as 251/215/116/115-line
methods (`renderEquipment`, `renderConnectivityNode`, transformer/label, …) are
now the 10–30-line delegating wrappers above; their bodies live in
`drawing/artifacts/*`.

### Three concerns interleaved

1. **Pure SVG rendering** — largely **extracted**. Each artifact type now owns
   its state derivation, action wiring, and SVG composition in
   `drawing/artifacts/*`; the viewer only builds a per-artifact context and
   delegates via `renderArtifact`.

2. **Interaction-overlay rendering** — the bulk of what remains. Placement,
   resizing, and connection preview are composed by the `render*Layer` methods
   (placing targets, invalid-placement feedback, connection preview polylines).
   This is editing logic, not viewing, and is the target of Phase C. (The
   placement/resize coordinate read-out already moved out to a single
   editor-owned `<sld-coordinate-tooltip>`.)

3. **Edit dispatch** — `groundTerminal()` and various `@click` handlers still
   build intent events / edits from the viewer; the larger edit-vs-view
   consolidation (routing through `SldEditor`) is tracked in the completed
   interaction-state and event-vocabulary workstreams above.

### Current decomposition strategy

**Phase A: Extract functional artifact descriptors — Done.**

Each artifact type is a functional descriptor in `src/drawing/artifacts/`. The
descriptor owns artifact-specific state derivation, action wiring, and SVG
composition. `SldSubstationViewer` builds a per-artifact context (spread from a
shared base — see the discipline pass below) and calls
`renderArtifact(descriptor, element, context, options)`.

| Module                                      | Contains                                                               |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `drawing/artifacts/conducting-equipment.ts` | ConductingEquipment artifact descriptor: state, actions, SVG rendering |
| `drawing/artifacts/artifact.ts`             | Shared artifact descriptor/context types                               |
| `drawing/artifacts/equipment-container.ts`  | Bay/VoltageLevel artifact descriptor                                   |
| `drawing/artifacts/connectivity-node.ts`    | ConnectivityNode artifact descriptor                                   |
| `drawing/artifacts/power-transformer.ts`    | PowerTransformer + TransformerWinding artifact descriptor              |
| `drawing/artifacts/label.ts`                | Label artifact descriptor/helper                                       |
| `drawing/artifacts/ied-reference.ts`        | IED reference artifact descriptor: state, actions, SVG rendering       |
| `drawing/artifacts/bus-bar.ts`              | BusBar artifact descriptor                                             |

Descriptor shape (source of truth: `artifact.ts`; carries a `TContext` generic —
see the discipline pass below):

```typescript
type SldArtifactDescriptor<
  TState,
  TActions,
  TContext extends SldSharedContext,
> = {
  matches(element: Element): boolean;
  state(element, context, options?): TState | undefined;
  actions(element, context, state): TActions;
  render(element, state, actions, context, options?): SVGTemplateResult;
};
```

Implemented viewer wrappers (each a thin delegate to `renderArtifact`):

- `renderEquipment()` → `conductingEquipmentArtifact`
- `renderIed()` → `iedReferenceArtifact`
- `renderBusBar()` → `busBarArtifact`
- `renderPowerTransformer()` → `powerTransformerArtifact`
- `renderConnectivityNode()` → `drawing/artifacts/connectivity-node.ts`
- `renderLabel()` → `drawing/artifacts/label.ts`

The per-artifact context must be kept disciplined. The shared base
(`SldSharedContext`) should contain truly common editor/render services only;
artifact-specific needs stay in that artifact's own context type (which extends
the base) — see the discipline pass below.

### `SldArtifactContext` discipline pass — Complete

The flat `SldArtifactContext` (~24 fields) was split so single-consumer
dependencies are no longer shared. The descriptor now carries a `TContext`
generic, and each artifact declares its own context type extending a small
shared base:

```typescript
type SldArtifactDescriptor<TState, TActions, TContext extends SldSharedContext>
```

| Type                      | Owner module                        | Fields                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SldSharedContext`        | `artifacts/artifact.ts`             | `disabled`, `dispatch`, `gridPosition`, `halfGridPosition`, `interaction`, `requestContextMenu`, `resolveIed`, `renderLabel`, `renderedPosition`, `selectable`, `substation`, `view` (used by ≥2 artifacts) |
| `EquipmentContext`        | `artifacts/conducting-equipment.ts` | shared + `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nearestOpenTerminal`, `nsp`                                                                                                                    |
| `PowerTransformerContext` | `artifacts/power-transformer.ts`    | shared + `groundTerminal`, `highlight`, `mouseX`, `mouseY`, `nsp`                                                                                                                                           |
| `ConnectivityNodeContext` | `artifacts/connectivity-node.ts`    | shared + `mouseX`, `mouseY`, `mouseX2`, `mouseY2`                                                                                                                                                           |
| `BusBarContext`           | `artifacts/bus-bar.ts`              | alias of `ConnectivityNodeContext`                                                                                                                                                                          |
| `LabelContext`            | `artifacts/label.ts`                | shared + `mouseX2`, `mouseY2`, `renderedLabelPosition`                                                                                                                                                      |
| (ied-reference)           | uses `SldSharedContext` directly    | —                                                                                                                                                                                                           |

Note: the single `interaction: InteractionState` field on `SldSharedContext`
replaced the earlier per-artifact `placing`/`placingLabel`/`connecting`/
`resizingTL`/`resizingBR`/`idle` fan-out; artifacts now read it through the
`isMode`/`targetInMode`/`connectDetail` selectors (see the completed downward-
projection collapse workstream above), so the now-deleted `Connecting` type is
gone.

The editor builds the shared bag once in `sharedContext()` and spreads it into
per-artifact builders (`equipmentContext()`, `powerTransformerContext()`,
`labelContext()`, `busBarContext()`, `connectivityNodeContext()`).
`renderArtifact()` takes the context as an argument.

Remaining smell (deferred): the shared `renderLabel` and bus-bar's
`renderConnectivityNode` are editor render callbacks, creating
artifact→editor→artifact cycles. Removing those cycles is the last
Phase-A-adjacent cleanup (the artifact modules themselves are extracted).

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
`this.disabled`, `this.showLabels`, etc. Some of these are now derived getters off
the consolidated `this.interaction` state (e.g. `placing`, `placingOffset`) rather
than raw fields, but they are still read directly off the component. The extraction
requires threading a context object. The interface is stable so this is mechanical
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
   scaffolds via `sldFixture()` in `test-helpers.ts`; the opportunistic follow-up
   (converting `context-menu/sld-context-menu.spec.ts` and the eligible
   `foundations/edits.spec.ts` fixtures) is also done — see Completed Workstreams.
7. ~~**Expose themable artifact colours as CSS variables**~~ — Done. The rendered
   diagram was already fully tokenised by the theming workstream (the old
   "equipment top-indicator `#BB1326`" example is stale — it renders via
   `var(--oscd-sld-terminal-color)`). The residual context-menu literals are now
   split into themed chrome vs. deliberately-literal persisted document values —
   see Completed Workstreams.

### Future (module split preparation)

1. Define viewer API boundary (SCL Element in, SVG + events out)
2. Identify which foundations belong to viewer vs editor
3. Design edit event API for editor → plugin communication
4. Decide whether SLD UI icons should eventually merge into oscd-ui/SCL icon registries
