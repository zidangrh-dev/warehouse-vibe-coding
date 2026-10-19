// hooks/usePackages.js
import { useCallback, useEffect, useState } from 'react';
import { api, getSocket } from '../api';
import { notice } from '../theme';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

// Menunda nilai sampai user berhenti mengetik, agar tidak request server per
// ketukan. Khusus untuk pencarian atas (`q`); filter kolom already di-debounce
// di PackageTable (500ms).
export function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function usePackages(tab, q, colFilters) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const debouncedQ = useDebouncedValue(q || '', SEARCH_DEBOUNCE_MS);
  const filterString = JSON.stringify(colFilters || {});

  // Penanda pencarian (label UI) — dari nilai mentah supaya label responsif saat mengetik.
  const searching = !!(
    (q && q.trim()) ||
    (colFilters && Object.values(colFilters).some((v) => v && String(v).trim()))
  );

  const refetch = useCallback(async () => {
    try {
      const res = await api.listPackages(tab, debouncedQ, colFilters, page, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      notice(`Gagal memuat: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQ, filterString, page]);

  // Optimistis: ganti/update satu paket di list lokal tanpa menunggu refetch.
  // Dipakai setelah aksi (mis. generate pickup code) supaya UI langsung
  // mencerminkan data terbaru & mencegah klik berulang yang mengubah kode.
  const updateItem = useCallback((updated) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? { ...it, ...updated } : it)));
  }, []);

  // reset page saat pindah tab / ganti pencarian / ganti filter kolom
  useEffect(() => {
    setPage(1);
  }, [tab, debouncedQ, filterString]);

  // Penentu userId sekaligus saat ini (sync, bukan async) — supaya
  // `me !== Promise` dan bisa dibandingkan langsung. Membaca AsyncStorage
  // sekali per render; cache lokal agar trimannya tidak dipunchi terus.
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    (async () => {
      const id = await getUserId();
      setUserId(id ?? null);
    })();
  }, []);

  // Socket listener: terima peristiwa cache dari device lain (HP/Laptop), refresh.
  // Pengecekan `changedBy` BANYAK sekali: masing-masing listener memanggil
  // getUserId() lagi (bisa Promise / dua kali), sehingga filter auto-skip
  // lama selalu gagal → semua device refresh manual.
  // Perbaikan: `userId` (synchronous, angka) dibandingkan langsung dengan
  // `payload.changedBy`. Kalau perubahan yang terjadi itu usang sendiri,
  // SKIP refetch (biar tidak flicker / spin). Kalau beda, refetch full.
  useEffect(() => {
    const socket = getSocket();
    const onPackagesChanged = async (payload) => {
      const { changedBy, pkg } = payload ?? {};
      const me = userId; // userId: angka atau null, bukan Promise
      if (!pkg?.id) {
        // Event tanpa paket (mis. packages:changed tanpa pkg) → semuanya refresh.
        return refetch();
      }
      // Kalau perubahan itu sendiri dari SAYA, SKIP refetch untuk mengubah:
      // biar tidak flickering/spinning di device pemicu.
      if (me !== null && Number(changedBy) === Number(me)) return;
      // Bedakan user lain: paket yang bersangkutan refresh saja (1 request),
      // sisanya refresh list penuh.
      if (me !== null && Number(pkg.id) === Number(me)) {
        try {
          const p = await fetch(`/api/packages/${pkg.id}`).then((r) => r.json());
          setItems((prev) => prev.map((x) => (x.id === p.id ? p : x)));
          setTotal((prev) => prev);
        } catch {
          /* cache saja */
        }
        return;
      }
      refetch();
    };
    socket.on('packages:changed', onPackagesChanged);
    return () => socket.off('packages:changed', onPackagesChanged);
  }, [refetch, userId]);

  return { items, total, page, setPage, loading, refetch, searching, updateItem };
}
