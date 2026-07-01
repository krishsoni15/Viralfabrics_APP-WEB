/**
 * Viral Fabrics — Color Design Tokens
 * Matches the Next.js web design system
 */

export const Colors = {
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  info: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
  },
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

export interface ThemeColors {
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  icon: string;
  iconActive: string;
  tabBar: string;
  tabBarBorder: string;
  tabBarActive: string;
  tabBarInactive: string;
  statusBar: 'dark' | 'light';
  shadow: string;
  overlay: string;
  skeleton: string;
  skeletonHighlight: string;
  input: string;
  inputBorder: string;
  inputPlaceholder: string;
  headerBg: string;
  headerText: string;
}

export const LightTheme: ThemeColors = {
  background: Colors.white,
  surface: Colors.neutral[50],
  card: Colors.white,
  text: Colors.neutral[900],
  textSecondary: Colors.neutral[500],
  textTertiary: Colors.neutral[400],
  border: Colors.neutral[200],
  borderLight: Colors.neutral[100],
  icon: Colors.neutral[500],
  iconActive: Colors.primary[600],
  tabBar: Colors.white,
  tabBarBorder: Colors.neutral[200],
  tabBarActive: Colors.primary[600],
  tabBarInactive: Colors.neutral[400],
  statusBar: 'dark',
  shadow: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  skeleton: Colors.neutral[200],
  skeletonHighlight: Colors.neutral[100],
  input: Colors.white,
  inputBorder: Colors.neutral[300],
  inputPlaceholder: Colors.neutral[400],
  headerBg: Colors.white,
  headerText: Colors.neutral[900],
};

export const DarkTheme: ThemeColors = {
  background: Colors.neutral[900],
  surface: Colors.neutral[800],
  card: Colors.neutral[800],
  text: Colors.neutral[50],
  textSecondary: Colors.neutral[400],
  textTertiary: Colors.neutral[500],
  border: Colors.neutral[700],
  borderLight: Colors.neutral[800],
  icon: Colors.neutral[400],
  iconActive: Colors.primary[400],
  tabBar: Colors.neutral[900],
  tabBarBorder: Colors.neutral[800],
  tabBarActive: Colors.primary[400],
  tabBarInactive: Colors.neutral[500],
  statusBar: 'light',
  shadow: 'rgba(0, 0, 0, 0.3)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  skeleton: Colors.neutral[700],
  skeletonHighlight: Colors.neutral[600],
  input: Colors.neutral[800],
  inputBorder: Colors.neutral[600],
  inputPlaceholder: Colors.neutral[500],
  headerBg: Colors.neutral[900],
  headerText: Colors.neutral[50],
};

// Status color mappings
export const StatusColors: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: '#fffbeb', text: '#b45309', border: '#fde68a' }, // Amber/Yellow
  in_progress: { bg: Colors.info[50], text: Colors.info[700], border: Colors.info[200] },
  completed: { bg: Colors.success[50], text: Colors.success[700], border: Colors.success[200] },
  delivered: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' }, // Emerald/Green
  cancelled: { bg: Colors.error[50], text: Colors.error[700], border: Colors.error[200] },
  'Not set': { bg: Colors.neutral[100], text: Colors.neutral[600], border: Colors.neutral[200] },
  default: { bg: Colors.neutral[100], text: Colors.neutral[600], border: Colors.neutral[200] },
};

export const StatusColorsDark: Record<string, { bg: string; text: string; border: string }> = {
  pending: { bg: '#422006', text: '#fbbf24', border: '#b45309' }, // Amber/Yellow
  in_progress: { bg: '#1e3a5f', text: Colors.info[300], border: Colors.info[700] },
  completed: { bg: '#14532d', text: Colors.success[300], border: Colors.success[700] },
  delivered: { bg: '#064e3b', text: '#34d399', border: '#065f46' }, // Emerald/Green
  cancelled: { bg: '#450a0a', text: Colors.error[300], border: Colors.error[700] },
  'Not set': { bg: Colors.neutral[800], text: Colors.neutral[400], border: Colors.neutral[700] },
  default: { bg: Colors.neutral[800], text: Colors.neutral[400], border: Colors.neutral[700] },
};

export const OrderTypeColors = {
  Dying: { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' }, // Orange
  Printing: { bg: '#eef2ff', text: '#4f46e5', border: '#c7d2fe' }, // Indigo
};

export const OrderTypeColorsDark = {
  Dying: { bg: '#431407', text: '#fb923c', border: '#9a3412' }, // Orange
  Printing: { bg: '#1e1b4b', text: '#818cf8', border: '#3730a3' }, // Indigo
};
