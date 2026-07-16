import { Alert, Platform } from 'react-native';

// Design tokens — gaya courier app modern: bersih, membulat, satu warna utama.
export const colors = {
  bg: '#F4F6FB',
  surface: '#FFFFFF',
  ink: '#101828',
  sub: '#667085',
  faint: '#98A2B3',
  border: '#EAECF0',
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF0FE',
  danger: '#E5484D',
  ok: '#16A34A',
  warn: '#F59E0B',
  header: '#3730A3', // dipakai SafeArea/StatusBar
};

export const radius = { card: 18, pill: 999, input: 12, sheet: 24 };

export const shadow = {
  card: {
    shadowColor: '#101828', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 3,
  },
  float: {
    shadowColor: '#101828', shadowOpacity: 0.14, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 10,
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
