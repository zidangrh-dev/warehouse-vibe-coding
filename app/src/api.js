import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

// Menentukan alamat API otomatis:
// - Web dev (expo :8081)  -> http://<host>:4000
// - Web production        -> origin yang sama (nginx mem-proxy /api)
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

let token = null;
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export async function loadSession() {
  token = await AsyncStorage.getItem('gudang_token');
  const user = await AsyncStorage.getItem('gudang_user');
  return token && user ? JSON.parse(user) : null;
}

export async function login(username, password) {
  const data = await req('POST', '/api/login', { username, password }, true);
  token = data.token;
  await AsyncStorage.setItem('gudang_token', data.token);
  await AsyncStorage.setItem('gudang_user', JSON.stringify(data.user));
  return data.user;
}

export async function logout() {
  token = null;
  await AsyncStorage.multiRemove(['gudang_token', 'gudang_user']);
}

async function req(method, path, body, skipAuth = false) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(!skipAuth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !skipAuth) onUnauthorized();
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.error || `HTTP ${res.status}`);
    e.status = res.status;
    e.package = err.package;
    throw e;
  }
  return res.json();
}

export const api = {
  // Mengembalikan { items, total, page, pageSize, searching }.
  // page null → server memakai default; saat q diisi, server bypass paginasi.
  listPackages: (tab, q, page, pageSize = 50) => {
    const p = new URLSearchParams();
    if (tab) p.set('tab', tab);
    if (q) p.set('q', q);
    if (page) p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return req('GET', `/api/packages?${p.toString()}`);
  },
  getPackage: (id) => req('GET', `/api/packages/${id}`),
  createPackage: (data) => req('POST', '/api/packages', data),
  updatePackage: (id, data) => req('PATCH', `/api/packages/${id}`, data),
  arrive: (invoice_no) => req('POST', '/api/packages/arrive', { invoice_no }),
  generateCode: (id) => req('POST', `/api/packages/${id}/pickup-code`),
  findByCode: (code) => req('POST', '/api/packages/find-by-code', { code }),
  deletePhoto: (id) => req('DELETE', `/api/photos/${id}`),
  dashboardSummary: () => req('GET', '/api/dashboard/summary'),
  dashboardThroughput: (days = 14) => req('GET', `/api/dashboard/throughput?days=${days}`),
  dashboardActivity: (days = 30) => req('GET', `/api/dashboard/activity?days=${days}`),
};

// Upload bukti foto (kind: 'wajah' | 'ktp' | 'barang').
// Web: FormData + blob. Native: FileSystem.uploadAsync (fetch bawaan Expo SDK
// baru menolak objek file {uri,...} di FormData -> "unsupported ... datapart").
export async function uploadPhoto(packageId, kind, asset) {
  const url = `${apiBase()}/api/packages/${packageId}/photos`;
  if (Platform.OS === 'web') {
    const form = new FormData();
    form.append('kind', kind);
    const blob = asset.file || (await (await fetch(asset.uri)).blob());
    form.append('photo', blob, asset.fileName || 'foto.jpg');
    const res = await fetch(url, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload foto gagal');
    }
    return res.json();
  }
  // Native (Android/iOS)
  const FileSystem = await import('expo-file-system/legacy');
  const res = await FileSystem.uploadAsync(url, asset.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'photo',
    mimeType: asset.mimeType || 'image/jpeg',
    parameters: { kind },
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status < 200 || res.status >= 300) {
    let err = {};
    try { err = JSON.parse(res.body); } catch {}
    throw new Error(err.error || `Upload foto gagal (${res.status})`);
  }
  return JSON.parse(res.body);
}

export function photoUrl(photo) {
  return `${apiBase()}/uploads/${photo.filename}`;
}

export async function importCsv(fileAsset) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = fileAsset.file || (await (await fetch(fileAsset.uri)).blob());
    form.append('file', blob, fileAsset.name || 'import.csv');
  } else {
    form.append('file', {
      uri: fileAsset.uri,
      name: fileAsset.name || 'import.csv',
      type: 'text/csv',
    });
  }
  const res = await fetch(`${apiBase()}/api/packages/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Import gagal');
  }
  return res.json();
}

let socket;
export function getSocket() {
  if (!socket) socket = io(apiBase(), { transports: ['websocket', 'polling'] });
  return socket;
}
