import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ScrollView,
  Modal, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, importCsv, getSocket } from './api';
import { colors, radius, shadow, notice, statusColor, NEXT_ACTIONS } from './theme';
import { PackageRow, PackageTable, CodeModal } from './components';
import { useBreakpoint } from './responsive';
import ScannerModal from './ScannerModal';
import PackageModal from './PackageModal';

const PAGE_SIZE = 50;

// Ambil daftar paket untuk sebuah tab + auto-refresh saat ada perubahan (realtime).
// Paginasi aktif untuk mode daftar; saat `q` diisi, server bypass paginasi
// sehingga pencarian menjangkau seluruh data.
function usePackages(tab, q) {
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

  // Kembali ke halaman 1 setiap ganti tab atau kata kunci berubah.
  useEffect(() => { setPage(1); }, [tab, q]);

  useEffect(() => {
    refetch();
    const socket = getSocket();
    socket.on('packages:changed', refetch);
    return () => socket.off('packages:changed', refetch);
  }, [refetch]);

  return { items, total, page, setPage, loading, refetch, searching };
}

function PaginationBar({ page, total, pageSize, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <View style={s.pageBar}>
      <Text style={s.pageInfo}>{from}–{to} dari {total}</Text>
      <View style={s.pageCtrls}>
        <TouchableOpacity
          style={[s.pageBtn, page <= 1 && s.pageBtnDisabled]}
          disabled={page <= 1}
          onPress={() => onPage(page - 1)}
        >
          <Text style={[s.pageBtnText, page <= 1 && s.pageBtnTextDisabled]}>‹ Sebelumnya</Text>
        </TouchableOpacity>
        <Text style={s.pageNum}>Hal {page}/{pages}</Text>
        <TouchableOpacity
          style={[s.pageBtn, page >= pages && s.pageBtnDisabled]}
          disabled={page >= pages}
          onPress={() => onPage(page + 1)}
        >
          <Text style={[s.pageBtnText, page >= pages && s.pageBtnTextDisabled]}>Berikutnya ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function List({ items, loading, onOpen, rowAction, pagination }) {
  const { isDesktop } = useBreakpoint();
  if (loading && !items.length) return <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />;

  const body = isDesktop ? (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, paddingBottom: 24 }}>
      {items.length
        ? <PackageTable items={items} onPress={onOpen} renderAction={rowAction} />
        : <Text style={s.empty}>Tidak ada paket.</Text>}
    </ScrollView>
  ) : (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 24, flexGrow: 1 }}
      ListEmptyComponent={<Text style={s.empty}>Tidak ada paket.</Text>}
      renderItem={({ item }) => (
        <PackageRow pkg={item} onPress={onOpen} action={rowAction?.(item)} />
      )}
    />
  );

  return (
    <View style={{ flex: 1 }}>
      {body}
      {pagination && <PaginationBar {...pagination} pageSize={PAGE_SIZE} />}
    </View>
  );
}

