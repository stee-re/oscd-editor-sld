import { sldNs } from '../foundations.js';
import { sldAttributes } from './sld-attributes.js';

import type { EditV2 } from '@openscd/oscd-api';

export function updateSLDAttributes(
  element: Element,
  nsPrefix: string,
  values: Partial<Record<string, string | null>>,
): EditV2 {
  const isSectionOrVertex = ['Section', 'Vertex'].includes(element.localName);
  const toBeUpdated = isSectionOrVertex
    ? element
    : sldAttributes(element, nsPrefix)!;

  return {
    element: toBeUpdated,
    attributesNS: {
      [sldNs]: Object.fromEntries(
        Object.entries(values).map(([key, value]) => [
          `${nsPrefix}:${key}`,
          value,
        ]),
      ),
    },
  };
}
