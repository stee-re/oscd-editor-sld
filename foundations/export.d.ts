/**
 * Serializes the rendered SLD SVG, removes editor-only interaction elements,
 * and triggers a download of the result as an SVG file.
 */
export declare function exportSVG({ svg, filename, }: {
    svg: Element;
    filename: string;
}): void;
