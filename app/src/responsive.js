import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = { md: 720, lg: 1024, xl: 1280 };

// Breakpoints WMS: mobile/app selalu 1 kolom + tab bar bawah; web lebar
// dapat sidebar + tabel padat.
export function useBreakpoint() {
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const isDesktop = isWeb && width >= BREAKPOINTS.lg;
  return {
    width,
    isWeb,
    isWide: width >= BREAKPOINTS.md,
    isDesktop,
    columns: width >= BREAKPOINTS.xl ? 3 : width >= BREAKPOINTS.lg ? 2 : 1,
  };
}
