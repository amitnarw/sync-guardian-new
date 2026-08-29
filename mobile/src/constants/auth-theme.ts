/**
 * "The Digital Sanctuary" Design System
 * Auth screens only - Earthy, organic, calming
 */

export const AuthColors = {
  // Primary palette - Forest greens
  primary: '#2f4a37',
  primaryContainer: '#c5eccc',
  onPrimary: '#ffffff',
  onPrimaryContainer: '#1b3223',

  // Secondary palette - Terracotta
  secondary: '#9f402d',
  secondaryContainer: '#fd876f',
  onSecondary: '#ffffff',
  onSecondaryContainer: '#732010',

  // Tertiary palette - Warm earth
  tertiary: '#745853',
  tertiaryContainer: '#b99791',
  onTertiary: '#ffffff',
  onTertiaryContainer: '#48302c',

  // Fixed colors for organic shapes
  primaryFixed: '#c9eea9',
  primaryFixedDim: '#aed18f',
  onPrimaryFixed: '#0b2000',
  onPrimaryFixedVariant: '#314e1b',
  secondaryFixed: '#ffdad3',
  secondaryFixedDim: '#ffb4a5',
  onSecondaryFixed: '#3e0500',
  onSecondaryFixedVariant: '#802918',
  tertiaryFixed: '#ffdad4',
  tertiaryFixedDim: '#e3beb8',
  onTertiaryFixed: '#2b1613',
  onTertiaryFixedVariant: '#5b403c',

  // Surface hierarchy - Cream based
  surface: '#fff8f0',
  surfaceBright: '#fff8f0',
  surfaceContainer: '#f5ede0',
  surfaceContainerHigh: '#efe7da',
  surfaceContainerHighest: '#eae1d2',
  surfaceContainerLow: '#faf3e7',
  surfaceContainerLowest: '#ffffff',
  surfaceDim: '#e5ddd0',
  surfaceTint: '#2f4a37',
  surfaceVariant: '#eae1d2',

  // On surface colors
  onSurface: '#1b1d0e',
  onSurfaceVariant: '#43483d',

  // Outline colors
  outline: '#74796c',
  outlineVariant: '#c4c8ba',

  // Inverse colors
  inverseSurface: '#303221',
  inverseOnSurface: '#f2f2d9',
  inversePrimary: '#aed18f',

  // Error colors
  error: '#ba1a1a',
  errorContainer: '#ffdad6',
  onError: '#ffffff',
  onErrorContainer: '#93000a',

  // Background
  background: '#fff8f0',
  onBackground: '#1b1d0e',
} as const;

// Typography for auth screens
export const AuthFonts = {
  displayLarge: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 57,
    lineHeight: 64,
    letterSpacing: -0.25,
  },
  displayMedium: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 45,
    lineHeight: 52,
    letterSpacing: 0,
  },
  displaySmall: {
    fontFamily: 'PlusJakartaSans-Bold',
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: 0,
  },
  headlineLarge: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0,
  },
  headlineMedium: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: 0,
  },
  headlineSmall: {
    fontFamily: 'PlusJakartaSans-SemiBold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0,
  },
  titleLarge: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  },
  titleMedium: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.15,
  },
  titleSmall: {
    fontFamily: 'PlusJakartaSans-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  bodyLarge: {
    fontFamily: 'Manrope-Regular',
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
  },
  bodyMedium: {
    fontFamily: 'Manrope-Regular',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
  },
  bodySmall: {
    fontFamily: 'Manrope-Regular',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
  },
  labelLarge: {
    fontFamily: 'Manrope-Medium',
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelMedium: {
    fontFamily: 'Manrope-Medium',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  labelSmall: {
    fontFamily: 'Manrope-Medium',
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.5,
  },
} as const;

// Spacing scale (multiplier of 4)
export const AuthSpacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

// Corner radii - organic, soft
export const AuthRadius = {
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  full: 9999,
} as const;

// Shadow for glassmorphism
export const AuthShadows = {
  ambient: {
    shadowColor: '#3e2723',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.06,
    shadowRadius: 40,
    elevation: 0,
  },
  float: {
    shadowColor: '#3e2723',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 40,
    elevation: 8,
  },
} as const;

// Gradient configurations
export const AuthGradients = {
  primaryButton: ['#2f4a37', '#1b3223'],
  secondaryButton: ['#9f402d', '#fd876f'],
  surfaceGlass: ['rgba(228, 228, 204, 0.6)', 'rgba(239, 239, 215, 0.4)'],
} as const;

export type AuthColorTheme = typeof AuthColors;