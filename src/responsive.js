import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { md: 720, lg: 1024, xl: 1280, xxl: 1920 };

// Breakpoints WMS: mobile/app selalu 1 kolom + tab bar bawah; web lebar
// dapat sidebar + tabel padat.
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= BREAKPOINTS.lg;
  const isUltraWide = isWeb && width >= BREAKPOINTS.xxl;
  return {
    width,
    isWeb,
    isWide: width >= BREAKPOINTS.md,
    isDesktop,
    isUltraWide,
    columns: width >= BREAKPOINTS.xxl ? 4 : width >= BREAKPOINTS.xl ? 3 : width >= BREAKPOINTS.lg ? 2 : 1,
  };
}
