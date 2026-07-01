import type { Point } from './geometry.js';

/** The four connectable terminals of an SLD equipment node. */
export type Terminal = 'T1' | 'T2' | 'N1' | 'N2';

/**
 * The single active interaction gesture, modelled as a discriminated union
 * keyed on `mode`. Exactly one variant is active at a time, so illegal
 * combinations (e.g. placing *and* resizing) are unrepresentable. Every active
 * variant carries its subject `element`; mode-specific extras hang off the
 * variant. The `mode` tag of each variant is the single source of truth for
 * "which gesture is active".
 *
 * This is the controller-owned *state*, projected **down** (editor → viewer) so
 * the view can render the in-progress gesture. Its reciprocal is
 * {@link InteractionIntent} (in `events.ts`), the view → editor *intent* to
 * begin a gesture. State vs. intent — same `Interaction` root, opposite
 * directions.
 */
export type InteractionState =
  | { mode: 'idle' }
  | { mode: 'placing'; element: Element; offset: Point }
  | { mode: 'placingLabel'; element: Element; offset: Point }
  | { mode: 'resizingBR'; element: Element }
  | { mode: 'resizingTL'; element: Element }
  | {
    mode: 'connectingFrom';
    element: Element;
    terminal: Terminal;
    path: Point[];
  };

/**
 * Pure constructors for each {@link InteractionState} variant. They compute the next
 * interaction *value* only — no DOM, no events, no promises. Side-effecting
 * orchestration (event dispatch, placement promises, `disabled` guards) stays
 * on the host component, which simply assigns the result.
 *
 * Reserved as a possible future step: if transition guards accumulate (e.g.
 * "only append a point while connecting"), these could be folded into a single
 * `transition(state, action)` reducer. Avoided for now (YAGNI) — the union plus
 * these one-line constructors already give free exclusivity and call-site
 * narrowing without the extra machinery.
 */
export const idle = (): InteractionState => ({ mode: 'idle' });

export const placing = (element: Element, offset: Point): InteractionState => ({
  mode: 'placing',
  element,
  offset,
});

export const placingLabel = (element: Element, offset: Point): InteractionState => ({
  mode: 'placingLabel',
  element,
  offset,
});

export const resizingBR = (element: Element): InteractionState => ({
  mode: 'resizingBR',
  element,
});

export const resizingTL = (element: Element): InteractionState => ({
  mode: 'resizingTL',
  element,
});

export const connectingFrom = (
  element: Element,
  terminal: Terminal,
  path: Point[] = [],
): InteractionState => ({ mode: 'connectingFrom', element, terminal, path });