// Form input manual saat data paket tidak ditemukan.
function ManualInputModal({ visible, initialInvoice, onClose, onSaved }) {
  const [f, setF] = useState({ invoice_no: '', customer_name: '', customer_phone: '', item_desc: '', pickup_type: 'customer', pickup_code: '' });
  useEffect(() => {
    if (visible) setF((old) => ({ ...old, invoice_no: initialInvoice || '' }));
  }, [visible, initialInvoice]);
  if (!visible) return null;
  const set = (k) => (v) => setF((old) => ({ ...old, [k]: v }));
  const save = async () => {
    try {
      await api.createPackage(f);
      onSaved();
      onClose();
      setF({ invoice_no: '', customer_name: '', customer_phone: '', item_desc: '', pickup_type: 'customer', pickup_code: '' });
    } catch (e) { notice(e.message); }
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <Text style={s.boxTitle}>Input Paket Manual</Text>
          <TextInput style={s.input} placeholder="No Invoice *" value={f.invoice_no} onChangeText={set('invoice_no')} autoCapitalize="characters" />
          <TextInput style={s.input} placeholder="Nama customer" value={f.customer_name} onChangeText={set('customer_name')} />
          <TextInput style={s.input} placeholder="No HP" value={f.customer_phone} onChangeText={set('customer_phone')} keyboardType="phone-pad" />
          <TextInput style={s.input} placeholder="Barang / Deskripsi" value={f.item_desc} onChangeText={set('item_desc')} />
          <TextInput style={s.input} placeholder="Kode Pickup / PIN (opsional)" value={f.pickup_code} onChangeText={set('pickup_code')} autoCapitalize="characters" />
          <View style={s.typeRow}>
            {[['customer', '🧍 Ambil Customer'], ['gojek', '🛵 Absen Gojek']].map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[s.typeChip, f.pickup_type === val && s.typeChipActive]}
                onPress={() => set('pickup_type')(val)}
              >
                <Text style={f.pickup_type === val ? s.typeTextActive : s.typeText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[s.bigBtn, { flex: 1, backgroundColor: colors.ok }]} onPress={save}>
              <Text style={s.btnText}>Simpan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.bigBtn, { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]} onPress={onClose}>
              <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---- Tab 1: Scan Paket (paket datang dari kurir) ----
export function ScanPaketScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('scan', q);
  const [scanOpen, setScanOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInvoice, setManualInvoice] = useState('');
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const onScanned = async (code) => {
    try {
      const p = await api.arrive(code);
      notice(`✅ ${p.invoice_no} sampai kios → ${p.pickup_type === 'gojek' ? 'Absen Gojek' : 'Absen Ambil Customer'}`);
    } catch (e) {
      if (e.status === 404) {
        setManualInvoice(code);
        setManualOpen(true);
        notice('Data paket tidak ditemukan — tanya Sales, lalu isi manual.');
      } else notice(e.message);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
        {isAdmin && (
          <>
            <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.primary }]} onPress={() => setScanOpen(true)}>
              <Text style={s.btnText}>📷 Scan Paket Sampai</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.sub }]} onPress={() => { setManualInvoice(''); setManualOpen(true); }}>
              <Text style={s.btnText}>＋ Manual</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Data pickup dari VEF — belum sampai kios (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
      />
      <ScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />
      <ManualInputModal
        visible={manualOpen}
        initialInvoice={manualInvoice}
        onClose={() => setManualOpen(false)}
        onSaved={refetch}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 2: Self Pick Up (dulu "Customer") ----
export function SelfPickupScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('selfpickup', q);
  const [scanOpen, setScanOpen] = useState(false);
  const [codePkg, setCodePkg] = useState(null);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isSales = user.role === 'sales';

  const generate = async (pkg) => {
    try {
      const p = pkg.pickup_code ? pkg : await api.generateCode(pkg.id);
      setCodePkg(p);
    } catch (e) { notice(e.message); }
  };

  const onScanned = async (code) => {
    try {
      const p = await api.findByCode(code.trim());
      setOpenId(p.id);
    } catch (e) { notice(e.message); }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
        {isAdmin && (
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.ok }]} onPress={() => setScanOpen(true)}>
            <Text style={s.btnText}>📷 Scan Pickup Code</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Menunggu diambil (self pick up) (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
        rowAction={(p) =>
          (isSales || isAdmin) ? (
            <TouchableOpacity style={s.rowBtn} onPress={() => generate(p)}>
              <Text style={s.rowBtnText}>{p.pickup_code ? 'Lihat Kode' : 'Buat Kode'}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <ScannerModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={onScanned}
      />
      <CodeModal pkg={codePkg} onClose={() => setCodePkg(null)} />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 3: Gojek ----
export function GojekScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('gojek', q);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const quickAction = (pkg) => {
    const next = (NEXT_ACTIONS[pkg.status] || [])[0];
    if (!next || !isAdmin) return null;
    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(next.to) }]}
        onPress={async () => {
          if (next.to === 'done_pickup') return setOpenId(pkg.id);
          try { await api.updatePackage(pkg.id, { status: next.to }); }
          catch (e) { notice(e.message); }
        }}
      >
        <Text style={s.rowBtnText}>{next.label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Ambilan Gojek (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
        rowAction={quickAction}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 4: Cancel / Retur ----
export function CancelReturScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('cancelretur', q);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const rowAction = (pkg) => {
    if (!isAdmin || pkg.status !== 'retur') return null;
    const isGojek = pkg.pickup_type === 'gojek';
    const to = isGojek ? 'mencari_driver' : 'absen_ambil_customer';
    const label = isGojek ? '🔍 Cari Driver' : '↩️ Kembali ke Antrian';
    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(to) }]}
        onPress={async () => {
          try { await api.updatePackage(pkg.id, { status: to }); }
          catch (e) { notice(e.message); }
        }}
      >
        <Text style={s.rowBtnText}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Cancel / Retur (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
        rowAction={rowAction}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 4: Semua paket + import CSV ----
export function SemuaScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages(null, q);
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const canImport = user.role === 'warehouse' || user.role === 'superadmin';

  const doImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setImporting(true);
    try {
      const out = await importCsv(res.assets[0]);
      notice(`Import selesai: ${out.inserted} baru, ${out.updated} diperbarui, ${out.skipped} dilewati.`);
    } catch (e) { notice(e.message); }
    finally { setImporting(false); }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
        {canImport && (
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.primary }]} onPress={doImport} disabled={importing}>
            <Text style={s.btnText}>{importing ? '...' : '📄 Import CSV'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Semua paket (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 6: Datatable Arsip Paket (Khusus Super Admin) ----
export function ArsipScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('arsip', q);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const handleUnarchive = async (pkg) => {
    setBusyId(pkg.id);
    try {
      await api.unarchivePackage(pkg.id);
      notice(`✅ Berhasil mengembalikan paket ${pkg.invoice_no} ke data aktif!`);
      refetch();
    } catch (e) {
      notice(`Gagal: ${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  const rowAction = (pkg) => (
    <TouchableOpacity
      style={[s.rowBtn, { backgroundColor: '#10B981' }]}
      onPress={() => handleUnarchive(pkg)}
      disabled={busyId === pkg.id}
    >
      <Text style={s.rowBtnText}>
        {busyId === pkg.id ? '...' : '🔄 Pulihkan'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari di data arsip (invoice / customer / resi)..."
          value={q}
          onChangeText={setQ}
        />
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian arsip "${q.trim()}" (${total})` : `📁 Datatable Arsip Paket (${total})`}
      </Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
        rowAction={rowAction}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 0 },
  bigBtn: {
    borderRadius: radius.pill, paddingVertical: 13, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, ...shadow.card,
  },
  btnText: { color: '#fff', fontWeight: '700' },
  sectionTitle: {
    color: colors.sub, fontWeight: '700', paddingHorizontal: 16, paddingTop: 16,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6,
  },
  empty: { color: colors.faint, textAlign: 'center', marginTop: 40, fontWeight: '600' },
  pageBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12, flexWrap: 'wrap',
    backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border,
  },
  pageInfo: { color: colors.sub, fontSize: 12.5, fontWeight: '600' },
  pageCtrls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pageBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 7, paddingHorizontal: 13, backgroundColor: colors.surface,
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { color: colors.primary, fontWeight: '700', fontSize: 12.5 },
  pageBtnTextDisabled: { color: colors.faint },
  pageNum: { color: colors.ink, fontWeight: '700', fontSize: 12.5, minWidth: 68, textAlign: 'center' },
  rowBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 8, paddingHorizontal: 13,
  },
  rowBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  box: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 22,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 420, ...shadow.float,
  },
  boxTitle: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.surface, padding: 12, fontSize: 15,
    marginBottom: 10, color: colors.ink,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 8, paddingHorizontal: 15, backgroundColor: colors.bg,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeText: { color: colors.sub, fontWeight: '600' },
  typeTextActive: { color: colors.primary, fontWeight: '700' },
});
