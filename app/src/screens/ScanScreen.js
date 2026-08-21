// Tab 1: Scan Paket — paket baru datang dari kurir
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Pressable } from 'react-native';
import { api } from '../api';
import { notice, colors, radius, shadow } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import ScannerModal from '../ScannerModal';
import PackageModal from '../PackageModal';
import ManualInputModal from './ManualInputModal';
import Icon from '../Icon';

// Scan kontinu untuk scanner hardware (web/PC): scanner bertingkah seperti
// keyboard (ketik barcode + Enter). Input selalu terfokus, auto-commit saat
// Enter, auto-clear + refocus sesudahnya sehingga bisa scan berturut-turut
// tanpa sentuh apa pun. Feedback cukup pill visual yang tidak menutup layar.
export default function ScanScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('scan', q, colFilters);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInvoice, setManualInvoice] = useState('');
  const [openId, setOpenId] = useState(null);
  const canScan = user.role === 'admin' || user.role === 'superadmin';

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const toggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const selectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === items.length && items.length > 0) return new Set();
      return new Set(items.map((p) => p.id));
    });
  }, [items]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkArrive = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      const res = await api.bulkArrive(ids);
      notice(`${res.updated} paket diubah ke Ambil Customer`);
      clearSelection();
      refetch();
    } catch (e) {
      notice(e.message);
    }
  }, [selectedIds, clearSelection, refetch]);

  const handleBulkDelete = useCallback(() => {
    if (!selectedIds.size) return;
    setConfirmDeleteOpen(true);
  }, [selectedIds]);

  const confirmDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    setBusyDelete(true);
    try {
      const res = await api.bulkDelete(ids);
      notice(`${res.deleted} paket anteran dihapus`);
      clearSelection();
      refetch();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusyDelete(false);
      setConfirmDeleteOpen(false);
    }
  }, [selectedIds, clearSelection, refetch]);

  // Hanya anteran yang bisa dihapus
  const anteranIds = items.filter((p) => p.pickup_type === 'anteran').map((p) => p.id);
  const hasAnteranSelected = Array.from(selectedIds).some((id) => anteranIds.includes(id));

  const scanInputRef = useRef(null);
  const scanLockRef = useRef(false);
  const resultTimer = useRef(null);
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null); // { ok, text }

  // Fokus otomatis ke kolom scan saat layar terbuka (untuk scanner hardware).
  useEffect(() => {
    const t = setTimeout(() => scanInputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  // Hilangkan feedback visual setelah ~2.5s agar tidak mengganggu scan berikut.
  useEffect(() => {
    if (!scanResult) return;
    resultTimer.current = setTimeout(() => setScanResult(null), 2500);
    return () => clearTimeout(resultTimer.current);
  }, [scanResult]);

  const processScan = useCallback(async (code) => {
    try {
      const p = await api.arrive(code);
      setScanResult({
        ok: true,
        text: `${p.invoice_no} → ${p.pickup_type === 'gojek' ? 'Absen Gojek' : 'Ambil Customer'}`,
      });
    } catch (e) {
      if (e.status === 404) {
        setScanResult({ ok: false, text: `${code} tidak ditemukan` });
        setManualInvoice(code);
        setManualOpen(true);
      } else {
        setScanResult({ ok: false, text: e.message });
      }
    }
  }, []);

  const submitScan = async () => {
    const code = scanInput.trim();
    if (!code || scanLockRef.current) return;
    scanLockRef.current = true; // cegah double-enter dari scanner
    try {
      await processScan(code);
    } finally {
      setScanInput('');
      // clear + refocus agar bisa lanjut scan berikutnya tanpa klik.
      setTimeout(() => {
        scanLockRef.current = false;
        scanInputRef.current?.focus();
      }, 0);
    }
  };

  const onScanned = async (code) => {
    try {
      const p = await api.arrive(code);
      notice(`${p.invoice_no} sampai kios → ${p.pickup_type === 'gojek' ? 'Absen Gojek' : 'Absen Ambil Customer'}`);
    } catch (e) {
      if (e.status === 404) {
        setManualInvoice(code);
        setManualOpen(true);
        notice('Data paket tidak ditemukan — tanya Sales, lalu isi manual.');
      } else {
        notice(e.message);
      }
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Cari invoice / nama / kode..."
          placeholderTextColor={colors.faint}
          value={q}
          onChangeText={setQ}
        />
        {canScan && (
          <>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.primary }]}
              onPress={() => setScanOpen(true)}
            >
              <Text style={s.btnText}>Scan Paket Sampai</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.sub }]}
              onPress={() => { setManualInvoice(''); setManualOpen(true); }}
            >
              <Text style={s.btnText}>Manual</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Kolom scan permanen untuk scanner hardware (web/PC) — loop kontinu */}
      {canScan && (
        <View style={scanBarStyle.wrap}>
          <View style={scanBarStyle.row}>
            <TextInput
              ref={scanInputRef}
              style={[s.input, scanBarStyle.input]}
              placeholder="Scan barcode / AWB paket sampai lalu Enter..."
              placeholderTextColor={colors.faint}
              value={scanInput}
              onChangeText={setScanInput}
              onSubmitEditing={submitScan}
              enterKeyHint="enter"
            />
            {scanResult && (
              <View style={[scanBarStyle.pill, {
                backgroundColor: scanResult.ok ? '#DCFCE7' : '#FEE2E2',
                borderColor: scanResult.ok ? '#86EFAC' : '#FCA5A5',
              }]}>
                <Text style={[scanBarStyle.pillText, { color: scanResult.ok ? '#15803D' : '#B91C1C' }]} numberOfLines={1}>
                  {scanResult.text}
                </Text>
              </View>
            )}
          </View>
          <Text style={scanBarStyle.hint}>
            Scanner hardware: cukup arahkan & tekan trigger berulang — kode otomatis diproses. Tidak ditemukan → form manual terbuka.
          </Text>
        </View>
      )}

      <Text style={s.sectionTitle}>
        {searching
          ? `Hasil pencarian "${q.trim()}" (${total})`
          : `Data pickup dari VEF — belum sampai kios (${total})`}
      </Text>
      {selectedIds.size > 0 && (
        <View style={bulkBar.wrap}>
          <View style={bulkBar.badge}>
            <Text style={bulkBar.badgeText}>{selectedIds.size}</Text>
          </View>
          <Text style={bulkBar.text}>paket dipilih</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity style={bulkBar.btn} onPress={handleBulkArrive}>
            <Icon name="check" size={14} color="#fff" strokeWidth={2.5} />
            <Text style={bulkBar.btnText}>Ubah ke Ambilan</Text>
          </TouchableOpacity>
          {hasAnteranSelected && (
            <TouchableOpacity style={[bulkBar.btn, { backgroundColor: colors.danger }]} onPress={handleBulkDelete}>
              <Icon name="trash" size={14} color="#fff" strokeWidth={2.5} />
              <Text style={bulkBar.btnText}>Hapus</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={bulkBar.cancelBtn} onPress={clearSelection}>
            <Text style={bulkBar.cancelText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="scan"
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        onSelectAll={selectAll}
      />
      <ScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />
      <ManualInputModal
        visible={manualOpen}
        initialInvoice={manualInvoice}
        onClose={() => setManualOpen(false)}
        onSaved={refetch}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />

      {/* Modal Konfirmasi Hapus */}
      <Modal visible={confirmDeleteOpen} transparent animationType="fade" onRequestClose={() => setConfirmDeleteOpen(false)}>
        <Pressable style={delModal.backdrop} onPress={() => setConfirmDeleteOpen(false)}>
          <Pressable style={delModal.card} onPress={(e) => e?.stopPropagation?.()}>
            <View style={delModal.head}>
              <View style={delModal.badgeIcon}>
                <Icon name="trash" size={24} color={colors.danger} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={delModal.title}>Hapus Paket Anteran</Text>
                <Text style={delModal.subTitle}>Tindakan ini tidak dapat dibatalkan</Text>
              </View>
            </View>
            <Text style={delModal.desc}>
              Apakah Anda yakin ingin menghapus {selectedIds.size} paket anteran yang dipilih? Data yang sudah dihapus tidak dapat dikembalikan.
            </Text>
            <View style={delModal.actionRow}>
              <TouchableOpacity
                style={[delModal.btn, delModal.btnCancel]}
                onPress={() => setConfirmDeleteOpen(false)}
                disabled={busyDelete}
              >
                <Text style={delModal.btnCancelText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[delModal.btn, { backgroundColor: colors.danger }]}
                onPress={confirmDelete}
                disabled={busyDelete}
              >
                {busyDelete ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={delModal.btnConfirmText}>Ya, Hapus</Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const scanBarStyle = {
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    marginBottom: 0,
    fontSize: 15,
  },
  pill: {
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: '55%',
  },
  pillText: {
    fontWeight: '700',
    fontSize: 12.5,
  },
  hint: {
    fontSize: 11,
    color: colors.faint,
    marginTop: 4,
  },
};

const bulkBar = {
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: radius.card,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 6,
    padding: 10,
    gap: 8,
  },
  badge: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  text: { fontSize: 13, fontWeight: '700', color: '#065F46' },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  cancelBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { color: colors.danger, fontSize: 14, fontWeight: '800' },
};

const delModal = {
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: colors.surface,
    borderRadius: radius.sheet, padding: 20, ...shadow.float,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  badgeIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.ink },
  subTitle: { fontSize: 12, color: colors.sub, fontWeight: '600', marginTop: 2 },
  desc: { fontSize: 13.5, color: colors.sub, lineHeight: 20, marginBottom: 20 },
  actionRow: { flexDirection: 'row', gap: 10 },
  btn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.pill,
    alignItems: 'center', justifyContent: 'center',
  },
  btnCancel: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  btnConfirmText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
};
