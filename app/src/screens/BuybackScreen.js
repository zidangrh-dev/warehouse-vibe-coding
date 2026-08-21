// Tab Buyback — paket yang diambil langsung driver (tanpa data driver & foto).
// Admin paste daftar "AWB/Invoice - Kode Pickup" dari MP -> absen_buyback,
// lalu klik "Selesai" di modal saat driver bawa amplop.
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { api } from '../api';
import { notice, colors, radius } from '../theme';
import { usePackages } from '../hooks/usePackages';
import { PackageList } from './ListComponents';
import { s } from './styles';
import PackageModal from '../PackageModal';

export default function BuybackScreen({ user }) {
  const [q, setQ] = useState('');
  const [colFilters, setColFilters] = useState({});
  const { items, total, page, setPage, loading, searching, refetch } = usePackages('buyback', q, colFilters);
  const [paste, setPaste] = useState('');
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [result, setResult] = useState(null);

  const process = async () => {
    const text = paste.trim();
    if (!text) return notice('Tempel dulu daftar AWB/Invoice - Kode Pickup.');
    setBusy(true);
    setResult(null);
    try {
      const r = await api.buybackArrive(text);
      setResult(r);
      notice(
        `Diproses: ${r.processed} paket, dilewati: ${r.skipped}`,
        r.processed > 0 ? 'success' : 'info',
      );
      setPaste('');
      refetch();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="Cari invoice / AWB / kode..."
          value={q}
          onChangeText={setQ}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ paddingHorizontal: 14, paddingTop: 12 }}>
          <Text style={{ fontSize: 12.5, fontWeight: '800', color: colors.sub, marginBottom: 6 }}>
            Paste daftar Buyback (AWB/Invoice - Kode Pickup)
          </Text>
          <TextInput
            style={{
              minHeight: 92,
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: radius.input,
              backgroundColor: colors.surface,
              padding: 10,
              fontSize: 13,
              color: colors.ink,
              textAlignVertical: 'top',
            }}
            placeholder={'Contoh:\n260820T2X6MAU8 - 0L1\n260820T2X6KHUR - 1RJS'}
            placeholderTextColor={colors.faint}
            value={paste}
            onChangeText={(v) => { setPaste(v); setResult(null); }}
            multiline
            editable={!busy}
          />
          <TouchableOpacity
            style={[s.bigBtn, { marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#6D28D9' }]}
            onPress={process}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Proses Absen Buyback</Text>
            )}
          </TouchableOpacity>

          {/* Panel hasil proses */}
          {result && result.errors?.length > 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: radius.card, borderWidth: 1, borderColor: '#FCA5A5', padding: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#991B1B', marginBottom: 8 }}>
                {result.errors.length} baris gagal diproses:
              </Text>
              {result.errors.map((err, i) => (
                <View key={i} style={{ marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: colors.ink }}>{err.line}</Text>
                  <Text style={{ fontSize: 11, color: '#991B1B' }}>→ {err.reason}</Text>
                </View>
              ))}
            </View>
          )}

          {result && result.errors?.length === 0 && (
            <View style={{ marginTop: 12, backgroundColor: '#ECFDF5', borderRadius: radius.card, borderWidth: 1, borderColor: '#A7F3D0', padding: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#065F46' }}>
                ✓ Berhasil diproses {result.processed} paket
              </Text>
            </View>
          )}
        </View>

        <Text style={s.sectionTitle}>
          {searching ? `Hasil "${q.trim()}" (${total})` : `Buyback (${total})`}
        </Text>
        <PackageList
          items={items}
          loading={loading}
          onOpen={(p) => setOpenId(p.id)}
          pagination={{ page, total, onPage: setPage }}
          rowAction={null}
          onSearchQuery={setQ}
          onColumnFilterChange={setColFilters}
          tab="buyback"
        />
      </ScrollView>
      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={refetch} />
    </View>
  );
}
