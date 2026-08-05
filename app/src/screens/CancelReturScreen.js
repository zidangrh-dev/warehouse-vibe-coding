// Tab 4: Cancel / Retur — paket yang dibatalkan atau dikembalikan
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors, statusColor } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';

export default function CancelReturScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('cancelretur', q, colFilters);
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
          try {
            await api.updatePackage(pkg.id, { status: to });
          } catch (e) {
            notice(e.message);
          }
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
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        rowAction={rowAction}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="cancelretur"
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}
