import { Alert, Platform, useColorScheme } from 'react-native';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

// ---- Design tokens ----
// Dua palet: light (default, WMS netral) & dark. Komponen memakai palet aktif
// lewat hook useTheme(); jangan impor `colors` statis di komponen UI.

export const lightColors = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F3F6',
  ink: '#0F172A',
  sub: '#5A6472',
  faint: '#93A0AF',
  border: '#E2E6EB',
  primary: '#2E5AAC',
  primaryDark: '#1E3F80',
  primarySoft: '#E8EFFA',
  danger: '#E5484D',
  ok: '#16A34A',
  warn: '#F59E0B',
  header: '#FFFFFF',
  // Semantic tokens — menggantikan hex hardcoded di komponen.
  dangerBg: '#FEF2F2',
  dangerBorder: '#FCA5A5',
  dangerText: '#991B1B',
  okBg: '#F0FDF4',
  okBorder: '#BBF7D0',
  okText: '#15803D',
  okChip: '#DCFCE7',
  scanOkBg: '#ECFDF5',
  scanOkBorder: '#A7F3D0',
  scanOkText: '#065F46',
  okBright: '#10B981',
  warnBg: '#FFFBEB',
  warnBorder: '#FDE68A',
  warnText: '#B45309',
  amberBg: '#FEF3C7',
  amberBorder: '#FCD34D',
  amberText: '#92400E',
  blueBg: '#EFF6FF',
  blueBorder: '#93C5FD',
  blueText: '#1D4ED8',
  violetBg: '#EDE9FE',
  violetBorder: '#C4B5FD',
  violetText: '#6D28D9',
  skyBg: '#E0F2FE',
  skyText: '#0369A1',
  neutralBg: '#F8FAFC',
  neutralBorder: '#CBD5E1',
  chipBg: '#E2E8F0',
};

export const darkColors = {
  bg: '#0B1220',
  surface: '#151F31',
  surfaceAlt: '#1E2A3F',
  ink: '#E6EDF7',
  sub: '#9AA7BA',
  faint: '#64748B',
  border: '#2A3A55',
  primary: '#5B8DEF',
  primaryDark: '#3E6BC4',
  primarySoft: 'rgba(91,141,239,0.16)',
  danger: '#F87171',
  ok: '#34D399',
  warn: '#FBBF24',
  header: '#0B1220',
  dangerBg: '#3A1D24',
  dangerBorder: '#7F3740',
  dangerText: '#FDA4AF',
  okBg: '#16291D',
  okBorder: '#2E6B44',
  okText: '#86EFAC',
  okChip: '#1F4A30',
  scanOkBg: 'rgba(52,211,153,0.10)',
  scanOkBorder: '#2E8F6B',
  scanOkText: '#86EFAC',
  okBright: '#34D399',
  warnBg: '#33280F',
  warnBorder: '#8A6A24',
  warnText: '#FCD34D',
  amberBg: '#352A0F',
  amberBorder: '#92690F',
  amberText: '#FBBF24',
  blueBg: '#12203A',
  blueBorder: '#3B6EA5',
  blueText: '#93C5FD',
  violetBg: '#231A3D',
  violetBorder: '#6D4FA6',
  violetText: '#C4B5FD',
  skyBg: '#0C2A40',
  skyText: '#7DD3FC',
  neutralBg: '#1B2637',
  neutralBorder: '#3E4E6B',
  chipBg: '#2A3852',
};

// Legacy: kode lama (bukan komponen UI) yang masih mengimpor `colors` melihat palet light.
export const colors = lightColors;

export const radius = { card: 12, pill: 8, input: 8, sheet: 16 };

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const font = {
  mono: Platform.select({ web: 'ui-monospace, SFMono-Regular, Menlo, monospace', default: undefined }),
};

export const shadow = {
  card: {
    shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  float: {
    shadowColor: '#0F172A', shadowOpacity: 0.10, shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 }, elevation: 6,
  },
};

export const STATUS_META = {
  data_masuk: { label: 'Data Masuk', color: '#64748B', tint: '#64748B1F' },
  absen_ambil_customer: { label: 'Absen Ambil Customer', color: '#4F46E5', tint: '#4F46E51A' },
  absen_gojek: { label: 'Absen Gojek', color: '#059669', tint: '#0596691A' },
  absen_buyback: { label: 'Absen Buyback', color: '#6D28D9', tint: '#6D28D91F' },
  mencari_driver: { label: 'Mencari Driver', color: '#D97706', tint: '#D977061F' },
  driver_sampai_kios: { label: 'Driver Sampai Kios', color: '#7C3AED', tint: '#7C3AED1A' },
  retur: { label: 'Retur', color: '#E5484D', tint: '#E5484D1A' },
  selesai: { label: 'Selesai', color: '#16A34A', tint: '#16A34A1A' },
  cancel: { label: 'Cancel', color: '#475569', tint: '#4755691F' },
  dikirim_ke_gudang: { label: 'Dikirim ke Gudang', color: '#D97706', tint: '#D977061A' },
  diterima_gudang: { label: 'Diterima Gudang', color: '#059669', tint: '#0596691A' },
};

