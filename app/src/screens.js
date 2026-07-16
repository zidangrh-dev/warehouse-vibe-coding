import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, importCsv, getSocket } from './api';
import { colors, radius, shadow, notice, statusColor, NEXT_ACTIONS } from './theme';
import { PackageRow, CodeModal, PickerNameModal } from './components';
import ScannerModal from './ScannerModal';
import PackageModal from './PackageModal';

// Ambil daftar paket untuk sebuah tab + auto-refresh saat ada perubahan (realtime).
function usePackages(tab, q) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    try {
      setItems(await api.listPackages(tab, q));
    } catch (e) {
      notice(`Gagal memuat: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, q]);
  useEffect(() => {
    refetch();
    const socket = getSocket();
    socket.on('packages:changed', refetch);
    return () => socket.off('packages:changed', refetch);
  }, [refetch]);
  return { items, loading, refetch };
}

function List({ items, loading, onOpen, rowAction }) {
  if (loading) return <ActivityIndicator style={{ marginTop: 30 }} />;
  return (
    <FlatList
      data={items}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: 14, paddingBottom: 92 }}
      ListEmptyComponent={<Text style={s.empty}>Tidak ada paket.</Text>}
      renderItem={({ item }) => (
        <PackageRow pkg={item} onPress={onOpen} action={rowAction?.(item)} />
      )}
    />
  );
}

// Form input manual saat data paket tidak ditemukan.
function ManualInputModal({ visible, initialInvoice, onClose, onSaved }) {
  const [f, setF] = useState({ invoice_no: '', customer_name: '', customer_phone: '', item_desc: '', pickup_type: 'customer' });
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
      setF({ invoice_no: '', customer_name: '', customer_phone: '', item_desc: '', pickup_type: 'customer' });
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
          <TextInput style={s.input} placeholder="Barang" value={f.item_desc} onChangeText={set('item_desc')} />
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
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.ok }]} onPress={save}>
            <Text style={s.btnText}>Simpan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.sub }]} onPress={onClose}>
            <Text style={s.btnText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---- Tab 1: Scan Paket (paket datang dari kurir) ----
export function ScanPaketScreen({ user }) {
  const { items, loading, refetch } = usePackages('scan');
  const [scanOpen, setScanOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualInvoice, setManualInvoice] = useState('');
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin';

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
      {isAdmin && (
        <View style={s.topBar}>
          <TouchableOpacity style={[s.bigBtn, { flex: 1, backgroundColor: colors.primary }]} onPress={() => setScanOpen(true)}>
            <Text style={s.btnText}>📷 Scan Paket Sampai</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.bigBtn, { backgroundColor: colors.sub }]} onPress={() => { setManualInvoice(''); setManualOpen(true); }}>
            <Text style={s.btnText}>＋ Manual</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={s.sectionTitle}>Data pickup dari VEF — belum sampai kios ({items.length})</Text>
      <List items={items} loading={loading} onOpen={(p) => setOpenId(p.id)} />
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

// ---- Tab 2: Absen Ambil Customer ----
export function CustomerScreen({ user }) {
  const { items, loading, refetch } = usePackages('customer');
  const [scanOpen, setScanOpen] = useState(false);
  const [pendingCode, setPendingCode] = useState(null);
  const [codePkg, setCodePkg] = useState(null);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin';
  const isSales = user.role === 'sales';

  const generate = async (pkg) => {
    try {
      const p = pkg.pickup_code ? pkg : await api.generateCode(pkg.id);
      setCodePkg(p);
    } catch (e) { notice(e.message); }
  };

  const redeem = async (pickerName) => {
    try {
      const p = await api.redeem(pendingCode, pickerName);
      notice(`✅ ${p.invoice_no} selesai — diambil ${pickerName || 'customer'}`);
    } catch (e) { notice(e.message); }
    finally { setPendingCode(null); }
  };

  return (
    <View style={s.screen}>
      {isAdmin && (
        <View style={s.topBar}>
          <TouchableOpacity style={[s.bigBtn, { flex: 1, backgroundColor: colors.ok }]} onPress={() => setScanOpen(true)}>
            <Text style={s.btnText}>📷 Scan Pickup Code Customer</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={s.sectionTitle}>Menunggu diambil customer ({items.length})</Text>
      <List
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
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
        onScanned={(code) => setPendingCode(code)}
      />
      <PickerNameModal
        visible={!!pendingCode}
        onSubmit={redeem}
        onClose={() => setPendingCode(null)}
      />
      <CodeModal pkg={codePkg} onClose={() => setCodePkg(null)} />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 3: Gojek ----
export function GojekScreen({ user }) {
  const { items, loading, refetch } = usePackages('gojek');
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin';

  const quickAction = (pkg) => {
    const next = (NEXT_ACTIONS[pkg.status] || [])[0];
    if (!next || !isAdmin) return null;
    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(next.to) }]}
        onPress={async () => {
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
      <Text style={s.sectionTitle}>Ambilan Gojek ({items.length})</Text>
      <List items={items} loading={loading} onOpen={(p) => setOpenId(p.id)} rowAction={quickAction} />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

// ---- Tab 4: Semua paket + import CSV ----
export function SemuaScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, loading, refetch } = usePackages(null, q);
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const canImport = user.role === 'warehouse' || user.role === 'admin';

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
      <List items={items} loading={loading} onOpen={(p) => setOpenId(p.id)} />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 0 },
  bigBtn: {
    borderRadius: 999, paddingVertical: 14, paddingHorizontal: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, ...shadow.card,
  },
  btnText: { color: '#fff', fontWeight: '800' },
  sectionTitle: {
    color: colors.sub, fontWeight: '800', paddingHorizontal: 16, paddingTop: 16,
    fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  empty: { color: colors.faint, textAlign: 'center', marginTop: 40, fontWeight: '600' },
  rowBtn: {
    backgroundColor: colors.primary, borderRadius: 999,
    paddingVertical: 9, paddingHorizontal: 14,
  },
  rowBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(16,24,40,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  box: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 22,
    width: '100%', maxWidth: 420, ...shadow.float,
  },
  boxTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.surface, padding: 12, fontSize: 15,
    marginBottom: 10, color: colors.ink,
  },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeChip: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: 999,
    paddingVertical: 8, paddingHorizontal: 15, backgroundColor: colors.bg,
  },
  typeChipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  typeText: { color: colors.sub, fontWeight: '700' },
  typeTextActive: { color: colors.primary, fontWeight: '800' },
});
