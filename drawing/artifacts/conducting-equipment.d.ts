import type { Point } from '../../foundations/geometry.js';
import type { SldArtifactDescriptor } from './artifact.js';
export type EquipmentRenderState = {
    bottomGrounded: boolean;
    canShowBottomPort: boolean;
    canShowTopPort: boolean;
    clickthrough: boolean;
    diagramElementId?: string;
    disabled: boolean;
    highlightedStyle?: string;
    placingSelf: boolean;
    portPointerEventsDisabled: boolean;
    position: Point;
    selectable: boolean;
    showBottomConnectIndicator: boolean;
    showTopConnectIndicator: boolean;
    topGrounded: boolean;
};
export type EquipmentRenderActions = {
    onAuxClick: (event: MouseEvent) => void;
    onClick: (event: MouseEvent) => void;
    onContextMenu: (event: MouseEvent) => void;
    onGroundBottom: (event: MouseEvent) => void;
    onGroundTop: (event: MouseEvent) => void;
    onMouseDown: (event: MouseEvent) => void;
    onStartBottomConnect: () => void;
    onStartTopConnect: () => void;
};
export declare const conductingEquipmentArtifact: SldArtifactDescriptor<EquipmentRenderState, EquipmentRenderActions>;