// NEXT_ACTIONS: label sekarang tanpa emoji prefix — icon ditampilkan
// terpisah lewat komponen Icon di UI.
export const NEXT_ACTIONS = {
  absen_ambil_customer: [
    { to: 'selesai', label: 'Konfirmasi Pengambilan' },
    { to: 'retur', label: 'Retur' },
  ],
  absen_gojek: [{ to: 'mencari_driver', label: 'Cari Driver' }],
  absen_buyback: [{ to: 'selesai', label: 'Selesai' }],
  mencari_driver: [{ to: 'driver_sampai_kios', label: 'Driver Sampai Kios' }],
  driver_sampai_kios: [{ to: 'selesai', label: 'Done Pickup' }],
  selesai: [{ to: 'retur', label: 'Retur' }],
  retur: [
    { to: 'mencari_driver', label: 'Cari Driver' },
    { to: 'cancel', label: 'Cancel' },
  ],
  cancel: [{ to: 'dikirim_ke_gudang', label: 'Dikirim ke Gudang' }],
  dikirim_ke_gudang: [{ to: 'diterima_gudang', label: 'Diterima Gudang' }],
};

// Icon names untuk NEXT_ACTIONS (parallel mapping).
export const NEXT_ACTION_ICONS = {
  absen_ambil_customer: { selesai: 'check', retur: 'rotate' },
  absen_gojek: { mencari_driver: 'search' },
  absen_buyback: { selesai: 'check' },
  mencari_driver: { driver_sampai_kios: 'scooter' },
  driver_sampai_kios: { selesai: 'check' },
  selesai: { retur: 'rotate' },
  retur: { mencari_driver: 'search', cancel: 'x_circle' },
  cancel: { dikirim_ke_gudang: 'truck' },
  dikirim_ke_gudang: { diterima_gudang: 'arrow_down' },
};

export const chartPalette = Object.values(STATUS_META).map((m) => m.color);

export const statusLabel = (s) => STATUS_META[s]?.label || s;
export const statusColor = (s) => STATUS_META[s]?.color || lightColors.sub;
export const statusTint = (s) => STATUS_META[s]?.tint || lightColors.border;

export function confirmAsync(title, message) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n${message || ''}`));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Batal', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Ya', style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

// Toast notification via react-native-toast-message.
// type: 'success' | 'error' | 'info' | 'warning'
export function notice(message, type = 'info') {
  const safeType = type === 'warning' ? 'info' : (['success', 'error', 'info'].includes(type) ? type : 'info');
  Toast.show({
    type: safeType,
    text1: message,
    visibilityTime: 3500,
    position: 'top',
  });
}

// ---- Dark mode (on/off, default ikut sistem) ----

const STORAGE_KEY = 'pickhub_theme_mode';

async function readPref() {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(STORAGE_KEY);
      return null;
    }
    return await AsyncStorage.getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
}

async function savePref(mode) {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(STORAGE_KEY, mode);
      return;
    }
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch (e) {
    // abaikan — tema tetap berlaku selama sesi
  }
}

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [pref, setPref] = useState(null); // null = ikut sistem, 'light'/'dark' = pilihan user

  useEffect(() => {
    let alive = true;
    readPref().then((saved) => { if (alive && (saved === 'light' || saved === 'dark')) setPref(saved); });
    return () => { alive = false; };
  }, []);

  const mode = pref || (system === 'dark' ? 'dark' : 'light');
  const colors = mode === 'dark' ? darkColors : lightColors;

  const toggle = useCallback(() => {
    setPref((p) => {
      const current = p || (system === 'dark' ? 'dark' : 'light');
      const next = current === 'dark' ? 'light' : 'dark';
      savePref(next);
      return next;
    });
  }, [system]);

  const setMode = useCallback((m) => {
    const next = m === 'dark' ? 'dark' : 'light';
    savePref(next);
    setPref(next);
  }, []);

  const value = useMemo(() => ({ mode, colors, isDark: mode === 'dark', toggle, setMode }), [mode, colors, toggle, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { mode: 'light', colors: lightColors, isDark: false, toggle: () => {}, setMode: () => {} };
  return ctx;
}