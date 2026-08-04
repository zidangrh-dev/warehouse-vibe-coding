// Tab 5: Semua Paket — seluruh paket aktif + import via CSV
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { importCsv } from '../api';
import { notice, colors } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';

export default function SemuaScreen({ user }) {
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
    } catch (e) {
      notice(e.message);
    } finally {
      setImporting(false);
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
        {canImport && (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: colors.primary }]}
            onPress={doImport}
            disabled={importing}
          >
            <Text style={s.btnText}>{importing ? '...' : '📄 Import CSV'}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Semua paket (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}
