import { Alert, Platform } from 'react-native';
import Toast from 'react-native-toast-message';

// Design tokens — gaya WMS: netral, data-dense, satu aksen fungsional.
export const colors = {
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
};

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
  absen_ambil_customer: [{ to: 'selesai', label: 'Konfirmasi Pengambilan' }],
  absen_gojek: [{ to: 'mencari_driver', label: 'Cari Driver' }],
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
  absen_ambil_customer: { selesai: 'check' },
  absen_gojek: { mencari_driver: 'search' },
  mencari_driver: { driver_sampai_kios: 'scooter' },
  driver_sampai_kios: { selesai: 'check' },
  selesai: { retur: 'rotate' },
  retur: { mencari_driver: 'search', cancel: 'x_circle' },
  cancel: { dikirim_ke_gudang: 'truck' },
  dikirim_ke_gudang: { diterima_gudang: 'arrow_down' },
};

export const chartPalette = Object.values(STATUS_META).map((m) => m.color);

export const statusLabel = (s) => STATUS_META[s]?.label || s;
export const statusColor = (s) => STATUS_META[s]?.color || colors.sub;
export const statusTint = (s) => STATUS_META[s]?.tint || colors.border;

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
  Toast.show({
    type,
    text1: message,
    visibilityTime: 3500,
    position: 'top',
  });
}
