import type { nothing, SVGTemplateResult } from 'lit';
import type { Point } from '../../foundations/geometry.js';
import type { Style } from '../../foundations/sld-attributes.js';

export type ArtifactRenderOptions = {
  connect?: boolean;
  preview?: boolean;
};

export type Connecting = {
  from: Element;
  path: Point[];
  fromTerminal: 'T1' | 'T2' | 'N1' | 'N2';
};

export type SldArtifactContext = {
  connecting?: Connecting;
  disabled: boolean;
  dispatch(event: Event): void;
  groundTerminal(element: Element, terminal: 'T1' | 'T2'): void;
  highlight: { id: string; style: Style }[];
  idle: boolean;
  mouseX: number;
  mouseY: number;
  nearestOpenTerminal(equipment?: Element): 'T1' | 'T2' | undefined;
  nsp: string;
  openContextMenu(element: Element, event: MouseEvent): void;
  placing?: Element;
  placingLabel?: Element;
  renderLabel(
    element: Element,
    options?: { preview?: boolean },
  ): SVGTemplateResult | typeof nothing;
  renderConnectivityNode(element: Element): SVGTemplateResult | typeof nothing;
  renderedPosition(element: Element): Point;
  resizingBR?: Element;
  resizingTL?: Element;
  selectable: string[];
  substation: Element;
  view: {
    showIeds?: boolean;
  };
};

export type SldArtifactDescriptor<TState, TActions> = {
  actions(
    element: Element,
    context: SldArtifactContext,
    state: TState,
  ): TActions;
  matches(element: Element): boolean;
  render(
    element: Element,
    state: TState,
    actions: TActions,
    context: SldArtifactContext,
    options?: ArtifactRenderOptions,
  ): SVGTemplateResult;
  state(
    element: Element,
    context: SldArtifactContext,
    options?: ArtifactRenderOptions,
  ): TState | undefined;
};
