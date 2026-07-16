import { Alert, Platform } from 'react-native';

export const colors = {
  boardBg: '#0b5394',
  header: '#083b6f',
  column: '#f1f2f4',
  card: '#ffffff',
  text: '#172b4d',
  subtle: '#5e6c84',
  accent: '#0079bf',
  danger: '#eb5a46',
  ok: '#61bd4f',
};

export const PRIORITIES = [
  { key: 'rendah', label: 'Rendah', color: '#61bd4f' },
  { key: 'normal', label: 'Normal', color: '#0079bf' },
  { key: 'tinggi', label: 'Tinggi', color: '#eb5a46' },
];

export function priorityColor(key) {
  return PRIORITIES.find((p) => p.key === key)?.color || colors.accent;
}

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
