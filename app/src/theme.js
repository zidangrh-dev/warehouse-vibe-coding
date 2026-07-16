import { Alert, Platform } from 'react-native';

export const colors = {
  bg: '#f4f5f7',
  header: '#083b6f',
  card: '#ffffff',
  text: '#172b4d',
  subtle: '#5e6c84',
  accent: '#0079bf',
  danger: '#eb5a46',
  ok: '#61bd4f',
  border: '#dfe1e6',
};

export const STATUS_META = {
  data_masuk: { label: 'Data Masuk', color: '#5e6c84' },
  absen_ambil_customer: { label: 'Absen Ambil Customer', color: '#0079bf' },
  absen_gojek: { label: 'Absen Gojek', color: '#00875a' },
  mencari_driver: { label: 'Mencari Driver', color: '#ff991f' },
  driver_sampai_kios: { label: 'Driver Sampai Kios', color: '#6554c0' },
  done_pickup: { label: 'Done Pickup', color: '#00b8d9' },
  retur: { label: 'Retur', color: '#eb5a46' },
  selesai: { label: 'Selesai', color: '#61bd4f' },
  cancel: { label: 'Cancel', color: '#42526e' },
};

// Aksi lanjutan per status (alur Gojek sesuai flowchart).
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
export const statusColor = (s) => STATUS_META[s]?.color || colors.subtle;

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
      position: 'fixed', bottom: '70px', left: '50%', transform: 'translateX(-50%)',
      background: '#172b4d', color: '#fff', padding: '12px 18px', borderRadius: '10px',
      zIndex: 99999, maxWidth: '90%', fontFamily: 'sans-serif', fontSize: '14px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
  } else {
    Alert.alert('', message);
  }
}
