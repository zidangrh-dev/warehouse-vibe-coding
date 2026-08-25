import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

// Menentukan alamat API otomatis:
// - Web dev (expo :8081)  -> http://<host>:4000
// - Web production        -> origin yang sama (nginx mem-proxy /api)
// - Android dev (Expo Go) -> IP laptop diambil dari hostUri Metro
// - APK production        -> isi PROD_API di bawah saat deploy
const PROD_API = 'https://apps-pickhub.cloud';

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
  try {
    token = await AsyncStorage.getItem('gudang_token');
    const rawUser = await AsyncStorage.getItem('gudang_user');
    if (!token || !rawUser || rawUser === 'undefined') return null;
    return JSON.parse(rawUser);
  } catch (e) {
    token = null;
    await AsyncStorage.multiRemove(['gudang_token', 'gudang_user']).catch(() => {});
    return null;
  }
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
  // Daftar & pencarian sama-sama dipaginasi (server selalu kasih halaman kecil),
  // sehingga data tetap ringan walau pencarian menjangkau seluruh data.
  listPackages: (tab, q, extraFilters, page, pageSize = 50) => {
    const p = new URLSearchParams();
    if (tab) p.set('tab', tab);
    if (q) p.set('q', q);
    if (extraFilters && typeof extraFilters === 'object') {
      for (const [k, v] of Object.entries(extraFilters)) {
        if (v && String(v).trim()) p.set(k, String(v).trim());
      }
    }
    if (page) p.set('page', String(page));
    p.set('pageSize', String(pageSize));
    return req('GET', `/api/packages?${p.toString()}`);
  },
  getPackage: (id) => req('GET', `/api/packages/${id}`),
  createPackage: (data) => req('POST', '/api/packages', data),
  updatePackage: (id, data) => req('PATCH', `/api/packages/${id}`, data),
  kanbanBoard: (q, filters) => api.listPackages('semua', q, { ...(filters || {}), kanban: '1' }),
  arrive: (invoice_no) => req('POST', '/api/packages/arrive', { invoice_no }),
  bulkArrive: (ids) => req('POST', '/api/packages/bulk-arrive', { ids }),
  buybackArrive: (text) => req('POST', '/api/packages/buyback-arrive', { text }),
  bulkDelete: (ids) => req('DELETE', '/api/packages/bulk', { ids }),
  shipToWarehouse: (code) => req('POST', '/api/packages/ship-to-warehouse', { code }),
  receiveAtWarehouse: (code) => req('POST', '/api/packages/receive-at-warehouse', { code }),
  generateCode: (id) => req('POST', `/api/packages/${id}/pickup-code`),
  findByCode: (code) => req('POST', '/api/packages/find-by-code', { code }),
  deletePhoto: (id) => req('DELETE', `/api/photos/${id}`),
  dashboardSummary: (params) => {
    if (params && typeof params === 'object') {
      const p = new URLSearchParams(params);
      return req('GET', `/api/dashboard/summary?${p.toString()}`);
    }
    return req('GET', '/api/dashboard/summary');
  },
  dashboardThroughput: (params) => {
    if (params && typeof params === 'object') {
      const p = new URLSearchParams(params);
      return req('GET', `/api/dashboard/throughput?${p.toString()}`);
    }
    return req('GET', `/api/dashboard/throughput?days=${params || 14}`);
  },
  dashboardActivity: (params) => {
    if (params && typeof params === 'object') {
      const p = new URLSearchParams(params);
      return req('GET', `/api/dashboard/activity?${p.toString()}`);
    }
    return req('GET', `/api/dashboard/activity?days=${params || 30}`);
  },
  archivePackages: (beforeDate, mode = 'before', onlyCompleted = true) =>
    req('POST', '/api/packages/archive', { beforeDate, mode, onlyCompleted }),
  unarchivePackage: (id) => req('POST', `/api/packages/${id}/unarchive`),
  archiveSummary: (limit) => req('GET', `/api/archives/summary${limit ? `?limit=${limit}` : ''}`),
  restoreArchiveByDate: (date) => req('POST', '/api/archives/restore-by-date', { date }),
  listUsers: () => req('GET', '/api/users'),
  createUser: (data) => req('POST', '/api/users', data),
  updateUser: (id, data) => req('PATCH', `/api/users/${id}`, data),
  deleteUser: (id) => req('DELETE', `/api/users/${id}`),
  changePassword: (currentPassword, newPassword) => req('POST', '/api/change-password', { currentPassword, newPassword }),
  staffNames: () => req('GET', '/api/staff-names'),
  createStaffName: (name) => req('POST', '/api/staff-names', { name }),
  updateStaffName: (id, name) => req('PATCH', `/api/staff-names/${id}`, { name }),
  deleteStaffName: (id) => req('DELETE', `/api/staff-names/${id}`),
};

