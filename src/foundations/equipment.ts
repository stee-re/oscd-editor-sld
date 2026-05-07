export const eqTypes = [
  'CAB',
  'CAP',
  'CBR',
  'CTR',
  'DIS',
  'GEN',
  'IFL',
  'LIN',
  'MOT',
  'REA',
  'RES',
  'SAR',
  'SMC',
  'VTR',
] as const;

export type EqType = (typeof eqTypes)[number];

export function isEqType(str: string): str is EqType {
  return eqTypes.includes(str as EqType);
}

export const ringedEqTypes = new Set(['GEN', 'MOT', 'SMC']);

export const singleTerminal = new Set([
  'BAT',
  'EFN',
  'FAN',
  'GEN',
  'IFL',
  'MOT',
  'PMP',
  'RRC',
  'SAR',
  'SMC',
  'VTR',
]);
