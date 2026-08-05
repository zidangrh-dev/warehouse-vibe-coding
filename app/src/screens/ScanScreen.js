// Tab 1: Scan Paket — paket baru datang dari kurir
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import ScannerModal from '../ScannerModal';
import PackageModal from '../PackageModal';
import ManualInputModal from './ManualInputModal';

export default function ScanScreen({ user }) {
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
          placeholder="🔍 Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.primary }]}
              onPress={() => setScanOpen(true)}
            >
              <Text style={s.btnText}>📷 Scan Paket Sampai</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.sub }]}
              onPress={() => { setManualInvoice(''); setManualOpen(true); }}
            >
              <Text style={s.btnText}>＋ Manual</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching
          ? `Hasil pencarian "${q.trim()}" (${total})`
          : `Data pickup dari VEF — belum sampai kios (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
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
