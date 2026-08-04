// hooks/useBulkSelection.js
import { useState } from 'react';
import { notice } from '../theme';
import { api } from '../api';

export function useBulkSelection(items) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [busyBulk, setBusyBulk] = useState(false);

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length && items.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleUnarchiveSingle = async (pkg, refetch) => {
    setBusyId(pkg.id);
    try {
      await api.unarchivePackage(pkg.id);
      notice(`✅ Berhasil mengembalikan paket ${pkg.invoice_no} ke data aktif!`);
      setSelectedIds((prev) => prev.filter((i) => i !== pkg.id));
      refetch();
    } catch (e) {
      notice(`Gagal: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleUnarchiveBulk = async (refetch) => {
    if (selectedIds.length === 0) return;
    setBusyBulk(true);
    try {
      const res = await api.unarchiveBulkPackages(selectedIds);
      notice(`✅ Berhasil mengembalikan ${res.count} paket dari arsip ke data aktif!`);
      setSelectedIds([]);
      refetch();
    } catch (e) {
      notice(`Gagal: ${e.message}`);
    } finally {
      setBusyBulk(false);
    }
  };

  const isAllSelected = items.length > 0 && selectedIds.length === items.length;

  return {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    busyId,
    busyBulk,
    handleUnarchiveSingle,
    handleUnarchiveBulk,
  };
}
