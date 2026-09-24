export interface CourierCode {
  company: string;
  type: string;
}

// Strict mapping. Unknown methods produce a hard error, never a silent JNE fallback.
export const OUTBOUND_COURIER_MAP: Record<string, CourierCode> = {
  'JNE - REG': { company: 'jne', type: 'reg' },
  'JNE - YES': { company: 'jne', type: 'yes' },
  'SiCepat - REG': { company: 'sicepat', type: 'reg' },
  'Gosend - Instant': { company: 'gojek', type: 'instant' },
  'Paxel - Medium': { company: 'paxel', type: 'medium' },
};

export const RETURN_COURIER_MAP: Record<string, CourierCode> = {
  'paxel - regular': { company: 'paxel', type: 'medium' },
  'jne - reg': { company: 'jne', type: 'reg' },
  'gosend - instant': { company: 'gojek', type: 'instant' },
  'sicepat - reg': { company: 'sicepat', type: 'reg' },
};

export function resolveOutboundCourier(method: string): CourierCode {
  const key = (method || '').trim();
  const mapped = OUTBOUND_COURIER_MAP[key];
  if (!mapped) {
    throw new Error(
      `Unrecognized courier method "${method}". Valid options: ${Object.keys(OUTBOUND_COURIER_MAP).join(', ')}`,
    );
  }
  return mapped;
}

export function resolveReturnCourier(choice: string): CourierCode {
  const key = (choice || '').trim().toLowerCase();
  const mapped = RETURN_COURIER_MAP[key];
  if (!mapped) {
    throw new Error(
      `Unrecognized return courier "${choice}". Valid options: ${Object.keys(RETURN_COURIER_MAP).join(', ')}`,
    );
  }
  return mapped;
}
