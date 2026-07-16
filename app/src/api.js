import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { io } from 'socket.io-client';

// Menentukan alamat API otomatis:
// - Web dev (expo :8081)  -> http://<host>:4000
// - Web production        -> origin yang sama (nginx mem-proxy /api & /uploads)
// - Android dev (Expo Go) -> IP laptop diambil dari hostUri Metro
// - APK production        -> isi PROD_API di bawah saat deploy
const PROD_API = 'https://GANTI-DENGAN-DOMAIN-VPS-ANDA';

export function apiBase() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const { protocol, hostname, port, host } = window.location;
    if (port === '8081' || port === '19006') return `http://${hostname}:4000`;
    return `${protocol}//${host}`;
  }
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) return `http://${hostUri.split(':')[0]}:4000`;
  return PROD_API;
}

async function req(method, path, body) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  getBoard: (id) => req('GET', `/api/boards/${id}`),
  createList: (data) => req('POST', '/api/lists', data),
  updateList: (id, data) => req('PATCH', `/api/lists/${id}`, data),
  deleteList: (id) => req('DELETE', `/api/lists/${id}`),
  createCard: (data) => req('POST', '/api/cards', data),
  updateCard: (id, data) => req('PATCH', `/api/cards/${id}`, data),
  deleteCard: (id) => req('DELETE', `/api/cards/${id}`),
  deletePhoto: (id) => req('DELETE', `/api/photos/${id}`),
};

export async function uploadPhoto(cardId, asset) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    form.append('photo', blob, asset.fileName || 'foto.jpg');
  } else {
    form.append('photo', {
      uri: asset.uri,
      name: asset.fileName || 'foto.jpg',
      type: asset.mimeType || 'image/jpeg',
    });
  }
  const res = await fetch(`${apiBase()}/api/cards/${cardId}/photos`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error('Upload foto gagal');
  return res.json();
}

export function photoUrl(photo) {
  return `${apiBase()}/uploads/${photo.filename}`;
}

let socket;
export function getSocket() {
  if (!socket) socket = io(apiBase(), { transports: ['websocket', 'polling'] });
  return socket;
}
