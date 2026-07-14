import { Platform } from 'react-native';

// Dev identity until Sidra auth (plan §7.1): one stable fingerprint per device,
// shared by every screen so they all resolve to the same user/balance.
export function deviceFingerprint(): string {
  const c = Platform.constants as Record<string, unknown>;
  const raw = `${c.Fingerprint ?? c.Model ?? 'unknown'}`;
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}
