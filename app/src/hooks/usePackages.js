// hooks/usePackages.js
import { useCallback, useEffect, useState } from 'react';
import { api, getSocket } from '../api';
import { notice } from '../theme';

const PAGE_SIZE = 50;

export function usePackages(tab, q) {
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const searching = !!(q && q.trim());

  const refetch = useCallback(async () => {
    try {
      const res = await api.listPackages(tab, q, searching ? null : page, PAGE_SIZE);
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      notice(`Gagal memuat: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, q, page, searching]);

  // reset page on tab or query change
  useEffect(() => {
    setPage(1);
  }, [tab, q]);

  useEffect(() => {
    refetch();
    const socket = getSocket();
    socket.on('packages:changed', refetch);
    return () => socket.off('packages:changed', refetch);
  }, [refetch]);

  return { items, total, page, setPage, loading, refetch, searching };
}
