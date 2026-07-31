import { Alert, Platform } from 'react-native';

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
  header: '#FFFFFF', // dipakai SafeArea/StatusBar (flat, bukan gradien)
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

// Warna solid untuk aksen + tint 12% untuk latar pill.
export const STATUS_META = {
  data_masuk: { label: 'Data Masuk', color: '#64748B', tint: '#64748B1F' },
  absen_ambil_customer: { label: 'Absen Ambil Customer', color: '#4F46E5', tint: '#4F46E51A' },
  absen_gojek: { label: 'Absen Gojek', color: '#059669', tint: '#0596691A' },
  mencari_driver: { label: 'Mencari Driver', color: '#D97706', tint: '#D977061F' },
  driver_sampai_kios: { label: 'Driver Sampai Kios', color: '#7C3AED', tint: '#7C3AED1A' },
  done_pickup: { label: 'Done Pickup', color: '#0891B2', tint: '#0891B21A' },
  retur: { label: 'Retur', color: '#E5484D', tint: '#E5484D1A' },
  selesai: { label: 'Selesai', color: '#16A34A', tint: '#16A34A1A' },
  cancel: { label: 'Cancel', color: '#475569', tint: '#4755691F' },
};

export const NEXT_ACTIONS = {
  absen_gojek: [{ to: 'mencari_driver', label: '🔍 Cari Driver' }],
  mencari_driver: [{ to: 'driver_sampai_kios', label: '🛵 Driver Sampai Kios' }],
  driver_sampai_kios: [{ to: 'done_pickup', label: '✅ Done Pickup' }],
  done_pickup: [
    { to: 'selesai', label: '🏁 Selesai' },
    { to: 'retur', label: '↩️ Retur' },
  ],
  retur: [
    { to: 'mencari_driver', label: '🔍 Cari Driver Lagi' },
    { to: 'cancel', label: '✖️ Cancel' },
  ],
};

// Palet chart dashboard — reuse warna status supaya legend konsisten se-app.
export const chartPalette = Object.values(STATUS_META).map((m) => m.color);

export const statusLabel = (s) => STATUS_META[s]?.label || s;
export const statusColor = (s) => STATUS_META[s]?.color || colors.sub;
export const statusTint = (s) => STATUS_META[s]?.tint || colors.border;

// Konfirmasi yang bekerja di web (window.confirm) dan native (Alert).
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

export function notice(message) {
  if (Platform.OS === 'web') {
    // Toast non-blocking (window.alert memblokir seluruh halaman).
    const el = document.createElement('div');
    el.textContent = message;
    Object.assign(el.style, {
      position: 'fixed', bottom: '96px', left: '50%', transform: 'translateX(-50%)',
      background: '#101828', color: '#fff', padding: '12px 18px', borderRadius: '14px',
      zIndex: 99999, maxWidth: '90%', fontFamily: 'sans-serif', fontSize: '14px',
      boxShadow: '0 8px 24px rgba(16,24,40,0.25)',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  } else {
    Alert.alert('', message);
  }
}
