const prettifyXSLT = new DOMParser().parseFromString(
  [
    // Describes how we want to modify the XML: indent everything.
    '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
    '  <xsl:strip-space elements="*"/>',
    '  <xsl:template match="para[content-style][not(text())]">',
    '    <xsl:value-of select="normalize-space(.)"/>',
    '  </xsl:template>',
    '  <xsl:template match="node()|@*">',
    '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
    '  </xsl:template>',
    '  <xsl:output indent="yes"/>',
    '</xsl:stylesheet>',
  ].join('\n'),
  'application/xml',
);

let xsltProcessor: XSLTProcessor | undefined;

if (!navigator.userAgent.toLowerCase().includes('firefox')) {
  xsltProcessor = new XSLTProcessor();
  xsltProcessor.importStylesheet(prettifyXSLT);
}

function prettyPrint(xmlDoc: XMLDocument | Element): string {
  const doc = xsltProcessor
    ? xsltProcessor.transformToDocument(xmlDoc)
    : xmlDoc;

  return new XMLSerializer().serializeToString(doc);
}

function cleanXML(element: Element): void {
  const cl = element.classList;

  if (
    cl.contains('handle') ||
    cl.contains('preview') ||
    cl.contains('port') ||
    (cl.contains('label') && cl.contains('container'))
  ) {
    element.remove();
    return;
  }

  if (cl.contains('voltagelevel') || cl.contains('bay')) {
    element.querySelector('rect')?.remove();
  }

  Array.from(element.childNodes).forEach((child) => {
    if (child.nodeType === 8) {
      element.removeChild(child);
    }

    if (child.nodeType === 1) {
      cleanXML(child as Element);
    }
  });
}

function downloadBlob(blob: Blob, filename: string): void {
  const a = document.createElement('a');

  a.download = filename;
  a.href = URL.createObjectURL(blob);
  a.dataset.downloadurl = ['application/xml', a.download, a.href].join(':');
  a.style.display = 'none';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 5000);
}

/**
 * Serializes the rendered SLD SVG, removes editor-only interaction elements,
 * and triggers a download of the result as an SVG file.
 */
export function exportSVG({
  svg,
  filename,
}: {
  svg: Element;
  filename: string;
}): void {
  const exportedSvg = svg.cloneNode(true) as Element;

  cleanXML(exportedSvg);

  const blob = new Blob([prettyPrint(exportedSvg)], {
    type: 'application/xml',
  });

  downloadBlob(blob, filename);
}
