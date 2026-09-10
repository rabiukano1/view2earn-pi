// Shared design tokens — one source of truth for the app's modern look.
// Screens keep their light/dark StyleSheet keys but pull values from here so
// spacing, radii, colour and elevation stay consistent everywhere.

export const colors = {
  primary: '#7C3AED',
  primaryDeep: '#6D28D9',
  primarySoft: '#EDE9FE',
  primarySoftDark: '#2A1D53',

  bg: '#F7F7FA',
  bgDark: '#0E0E12',
  surface: '#FFFFFF',
  surfaceDark: '#1A1A20',
  surfaceAlt: '#F1F1F4',
  surfaceAltDark: '#26262D',

  border: '#ECECEF',
  borderDark: '#2C2C34',

  text: '#161618',
  textDark: '#F5F5F7',
  textMuted: '#71717A',
  textFaint: '#A1A1AA',

  success: '#10B981',
  successSoft: '#DCFCE7',
  danger: '#EF4444',
  dangerSoft: '#FEE2E2',
  warn: '#F59E0B',
  white: '#FFFFFF',
} as const;

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

// Elevation presets. Android reads `elevation`; iOS reads the shadow* fields.
export const shadow = {
  card: {
    shadowColor: '#0B0B12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  raised: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  float: {
    shadowColor: '#0B0B12',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;
