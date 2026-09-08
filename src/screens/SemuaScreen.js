// Tab 5: Semua Paket — seluruh paket aktif + import via CSV + export (xlsx/csv)
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { api, importCsvProgress } from '../api';
import { notice, useTheme } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { useS } from './styles';
import PackageModal from '../PackageModal';
import ImportProgressModal from '../ImportProgressModal';

export default function SemuaScreen({ user }) {
  const { colors } = useTheme();
  const s = useS();
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('semua', q, colFilters);
  const [openId, setOpenId] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [importError, setImportError] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const canImport = user.role === 'warehouse' || user.role === 'superadmin';

  // Export mengikuti pencarian + filter kolom yang sedang aktif di tab Semua.
  const doExport = async (fmt) => {
    if (busyExport) return;
    setBusyExport(fmt);
    try {
      await api.exportPackages(fmt, 'semua', q, colFilters);
      notice(`Export ${fmt === 'xlsx' ? 'Excel' : 'CSV'} berhasil — file terunduh.`, 'success');
      setExportOpen(false);
    } catch (e) {
      notice(`Export gagal: ${e.message}`);
    } finally {
      setBusyExport(false);
    }
  };

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
          style={[s.input, s.topBarInput]}
          placeholder="Cari invoice / nama / kode..."
          placeholderTextColor={colors.faint}
          value={q}
          onChangeText={setQ}
        />
        {canImport && (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: colors.primary }]}
            onPress={doImport}
            disabled={importing}
          >
            <Text style={s.btnText} numberOfLines={1}>{importing ? '...' : 'Import CSV'}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[s.bigBtn, { backgroundColor: '#217346' }]}
          onPress={() => setExportOpen(true)}
        >
          <Text style={s.btnText} numberOfLines={1}>Export</Text>
        </TouchableOpacity>
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

      {/* Modal pilihan export — hasil sesuai pencarian & filter tab Semua yang sedang aktif */}
      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setExportOpen(false)}>
          <Pressable style={s.box} onPress={(e) => e?.stopPropagation?.()}>
            <Text style={s.boxTitle}>Export Data Semua Paket</Text>
            <Text style={{ color: colors.sub, fontSize: 13, marginBottom: 4 }}>
              Data diekspor sesuai pencarian & filter yang sedang aktif ({total} paket).
            </Text>
            <Text style={{ color: colors.faint, fontSize: 12, marginBottom: 16 }}>
              Pilih format file tujuan.
            </Text>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: '#217346', width: '100%' }]}
              onPress={() => doExport('xlsx')}
              disabled={!!busyExport}
            >
              {busyExport === 'xlsx' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText} numberOfLines={1}>Export ke Excel (.xlsx)</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.primary, width: '100%', marginTop: 10 }]}
              onPress={() => doExport('csv')}
              disabled={!!busyExport}
            >
              {busyExport === 'csv' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText} numberOfLines={1}>Export ke CSV (.csv)</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, width: '100%', marginTop: 10 }]}
              onPress={() => setExportOpen(false)}
              disabled={!!busyExport}
            >
              <Text style={[s.btnText, { color: colors.ink }]}>Tutup</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
