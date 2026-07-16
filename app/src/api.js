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
  listPackages: (tab, q) =>
    req('GET', `/api/packages?${tab ? `tab=${tab}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`),
  getPackage: (id) => req('GET', `/api/packages/${id}`),
  createPackage: (data) => req('POST', '/api/packages', data),
  updatePackage: (id, data) => req('PATCH', `/api/packages/${id}`, data),
  arrive: (invoice_no) => req('POST', '/api/packages/arrive', { invoice_no }),
  generateCode: (id) => req('POST', `/api/packages/${id}/pickup-code`),
  redeem: (code, picker_name) => req('POST', '/api/packages/redeem', { code, picker_name }),
};

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
