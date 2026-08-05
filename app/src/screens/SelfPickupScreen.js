// Tab 2: Self Pick Up — paket yang diambil sendiri oleh customer
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import { CodeModal } from '../components';
import ScannerModal from '../ScannerModal';
import PackageModal from '../PackageModal';

export default function SelfPickupScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('selfpickup', q, colFilters);
  const [scanOpen, setScanOpen] = useState(false);
  const [codePkg, setCodePkg] = useState(null);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isSales = user.role === 'sales';

  const generate = async (pkg) => {
    try {
      const p = pkg.pickup_code ? pkg : await api.generateCode(pkg.id);
      setCodePkg(p);
    } catch (e) {
      notice(e.message);
    }
  };

  const onScanned = async (code) => {
    try {
      const p = await api.findByCode(code.trim());
      setOpenId(p.id);
    } catch (e) {
      notice(e.message);
    }
  };

  const rowAction = (p) =>
    (isSales || isAdmin) ? (
      <TouchableOpacity style={s.rowBtn} onPress={() => generate(p)}>
        <Text style={s.rowBtnText}>{p.pickup_code ? 'Lihat Kode' : 'Buat Kode'}</Text>
      </TouchableOpacity>
    ) : null;

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
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: colors.ok }]}
            onPress={() => setScanOpen(true)}
          >
            <Text style={s.btnText}>📷 Scan Pickup Code</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching
          ? `Hasil pencarian "${q.trim()}" (${total})`
          : `Menunggu diambil (self pick up) (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        rowAction={rowAction}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="selfpickup"
      />
      <ScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={onScanned} />
      <CodeModal pkg={codePkg} onClose={() => setCodePkg(null)} />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}
