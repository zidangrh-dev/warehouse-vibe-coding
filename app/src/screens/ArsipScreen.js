// Tab 6: Arsip Data — paket yang diarsipkan (hanya Super Admin)
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';

export default function ArsipScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('arsip', q, colFilters);
  const [openId, setOpenId] = useState(null);

  const {
    selectedIds,
    setSelectedIds,
    toggleSelect,
    toggleSelectAll,
    isAllSelected,
    busyId,
    busyBulk,
    handleUnarchiveSingle,
    handleUnarchiveBulk,
  } = useBulkSelection(items);

  const rowAction = (pkg) => {
    const isSelected = selectedIds.includes(pkg.id);
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity
          style={[s.selectBox, isSelected && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          onPress={() => toggleSelect(pkg.id)}
        >
          {isSelected && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>✓</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.rowBtn, { backgroundColor: '#10B981' }]}
          onPress={() => handleUnarchiveSingle(pkg, refetch)}
          disabled={busyId === pkg.id || busyBulk}
        >
          <Text style={s.rowBtnText}>{busyId === pkg.id ? '...' : '🔄 Pulihkan'}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={s.screen}>
      {/* Bulk Action Banner */}
      {selectedIds.length > 0 && (
        <View style={s.bulkBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={s.bulkBadge}>
              <Text style={s.bulkBadgeText}>{selectedIds.length}</Text>
            </View>
            <Text style={s.bulkText}>Paket dipilih dari daftar arsip</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={[s.bigBtn, { backgroundColor: '#10B981', paddingVertical: 8, paddingHorizontal: 16 }]}
              onPress={() => handleUnarchiveBulk(refetch)}
              disabled={busyBulk}
            >
              {busyBulk
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.btnText}>🔄 Pulihkan {selectedIds.length} Paket Terpilih</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, {
                backgroundColor: colors.surfaceAlt,
                borderWidth: 1,
                borderColor: colors.border,
                paddingVertical: 8,
                paddingHorizontal: 14,
              }]}
              onPress={() => setSelectedIds([])}
            >
              <Text style={{ color: colors.ink, fontWeight: '700', fontSize: 12 }}>Batal Pilih</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari di data arsip (invoice / customer / resi)..."
          value={q}
          onChangeText={setQ}
        />
        {items.length > 0 && (
          <TouchableOpacity
            style={[s.bigBtn, {
              backgroundColor: isAllSelected ? colors.primary : colors.surfaceAlt,
              borderWidth: 1,
              borderColor: colors.border,
            }]}
            onPress={toggleSelectAll}
          >
            <Text style={{ color: isAllSelected ? '#fff' : colors.ink, fontWeight: '700', fontSize: 12 }}>
              {isAllSelected ? '✓ Batalkan Pilih Semua' : '☑️ Pilih Semua di Halaman Ini'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={s.sectionTitle}>
        {searching
          ? `Hasil pencarian arsip "${q.trim()}" (${total})`
          : `📁 Datatable Arsip Paket (${total})`}
      </Text>

      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        rowAction={rowAction}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}
