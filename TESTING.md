# Testing the SLD editor

This document covers the **SLD-specific** test helpers in this repository — the things that go beyond the standard `@open-wc/testing` + `@web/test-runner` patterns you will already recognise from other OpenSCD plugins. If a helper just does the obvious thing (mount a component, query the shadow DOM, assert on an edit event), it is not covered here.

There are two testing layers, and knowing which one you are in tells you which helpers to reach for:

| Layer | You are testing | Component mounted? | Real mouse? | Key helpers |
| --- | --- | --- | --- | --- |
| **Artifact unit** | A single artifact's `matches` / `state` / `actions` / `render` in isolation | No | No | `makeArtifactContext`, `renderToSvg` (`src/drawing/artifacts/test-context.ts`) |
| **Component integration** | The mounted `SldEditor` / viewer driving the real grid | Yes | Usually | `sldFixture`, the grid/coordinate converters, `sendMouse` (`src/test-helpers.ts`) |

The single most important thing to internalise: **you can drive a lot of the grid without `sendMouse`.** The rest of this document explains where the line is.

## 1. The grid and its coordinate systems

The SLD is drawn into an SVG whose `viewBox` is the grid: **one SVG user unit is one grid cell**. A mouse interaction has to travel through up to four coordinate systems, and the tests have a converter for each hop.

### The four coordinate systems

| System | Unit / rounding | Where it comes from |
| --- | --- | --- |
| **Grid cell** | integer cell, `Math.floor(svgX)` | `gridPosition()` — placement, resizing, most clicks |
| **Half-grid** | nearest `0.5`, `Math.round(svgX * 2) / 2` | `halfGridPosition()` — connection vertices, label drag |
| **SCL label storage** | as persisted on the element | `lx = mouseX2 - 0.5`, `ly = mouseY2 + 0.5` |
| **Viewport pixels** | browser CSS pixels | what `sendMouse` and `MouseEvent.clientX/Y` speak |

Because the substation SVG has an **intrinsic resolution** that is scaled to fit its container, a given grid cell does **not** live at a fixed pixel offset — it depends on the element's `getBoundingClientRect()` and its `viewBox` at the moment of the test. Hardcoding pixels is the classic way to get a test that passes locally and fails in CI or another browser.

### The converters (`src/test-helpers.ts`)

All of them take the substation SVG (via `findSubstationSvgRoot(viewer)`) and resolve pixels **dynamically** from the live rect + viewBox:

- **`gridPosToViewportCoords(svg, gx, gy)`** → pixel at the **centre** of cell `(gx, gy)`. The `+ 0.5` cell-centering is deliberate: it guarantees that the component's `Math.floor` lands back on the cell you asked for, even with sub-pixel rounding.
- **`sclLabelToViewportCoords(svg, lx, ly)`** → pixel to click so a label ends up stored at `(lx, ly)`. It **inverts** the component's label-storage formula (`svgX = lx + 0.5`, `svgY = ly - 0.5`), so you assert on the SCL values you actually want rather than reverse-engineering them per test.
- **`svgToViewportCoords(svg, svgX, svgY)`** → pixel at an exact SVG point. Use when **half-grid precision** matters (e.g. connection vertices), where `Math.floor` cell-snapping would throw the value away.

The usual pattern is to wrap them once per spec so each call reads cleanly:

```ts
const gridPos = (gx: number, gy: number) =>
  gridPosToViewportCoords(
    findSubstationSvgRoot(getSldSubstationViewer(element)!),
    gx,
    gy,
  );

await sendMouse({ type: "click", position: gridPos(5, 3) });
```

### Testing the grid **without** `sendMouse`

`sendMouse` (from `@web/test-runner-commands`) produces a **trusted** event carrying real viewport coordinates over the laid-out SVG. You need it in exactly one situation; everywhere else a synthetic event is enough. The deciding factor is a fallback in the viewer:

```ts
// sld-substation-viewer.ts — gridPosition()/halfGridPosition()
if (!event.isTrusted && !event.clientX && !event.clientY) {
  return [this.mouseX, this.mouseY]; // fall back to the stored mouse
}
```

That single line drives the whole decision:

1. **Handler doesn't depend on where you clicked** → dispatch a **coordless synthetic event** on the target element. It is untrusted with no coords, so `gridPosition` returns the viewer's _stored_ mouse — which is fine because the handler only cares that _this element_ was clicked:

   ```ts
   queryUI({ scl: "VoltageLevel", ui: "rect" }).dispatchEvent(
     new PointerEvent("contextmenu"),
   ); // opens the menu, no coords needed
   ```

2. **Handler needs coordinates but not a specific cell** → establish the mouse position with a `sendMouse` _move_, then dispatch a **coordful synthetic event**. A coordful event bypasses the fallback (it has `clientX/Y`) even though it is untrusted:

   ```ts
   const [cx, cy] = gridPos(...vlOrigin);
   await sendMouse({ type: "move", position: [cx, cy] });
   voltageRect.dispatchEvent(
     new PointerEvent("contextmenu", { clientX: cx, clientY: cy }),
   );
   ```

3. **You are asserting which grid cell an action lands in** (placement, resize) → `sendMouse` **click** at a converter position is the sanctioned path. Only a trusted event over the real SVG hit-tests to the right cell _and_ updates the stored mouse so live preview follows the cursor:

   ```ts
   await sendMouse({ type: "click", position: gridPos(...placeTL) });
   ```

