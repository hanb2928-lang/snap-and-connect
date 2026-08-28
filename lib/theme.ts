import { Platform } from 'react-native';

const _isWeb = Platform.OS === 'web';

export const theme = {
  colors: {
    primary: {
      50: '#eef9ff',
      100: '#d9f0ff',
      200: '#bce6ff',
      300: '#8ed6ff',
      400: '#59bdff',
      500: '#2f9dff',
      600: '#167ef5',
      700: '#1267e8',
      800: '#1454d4',
      900: '#1648a8',
      950: '#112c6f',
    },
    accent: {
      50: '#ecfdff',
      100: '#cff7fe',
      200: '#a4eefc',
      300: '#6de1f8',
      400: '#22ccec',
      500: '#06b3d4',
      600: '#0892b2',
      700: '#0d748f',
      800: '#155e75',
      900: '#164e63',
    },
    success: {
      50: '#ecfdf5',
      100: '#d1fae5',
      400: '#34d399',
      500: '#10b981',
      600: '#059669',
      700: '#047857',
    },
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706',
    },
    error: {
      50: '#fef2f2',
      100: '#fee2e2',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626',
    },
    neutral: {
      0: '#ffffff',
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a',
      950: '#020617',
    },
    dark: {
      bg: '#0a0f1e',
      surface: '#131a2e',
      surfaceLight: '#1e2740',
      border: '#2a3454',
      text: '#f1f5f9',
      textDim: '#94a3b8',
      textFaint: '#64748b',
    },
    light: {
      bg: '#f0f4fa',
      surface: '#ffffff',
      surfaceLight: '#eef3fb',
      border: '#d6e0ee',
      text: '#0f172a',
      textDim: '#475569',
      textFaint: '#94a3b8',
    },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 20,
    xl: 28,
    full: 9999,
  },
  typography: {
    fontFamily: {
      regular: 'PlusJakartaSans-Regular',
      medium: 'PlusJakartaSans-Medium',
      semiBold: 'PlusJakartaSans-SemiBold',
      bold: 'PlusJakartaSans-Bold',
    },
    title: 28,
    heading: 22,
    body: 16,
    caption: 14,
    micro: 12,
  },
  shadows: {
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 4,
    },
    elevated: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 8,
    },
    glowPrimary: {
      shadowColor: '#59bdff',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 0,
    },
    glowAccent: {
      shadowColor: '#22ccec',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 0,
    },
    glowSuccess: {
      shadowColor: '#34d399',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 0,
    },
    glowWarning: {
      shadowColor: '#fbbf24',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 0,
    },
  },
  glass: _isWeb
    ? {
        surface: 'rgba(19, 26, 46, 0.72)',
        surfaceLight: 'rgba(30, 39, 64, 0.6)',
        border: 'rgba(255, 255, 255, 0.08)',
        borderActive: 'rgba(89, 189, 255, 0.25)',
        highlight: 'rgba(255, 255, 255, 0.04)',
      }
    : {
        surface: '#131a2e',
        surfaceLight: '#1e2740',
        border: '#2a3454',
        borderActive: '#2a4a6b',
        highlight: '#1e2740',
      },
  glassLight: _isWeb
    ? {
        surface: 'rgba(255, 255, 255, 0.82)',
        surfaceLight: 'rgba(238, 243, 251, 0.7)',
        border: 'rgba(15, 23, 42, 0.08)',
        borderActive: 'rgba(47, 157, 255, 0.25)',
        highlight: 'rgba(15, 23, 42, 0.03)',
      }
    : {
        surface: '#ffffff',
        surfaceLight: '#eef3fb',
        border: '#d6e0ee',
        borderActive: '#a8c8e8',
        highlight: '#eef3fb',
      },
} as const;

export type ColorPalette = {
  bg: string; surface: string; surfaceLight: string; border: string;
  text: string; textDim: string; textFaint: string;
};
export type GlassColors = typeof theme.glass;
export type Spacing = { xs: number; sm: number; md: number; lg: number; xl: number; xxl: number };
export type Typography = {
  fontFamily: { regular: string; medium: string; semiBold: string; bold: string };
  title: number; heading: number; body: number; caption: number; micro: number;
};
