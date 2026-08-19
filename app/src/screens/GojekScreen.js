// Tab 3: Gojek — paket yang diantar via driver Gojek
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { api } from '../api';
import { notice, colors, radius, statusColor, NEXT_ACTIONS } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';
import { useBreakpoint } from '../responsive';

const CHIP_STATUSES = [
  { label: 'Semua', status: '' },
  { label: 'Absen Gojek', status: 'absen_gojek' },
  { label: 'Mencari Driver', status: 'mencari_driver' },
  { label: 'Driver Sampai Kios', status: 'driver_sampai_kios' },
  { label: 'Selesai', status: 'selesai' },
];

export default function GojekScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('gojek', q, colFilters);
  const [openId, setOpenId] = useState(null);
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const { isDesktop } = useBreakpoint();

  const rowAction = (pkg) => {
    const next = (NEXT_ACTIONS[pkg.status] || [])[0];
    if (!next || !isAdmin) return null;
    return (
      <TouchableOpacity
        style={[s.rowBtn, { backgroundColor: statusColor(next.to) }]}
        onPress={async () => {
          if (next.to === 'selesai' || next.to === 'retur' || next.to === 'cancel') return setOpenId(pkg.id);
          if (next.to === 'driver_sampai_kios') {
            try {
              await api.updatePackage(pkg.id, { status: next.to });
              refetch();
            } catch (e) {
              notice(e.message);
            }
            return;
          }
          try {
            await api.updatePackage(pkg.id, { status: next.to });
            refetch();
          } catch (e) {
            notice(e.message);
          }
        }}
      >
        <Text style={s.rowBtnText}>{next.label}</Text>
      </TouchableOpacity>
    );
  };

  const applyStatus = (status) => {
    const next = { ...colFilters, status };
    setColFilters(next);
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Cari invoice / nama / kode..."
          value={q}
          onChangeText={setQ}
        />
      </View>

      {/* Filter cepat status — penting di HP untuk menyortir di lapangan.
          Desktop sudah punya quick chip filter di PackageTable */}
      {!isDesktop && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0 }}
          contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingTop: 10, paddingBottom: 6, alignItems: 'flex-start' }}
        >
          {CHIP_STATUSES.map((chip) => {
            const active = (colFilters.status || '') === chip.status;
            return (
              <TouchableOpacity
                key={chip.label}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 5,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.primary : '#E2E8F0',
                  flexShrink: 0,
                  maxWidth: 180,
                  alignItems: 'center',
                }}
                activeOpacity={0.7}
                onPress={() => applyStatus(chip.status)}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#FFFFFF' : colors.sub }}>
                  {chip.status ? `● ${chip.label}` : chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <Text style={s.sectionTitle}>
        {searching ? `Hasil pencarian "${q.trim()}" (${total})` : `Ambilan Gojek (${total})`}
      </Text>
      <PackageList
        items={items}
        loading={loading}
        onOpen={(p) => setOpenId(p.id)}
        pagination={{ page, total, onPage: setPage }}
        rowAction={rowAction}
        onSearchQuery={setQ}
        onColumnFilterChange={setColFilters}
        tab="gojek"
        userRole={user.role}
        onChanged={refetch}
      />
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}