// Tab 5: Semua Paket — seluruh paket aktif + import via CSV
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { importCsvProgress } from '../api';
import { notice, colors } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';
import ImportProgressModal from '../ImportProgressModal';

export default function SemuaScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages(null, q, colFilters);
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importError, setImportError] = useState(null);
  const canImport = user.role === 'warehouse' || user.role === 'superadmin';

  const doImport = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', '*/*'],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.length) return;
    setImporting(true);
    setImportError(null);
    setImportProgress({ processed: 0, total: 0, percent: 0, inserted: 0, updated: 0, skipped: 0, done: false });
    try {
      await importCsvProgress(res.assets[0], (prog) => {
        setImportProgress(prog);
      });
      refetch();
    } catch (e) {
      setImportError(e.message || 'Import gagal');
    }
  };

  const handleCloseImportModal = () => {
    setImporting(false);
    setImportProgress(null);
    setImportError(null);
    refetch();
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
        {searching ? `Hasil pencarian (${total})` : `Semua paket (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={searching ? null : { page, total, onPage: setPage }}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="semua"
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
      <ImportProgressModal
        visible={importing}
        progress={importProgress}
        error={importError}
        onClose={handleCloseImportModal}
      />
    </View>
  );
}
