import { Dimensions, Platform } from 'react-native';

// Layer 2 fingerprint signals (plan §7.9). Raw hardware/screen/timezone facts;
// the server hashes fingerprintParts into one composite hash. Cloned apps on the
// same phone report the same parts → the same hash. Native-only fields for now
// (canvas/WebGL audio hashes come with the Pi web build).
export function collectDeviceSignals(): {
  platform: 'pi-web' | 'sidra-mobile';
  fingerprintParts: string[];
  hardwareJson: string;
  timezone: string;
} {
  const c = Platform.constants as Record<string, unknown>;
  const scr = Dimensions.get('screen');
  let timezone = 'unknown';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    // Intl not available — leave as unknown.
  }
  const hardware = {
    os: Platform.OS,
    brand: (c.Brand ?? c.Manufacturer ?? null) as string | null,
    model: (c.Model ?? null) as string | null,
    buildFingerprint: (c.Fingerprint ?? null) as string | null,
    systemVersion: String(Platform.Version ?? ''),
    width: scr.width,
    height: scr.height,
    scale: scr.scale,
  };
  return {
    platform: 'sidra-mobile',
    fingerprintParts: [
      hardware.os,
      hardware.brand ?? '',
      hardware.model ?? '',
      hardware.buildFingerprint ?? '',
      hardware.systemVersion,
      String(hardware.width),
      String(hardware.height),
      String(hardware.scale),
    ],
    hardwareJson: JSON.stringify(hardware),
    timezone,
  };
}
