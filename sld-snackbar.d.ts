import { LitElement } from 'lit';
/**
 * Minimal snackbar component for temporary toast notifications.
 * API-compatible subset of mwc-snackbar: supports `labelText`, `.show()`, and auto-dismiss.
 * Intended as a local stopgap until oscd-ui provides a notification component.
 */
export declare class SldSnackbar extends LitElement {
    labelText: string;
    timeoutMs: number;
    open: boolean;
    private hideTimeout;
    show(): void;
    close(): void;
    static styles: import("lit").CSSResult;
    render(): import("lit-html").TemplateResult<1>;
}
