// hooks/usePackages.js
import { useCallback, useEffect, useState } from 'react';
import { api, getSocket } from '../api';
import { notice } from '../theme';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

// Menunda nilai sampai user berhenti mengetik, agar tidak request server per
// ketukan. Khusus untuk pencarian atas (`q`); filter kolom sudah di-debounce
// di PackageTable (500ms).
function useDebouncedValue(value, delay) {
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

  // reset page saat pindah tab / ganti pencarian / ganti filter kolom
  useEffect(() => {
    setPage(1);
  }, [tab, debouncedQ, filterString]);

  useEffect(() => {
    refetch();
    const socket = getSocket();
    socket.on('packages:changed', refetch);
    return () => socket.off('packages:changed', refetch);
  }, [refetch]);

  return { items, total, page, setPage, loading, refetch, searching };
}