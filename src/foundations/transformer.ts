export const transformerKinds = ['default', 'auto', 'earthing'] as const;

export type TransformerKind = (typeof transformerKinds)[number];

export function isTransformerKind(
  kind: string | null,
): kind is TransformerKind {
  return transformerKinds.includes(kind as TransformerKind);
}
