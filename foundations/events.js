export function newResizeEvent(detail) {
    return new CustomEvent('oscd-sld-resize', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newResizeTLEvent(detail) {
    return new CustomEvent('oscd-sld-resize-tl', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newPlaceEvent(detail) {
    return new CustomEvent('oscd-sld-place', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newPlaceLabelEvent(detail) {
    return new CustomEvent('oscd-sld-place-label', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newConnectEvent(detail) {
    return new CustomEvent('oscd-sld-connect', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newRotateEvent(detail) {
    return new CustomEvent('oscd-sld-rotate', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newStartResizeTLEvent(detail) {
    return new CustomEvent('oscd-sld-start-resize-tl', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newStartResizeBREvent(detail) {
    return new CustomEvent('oscd-sld-start-resize-br', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newStartPlaceEvent(element, offset = [0, 0]) {
    return new CustomEvent('oscd-sld-start-place', {
        bubbles: true,
        composed: true,
        detail: { element, offset },
    });
}
export function newStartPlaceLabelEvent(element, offset = [0, 0]) {
    return new CustomEvent('oscd-sld-start-place-label', {
        bubbles: true,
        composed: true,
        detail: { element, offset },
    });
}
export function newStartConnectEvent(detail) {
    return new CustomEvent('oscd-sld-start-connect', {
        bubbles: true,
        composed: true,
        detail,
    });
}
export function newSelectEvent(element) {
    return new CustomEvent('oscd-sld-selected', {
        bubbles: true,
        composed: true,
        detail: { element },
    });
}
export function newSclEditDialogEvent(element) {
    return new CustomEvent('oscd-sld-edit-scl', {
        bubbles: true,
        composed: true,
        detail: { element },
    });
}
export function newEditIedEvent(element) {
    return new CustomEvent('oscd-sld-edit-ied', {
        bubbles: true,
        composed: true,
        detail: { element },
    });
}
//# sourceMappingURL=events.js.map