// Upload bukti foto (kind: 'wajah' | 'ktp' | 'barang').
// Web: FormData + fetch browser. Native: FileSystem.uploadAsync dari expo-file-system/legacy.
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

  // Native (Android/iOS) — gunakan FileSystem.uploadAsync (OKHttp Native, bebas dari bug FormData JS)
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
  const base = `${apiBase()}/uploads/${photo.filename}`;
  // Server mewajibkan autentikasi untuk foto (<Image>/<img> tidak bisa kirim
  // header Authorization → token dilewatkan via query). Token aman di memory.
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}

export async function importCsv(fileAsset) {
  const url = `${apiBase()}/api/packages/import`;
  if (Platform.OS === 'web') {
    const form = new FormData();
    const blob = fileAsset.file || (await (await fetch(fileAsset.uri)).blob());
    form.append('file', blob, fileAsset.name || 'import.csv');
    const res = await fetch(url, {
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

  // Native (Android/iOS) — gunakan FileSystem.uploadAsync
  const FileSystem = await import('expo-file-system/legacy');
  const res = await FileSystem.uploadAsync(url, fileAsset.uri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName: 'file',
    mimeType: 'text/csv',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (res.status < 200 || res.status >= 300) {
    let err = {};
    try { err = JSON.parse(res.body); } catch {}
    throw new Error(err.error || `Import gagal (${res.status})`);
  }
  return JSON.parse(res.body);
}

export function parseCsvRows(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const delimiter = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';

  const parseLine = (line) => {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
      } else if (c === delimiter && !inQ) {
        res.push(cur.trim().replace(/^"|"$/g, ''));
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim().replace(/^"|"$/g, ''));
    return res;
  };

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseLine(lines[i]);
    if (vals.length === 0 || (vals.length === 1 && !vals[0])) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = vals[j] || '';
    }
    rows.push(row);
  }
  return rows;
}

export async function importCsvProgress(fileAsset, onProgress) {
  let text = '';
  try {
    if (Platform.OS === 'web') {
      const blob = fileAsset.file || (await (await fetch(fileAsset.uri)).blob());
      text = await blob.text();
    } else {
      const FileSystem = await import('expo-file-system/legacy');
      text = await FileSystem.readAsStringAsync(fileAsset.uri, { encoding: 'utf8' });
    }
  } catch (e) {
    const res = await importCsv(fileAsset);
    const finalRes = { ...res, done: true, processed: res.total || 0, percent: 100 };
    onProgress?.(finalRes);
    return finalRes;
  }

  // Kirim langsung teks CSV mentah ke server (server memparse dengan csv-parse resmi yang mendukung multiline & quote)
  onProgress?.({ processed: 0, total: 100, percent: 50, inserted: 0, updated: 0, skipped: 0, done: false });
  const res = await req('POST', '/api/packages/import', { csvText: text });
  const finalResult = {
    inserted: res.inserted || 0,
    updated: res.updated || 0,
    skipped: res.skipped || 0,
    skippedCourier: res.skippedCourier || 0,
    total: res.total || 0,
    percent: 100,
    processed: res.total || 0,
    done: true,
  };
  onProgress?.(finalResult);
  return finalResult;
}

let socket;
export function getSocket() {
  if (!socket) socket = io(apiBase(), { transports: ['websocket', 'polling'] });
  return socket;
}
