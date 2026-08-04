// Tab 3: Gojek — paket yang diantar via driver Gojek
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { api } from '../api';
import { notice, colors, statusColor, NEXT_ACTIONS } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';

export default function GojekScreen({ user }) {
  const [q, setQ] = useState('');
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('gojek', q);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';

  const rowAction = (pkg) => {
    const next = (NEXT_ACTIONS[pkg.status] || [])[0];
    if (!next || !isAdmin) return null;
    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(next.to) }]}
        onPress={async () => {
          if (next.to === 'done_pickup') return setOpenId(pkg.id);
          try {
            await api.updatePackage(pkg.id, { status: next.to });
          } catch (e) {
            notice(e.message);
          }
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
      <PackageList
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