**Gotcha — the stale-mouse offset.** A _direct_ label click (as opposed to the "Move label" menu item) captures a drag offset from the _current_ mouse position. Specs `resetMouse()` in `afterEach`, leaving the mouse at `[0, 0]`, so that offset bakes the label's original position into the result. When you click to move such a label, target the SVG point that lands correctly _after_ the offset is applied — see the worked example in `sld-editor.spec.ts` ("moves the voltage level label on label left click").

At the **artifact unit layer** there is no grid at all: `makeArtifactContext` stubs `gridPosition` as the identity `({ clientX, clientY }) => [clientX, clientY]`, so a handler that reads the grid position just receives whatever coordinates you put on the synthetic event. See §4.

## 2. The standard fixture: `sldFixture`

`sldFixture()` (`src/test-helpers.ts`) builds the scaffold nearly every spec starts from: a laid-out

```
Substation S1 (50×25)
└─ VoltageLevel V1  @ (1,1) 20×20
   └─ Bay B1        @ (2,2) 10×10
```

into which you inject the leaf SCL you actually care about via `children`:

```ts
const doc = sldFixture({
  children: `<ConductingEquipment name="QA1" type="CBR">
               <Private type="OpenSCD-SLD-Layout">
                 <smth:SLDAttributes smth:x="4" smth:y="4" smth:w="1" smth:h="1"/>
               </Private>
             </ConductingEquipment>`,
});
```

Override `vl` / `bay` / `bayName` **only** for coordinates a spec asserts on (e.g. busbar specs use a differently named bay). Leaving the defaults keeps the coordinate constants below meaningful across specs.

### Named coordinate constants

These are shared grid-coordinate pairs, sized to the `sldFixture` layout, so specs don't scatter magic numbers:

| Constant | Cell | Meaning |
| --- | --- | --- |
| `vlOrigin` | `(1,1)` | the default VoltageLevel's top-left |
| `vlResizeBR` | `(8,7)` | resize target giving the VL `w=8, h=7` |
| `placeTL` | `(5,3)` | standard top-left when placing a new element |
| `placeBR` | `(11,10)` | resize corner from `placeTL` giving `w=7, h=8` |
| `eqPos` | `(4,4)` | equipment's position in the standard equipment doc |
| `eqTarget` | `(3,3)` | common move/copy destination |

Pass them straight into the converters with spread: `gridPos(...placeTL)`.

## 3. `createSCLDoc` and the decoy-attribute trap

`createSCLDoc(inner)` wraps `inner` in an `<SCL>` root and parses it — but it also does something non-obvious that every spec depends on. `sldFixture` is built on top of it, so this applies to almost every test.

**Every namespaced SLD attribute gets an unnamespaced decoy twin.** For each `smth:x="3"` it injects `x="DECOY"`:

- Code that correctly reads `getAttributeNS(sldNs, 'x')` → gets `"3"`.
- Code that lazily reads `getAttribute('x')` → gets `"DECOY"` and fails loudly.

This mirrors real-world fragility (hand-edited SCL, buggy serializers) where unnamespaced attributes end up sitting next to namespaced ones. The upshot for you as a test author: **you never need to add the decoys yourself**, and if a test suddenly reports `"DECOY"` somewhere, the production code under test is reading an SLD attribute without its namespace — that's the bug the trap exists to catch, not a fixture problem.

## 4. Artifact unit tests: `makeArtifactContext` + `renderToSvg`

Artifacts (`src/drawing/artifacts/*`) are the per-element descriptors that decide how a piece of SCL is drawn and what its interactions do. You can test them **without mounting a component or touching the real grid** using the harness in `test-context.ts`.

- **`makeArtifactContext(overrides)`** returns a `SpyArtifactContext` that satisfies every artifact context type at once, with neutral defaults (idle interaction, enabled, nothing being placed). It **records** what the artifact did, for assertions:
  - `dispatched: Event[]` — every event the artifact dispatched.
  - `grounded: { element, terminal }[]` — every `groundTerminal` call.
  - `renderedChildren: Element[]` — which children the artifact asked to render.

  Pass `overrides` to set the situation under test — e.g. `makeArtifactContext({ interaction: connectingFrom(equipment, 'T1', []) })` or `makeArtifactContext({ disabled: true })`.

- **Child renders are stubbed, not recursed.** `renderEquipment` / `renderIed` / `renderPowerTransformer` push the element into `renderedChildren` and return an empty ` svg` ``. Tests stay shallow: you assert _that_ a child was requested, without dragging its whole subtree into the assertion.

- **`renderToSvg(template)`** renders an artifact's `SVGTemplateResult` into a detached `<svg>` host and returns it, so you can query the produced SVG and dispatch events on it directly:

  ```ts
  const context = makeArtifactContext();
  const svg = renderToSvg(conductingEquipment(equipment, context));
  svg
    .querySelector(".port")!
    .dispatchEvent(new MouseEvent("click", { clientX: 4, clientY: 4 }));
  expect(context.dispatched.map((e) => e.type)).to.include(
    "oscd-sld-start-interaction",
  );
  ```

Because the context's `gridPosition` is the identity function, the `clientX/Y` you put on a synthetic event _is_ the grid position the handler sees — no viewBox maths, no `sendMouse`. This is the fastest way to exercise interaction logic; the component-integration layer (§1) exists for the things this layer deliberately stubs out: real layout, real hit-testing, and live preview.
