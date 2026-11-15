/**
 * ISO 3166-2:IN subdivision codes with GST state codes.
 * Stored values use the two-letter ISO code (e.g. KL for Kerala).
 */
export interface IndiaState {
  /** ISO 3166-2:IN two-letter code (e.g. KL) */
  code: string;
  /** Full ISO code (e.g. IN-KL) */
  iso: string;
  /** GST / numeric state code (zero-padded) */
  gstCode: string;
  name: string;
}

export const INDIA_STATES: readonly IndiaState[] = [
  {
    code: 'AN',
    iso: 'IN-AN',
    gstCode: '35',
    name: 'Andaman and Nicobar Islands',
  },
  { code: 'AP', iso: 'IN-AP', gstCode: '37', name: 'Andhra Pradesh' },
  { code: 'AR', iso: 'IN-AR', gstCode: '12', name: 'Arunachal Pradesh' },
  { code: 'AS', iso: 'IN-AS', gstCode: '18', name: 'Assam' },
  { code: 'BR', iso: 'IN-BR', gstCode: '10', name: 'Bihar' },
  { code: 'CH', iso: 'IN-CH', gstCode: '04', name: 'Chandigarh' },
  { code: 'CT', iso: 'IN-CT', gstCode: '22', name: 'Chhattisgarh' },
  {
    code: 'DN',
    iso: 'IN-DN',
    gstCode: '26',
    name: 'Dadra and Nagar Haveli and Daman and Diu',
  },
  { code: 'DL', iso: 'IN-DL', gstCode: '07', name: 'Delhi' },
  { code: 'GA', iso: 'IN-GA', gstCode: '30', name: 'Goa' },
  { code: 'GJ', iso: 'IN-GJ', gstCode: '24', name: 'Gujarat' },
  { code: 'HR', iso: 'IN-HR', gstCode: '06', name: 'Haryana' },
  { code: 'HP', iso: 'IN-HP', gstCode: '02', name: 'Himachal Pradesh' },
  { code: 'JK', iso: 'IN-JK', gstCode: '01', name: 'Jammu and Kashmir' },
  { code: 'JH', iso: 'IN-JH', gstCode: '20', name: 'Jharkhand' },
  { code: 'KA', iso: 'IN-KA', gstCode: '29', name: 'Karnataka' },
  { code: 'KL', iso: 'IN-KL', gstCode: '32', name: 'Kerala' },
  { code: 'LA', iso: 'IN-LA', gstCode: '38', name: 'Ladakh' },
  { code: 'LD', iso: 'IN-LD', gstCode: '31', name: 'Lakshadweep' },
  { code: 'MP', iso: 'IN-MP', gstCode: '23', name: 'Madhya Pradesh' },
  { code: 'MH', iso: 'IN-MH', gstCode: '27', name: 'Maharashtra' },
  { code: 'MN', iso: 'IN-MN', gstCode: '14', name: 'Manipur' },
  { code: 'ML', iso: 'IN-ML', gstCode: '17', name: 'Meghalaya' },
  { code: 'MZ', iso: 'IN-MZ', gstCode: '15', name: 'Mizoram' },
  { code: 'NL', iso: 'IN-NL', gstCode: '13', name: 'Nagaland' },
  { code: 'OR', iso: 'IN-OR', gstCode: '21', name: 'Odisha' },
  { code: 'PY', iso: 'IN-PY', gstCode: '34', name: 'Puducherry' },
  { code: 'PB', iso: 'IN-PB', gstCode: '03', name: 'Punjab' },
  { code: 'RJ', iso: 'IN-RJ', gstCode: '08', name: 'Rajasthan' },
  { code: 'SK', iso: 'IN-SK', gstCode: '11', name: 'Sikkim' },
  { code: 'TN', iso: 'IN-TN', gstCode: '33', name: 'Tamil Nadu' },
  { code: 'TG', iso: 'IN-TG', gstCode: '36', name: 'Telangana' },
  { code: 'TR', iso: 'IN-TR', gstCode: '16', name: 'Tripura' },
  { code: 'UP', iso: 'IN-UP', gstCode: '09', name: 'Uttar Pradesh' },
  { code: 'UT', iso: 'IN-UT', gstCode: '05', name: 'Uttarakhand' },
  { code: 'WB', iso: 'IN-WB', gstCode: '19', name: 'West Bengal' },
] as const;

export const INDIA_STATE_CODES: readonly string[] = INDIA_STATES.map(
  state => state.code,
);

export function isIndiaStateCode(code: string): boolean {
  return INDIA_STATE_CODES.includes(code);
}

export function getIndiaState(code: string): IndiaState | undefined {
  return INDIA_STATES.find(state => state.code === code);
}
