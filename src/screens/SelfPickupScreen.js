// Tab 2: Self Pick Up — paket yang diambil sendiri oleh customer
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ActivityIndicator, Pressable } from 'react-native';
import { api } from '../api';
import { notice, useTheme } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { useS } from './styles';
import { CodeModal } from '../components';
import ScannerModal from '../ScannerModal';
import PackageModal from '../PackageModal';

export default function SelfPickupScreen({ user }) {
  const { colors } = useTheme();
  const s = useS();
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch, updateItem } = usePackages('selfpickup', q, colFilters);
  const [scanOpen, setScanOpen] = useState(false);
  const [codePkg, setCodePkg] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [busyExport, setBusyExport] = useState(false);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const canGenerateCode = user.role === 'sales' || user.role === 'superadmin';

  const doExport = async (fmt) => {
    if (busyExport) return;
    setBusyExport(fmt);
    try {
      await api.exportPackages(fmt, 'selfpickup', q, colFilters);
      notice(`Export ${fmt === 'xlsx' ? 'Excel' : 'CSV'} berhasil — file terunduh.`, 'success');
      setExportOpen(false);
    } catch (e) {
      notice(`Export gagal: ${e.message}`);
    } finally {
      setBusyExport(false);
    }
  };

  const generate = async (pkg) => {
    try {
      let p = pkg;
      if (!pkg.pickup_code) {
        p = await api.generateCode(pkg.id);
        // Optimistic update: langsung tampilkan kode baru di list tanpa nunggu
        // refetch (mencegah klik berulang yang bikin kode berubah-ubah).
        updateItem(p);
      }
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

  const rowAction = (p) => {
    if (canGenerateCode) {
      return (
        <TouchableOpacity style={s.rowBtn} onPress={() => generate(p)}>
          <Text style={s.rowBtnText}>{p.pickup_code ? 'Lihat Kode' : 'Buat Kode'}</Text>
        </TouchableOpacity>
      );
    }
    // Admin hanya boleh MELIHAT kode yang sudah ada (tidak membuat).
    if (isAdmin && p.pickup_code) {
      return (
        <TouchableOpacity style={s.rowBtn} onPress={() => setCodePkg(p)}>
          <Text style={s.rowBtnText}>Lihat Kode</Text>
        </TouchableOpacity>
      );
    }
    return null;
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
        <TouchableOpacity
          style={[s.bigBtn, { backgroundColor: colors.primary }]}
          onPress={() => setExportOpen(true)}
        >
          <Text style={s.btnText} numberOfLines={1}>Export</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={[s.bigBtn, { backgroundColor: colors.ok }]}
            onPress={() => setScanOpen(true)}
          >
            <Text style={s.btnText} numberOfLines={1}>Scan Pickup Code</Text>
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

      {/* Modal pilihan export — hasil sesuai filter tab Self Pick Up yang sedang aktif */}
      <Modal visible={exportOpen} transparent animationType="slide" onRequestClose={() => setExportOpen(false)}>
        <Pressable style={s.backdrop} onPress={() => setExportOpen(false)}>
          <Pressable style={s.box} onPress={(e) => e?.stopPropagation?.()}>
            <Text style={s.boxTitle}>Export Data Self Pick Up</Text>
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
