import { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, Linking,
} from 'react-native';
import { api, getSocket } from './api';
import { radius, spacing, notice, confirmAsync, useTheme } from './theme';
import Icon from './Icon';

const PLATFORMS = [
  { key: 'tiktok', label: 'TikTok Shop' },
  { key: 'shopee', label: 'Shopee' },
];

// Server mengecek tiap 30 menit; lewat 2 jam berarti job tidak jalan, jadi status lama tidak bisa dipercaya.
const STALE_MS = 2 * 60 * 60 * 1000;

export function healthLevel(shop) {
  if (shop.health === 'problem') return 'problem';
  const stale = !shop.last_check_at || Date.now() - new Date(shop.last_check_at).getTime() > STALE_MS;
  return shop.health === 'ok' && !stale ? 'ok' : 'unverified';
}

const LEVEL_ORDER = { problem: 0, unverified: 1, ok: 2 };

const fmtTime = (d) => new Date(d).toLocaleString('id-ID', {
  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

// Terima URL hasil redirect utuh atau kodenya saja.
function parseAuthCode(text) {
  const t = text.trim();
  const m = t.match(/[?&]code=([^&#]+)/);
  if (m) return decodeURIComponent(m[1]);
  return t.includes('://') ? '' : t;
}

export default function MarketplaceScreen({ user }) {
  // Sales hanya menghubungkan dan mengecek tokonya sendiri; server menolak sisanya.
  const canManage = user?.role === 'superadmin';
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [data, setData] = useState({ shops: [], platforms: {} });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('semua');
  const [showSettings, setShowSettings] = useState(false);
  const [form, setForm] = useState({ app_key: '', app_secret: '', auth_url: '' });
  const [pasted, setPasted] = useState('');
  const [busy, setBusy] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingShop, setCheckingShop] = useState(null);

  const tiktok = data.platforms.tiktok || {};

  const load = async () => {
    try {
      const d = await api.marketplaceShops();
      setData(d);
      setForm((old) => ({ ...old, app_key: d.platforms.tiktok?.appKey || '', auth_url: d.platforms.tiktok?.authUrl || '' }));
      if (canManage && !d.platforms.tiktok?.authUrl) setShowSettings(true);
    } catch (e) {
      notice(`Gagal memuat marketplace: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    const onChanged = () => { setCheckingAll(false); load(); };
    socket.on('marketplace:changed', onChanged);
    return () => socket.off('marketplace:changed', onChanged);
  }, []);

  const countOf = (key) => data.shops.filter((sh) => (key === 'semua' ? true
    : key === 'perlu' ? healthLevel(sh) !== 'ok' : sh.platform === key)).length;

  const shops = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return data.shops
      .filter((sh) => (filter === 'semua' || (filter === 'perlu' ? healthLevel(sh) !== 'ok' : sh.platform === filter))
        && (!needle || `${sh.name} ${sh.code}`.toLowerCase().includes(needle)))
      .sort((a, b) => LEVEL_ORDER[healthLevel(a)] - LEVEL_ORDER[healthLevel(b)] || a.name.localeCompare(b.name));
  }, [data.shops, q, filter]);

  const connect = () => {
    if (!tiktok.configured || !tiktok.authUrl) {
      if (!canManage) return notice('Belum bisa menghubungkan toko. Minta Super Admin melengkapi pengaturan marketplace.', 'error');
      setShowSettings(true);
      return notice('Lengkapi App Key, App Secret, dan Link Otorisasi dulu.', 'error');
    }
    Linking.openURL(tiktok.authUrl);
  };

  const connectPasted = async () => {
    const code = parseAuthCode(pasted);
    if (!code) return notice('URL tidak berisi kode otorisasi.', 'error');
    setBusy(true);
    try {
      const r = await api.connectTiktok(code);
      notice(`Toko terhubung: ${r.shops.join(', ') || '(tidak ada)'}`, 'success');
      setPasted('');
      await load();
    } catch (e) {
      notice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await api.saveTiktokSettings(form);
      notice('Pengaturan TikTok disimpan', 'success');
      setForm((old) => ({ ...old, app_secret: '' }));
      setShowSettings(false);
      await load();
    } catch (e) {
      notice(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const checkAll = async () => {
    setCheckingAll(true);
    try {
      await api.checkAllShops();
      // Selesai ditandai event marketplace:changed; batas waktu kalau event tidak pernah datang.
      setTimeout(() => setCheckingAll(false), 120000);
    } catch (e) {
      setCheckingAll(false);
      notice(e.message, 'error');
    }
  };

  const checkOne = async (sh) => {
    setCheckingShop(sh.shop_id);
    try {
      const r = await api.checkShop(sh.platform, sh.shop_id);
      await load();
      if (r.health === 'ok') notice(`${sh.name}: aktif`, 'success');
      else notice(`${sh.name}: masih bermasalah`, 'error');
    } catch (e) {
      notice(e.message, 'error');
    } finally {
      setCheckingShop(null);
    }
  };

  const remove = async (sh) => {
    if (!(await confirmAsync('Putuskan Toko?', `Token ${sh.name} akan dihapus dari PickHub. Toko bisa dihubungkan lagi kapan saja.`))) return;
    try {
      await api.removeMarketplaceShop(sh.platform, sh.shop_id);
      notice('Toko diputuskan', 'success');
      await load();
    } catch (e) {
      notice(e.message, 'error');
    }
  };

  const levelStyle = {
    ok: { label: 'Aktif', bg: colors.okChip, color: colors.okText },
    unverified: { label: 'Belum terverifikasi', bg: colors.warnBg, color: colors.warnText },
    problem: { label: 'Bermasalah', bg: colors.dangerBg, color: colors.dangerText },
  };

  if (loading) return <ActivityIndicator style={{ marginTop: 60 }} color={colors.primary} />;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}>
      <View style={s.headRow}>
        <View style={{ flex: 1, minWidth: 220 }}>
          <Text style={s.title}>Marketplace</Text>
          <Text style={s.subtitle}>
            {canManage ? 'Toko yang terhubung ke PickHub.' : 'Toko yang kamu hubungkan ke PickHub.'} Status dites ke marketplace tiap 30 menit.
          </Text>
        </View>
        {canManage && (
          <TouchableOpacity style={s.btnGhost} onPress={() => setShowSettings((v) => !v)}>
            <Text style={s.btnGhostText}>{showSettings ? 'Tutup Pengaturan' : 'Pengaturan'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {canManage && showSettings && (
        <View style={s.panel}>
          <Text style={s.panelTitle}>Pengaturan TikTok Shop</Text>
          <Text style={s.hint}>Salin dari Partner Center, di halaman app ISV kamu.</Text>
          <Text style={s.label}>App Key</Text>
          <TextInput
            style={s.input}
            value={form.app_key}
            onChangeText={(v) => setForm((old) => ({ ...old, app_key: v }))}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.label}>App Secret</Text>
          <TextInput
            style={s.input}
            value={form.app_secret}
            onChangeText={(v) => setForm((old) => ({ ...old, app_secret: v }))}
            placeholder={tiktok.hasSecret ? 'Tersimpan. Isi hanya untuk mengganti.' : ''}
            placeholderTextColor={colors.faint}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={s.label}>Link Otorisasi</Text>
          <TextInput
            style={s.input}
            value={form.auth_url}
            onChangeText={(v) => setForm((old) => ({ ...old, auth_url: v }))}
            placeholder="https://..."
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[s.btn, { marginTop: spacing.md, alignSelf: 'flex-start' }]} onPress={saveSettings} disabled={busy}>
            <Text style={s.btnText}>Simpan</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={s.panel}>
        <Text style={s.panelTitle}>Tambah Toko</Text>
        <View style={s.row}>
          <TouchableOpacity style={[s.btn, { flexGrow: 1 }]} onPress={connect}>
            <Text style={s.btnText}>Hubungkan TikTok Shop</Text>
          </TouchableOpacity>
          <View style={[s.btn, s.btnDisabled, { flexGrow: 1 }]}>
            <Text style={s.btnDisabledText}>Shopee (belum tersedia)</Text>
          </View>
        </View>
        <Text style={s.hint}>
          Kalau seller menyetujui dari perangkatnya sendiri, tempel URL halaman setelah persetujuan di sini.
        </Text>
        <View style={s.row}>
          <TextInput
            style={[s.input, { flex: 1, minWidth: 200 }]}
            value={pasted}
            onChangeText={setPasted}
            placeholder="https://apps-pickhub.cloud/?app_key=...&code=..."
            placeholderTextColor={colors.faint}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={[s.btnGhost, !pasted.trim() && { opacity: 0.5 }]} onPress={connectPasted} disabled={busy || !pasted.trim()}>
            <Text style={s.btnGhostText}>{busy ? 'Memproses...' : 'Hubungkan'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.listHead}>
        <TextInput
          style={[s.input, { flex: 1, minWidth: 200 }]}
          placeholder="Cari nama / kode toko"
          placeholderTextColor={colors.faint}
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
        {canManage && (
          <TouchableOpacity style={[s.btnGhost, (checkingAll || !data.shops.length) && { opacity: 0.5 }]} onPress={checkAll} disabled={checkingAll || !data.shops.length}>
            <Text style={s.btnGhostText}>{checkingAll ? 'Mengecek...' : 'Cek Semua'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={s.chipRow}>
        {[{ key: 'semua', label: 'Semua' }, { key: 'perlu', label: 'Perlu dicek' }, ...PLATFORMS].map((p) => (
          <TouchableOpacity key={p.key} style={[s.chip, filter === p.key && s.chipActive]} onPress={() => setFilter(p.key)}>
            <Text style={filter === p.key ? s.chipTextActive : s.chipText}>{p.label} ({countOf(p.key)})</Text>
          </TouchableOpacity>
        ))}
      </View>

      {!shops.length && (
        <Text style={s.empty}>{data.shops.length ? 'Tidak ada toko yang cocok.' : 'Belum ada toko terhubung.'}</Text>
      )}
      {shops.map((sh) => {
        const level = healthLevel(sh);
        const st = levelStyle[level];
        return (
          <View key={`${sh.platform}-${sh.shop_id}`} style={[s.card, level === 'problem' && { borderColor: colors.dangerBorder }]}>
            <View style={{ flex: 1, minWidth: 180 }}>
              <Text style={s.name}>{sh.name}</Text>
              <Text style={s.meta}>
                {PLATFORMS.find((p) => p.key === sh.platform)?.label}
                {sh.region ? ` · ${sh.region}` : ''}{sh.code ? ` · ${sh.code}` : ''}
              </Text>
              <Text style={s.meta}>{sh.last_check_at ? `Dicek ${fmtTime(sh.last_check_at)}` : 'Belum pernah dicek'}</Text>
              {level !== 'ok' && !!sh.health_error && <Text style={s.errorText}>{sh.health_error}</Text>}
            </View>
            <View style={[s.badge, { backgroundColor: st.bg }]}>
              <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
            </View>
            <TouchableOpacity style={s.smallBtn} onPress={() => checkOne(sh)} disabled={!!checkingShop}>
              <Text style={s.smallBtnText}>{checkingShop === sh.shop_id ? 'Mengecek...' : 'Cek'}</Text>
            </TouchableOpacity>
            {canManage && (
              <TouchableOpacity
                style={[s.iconBtn, { backgroundColor: colors.dangerBg }]}
                onPress={() => remove(sh)}
                accessibilityLabel={`Putuskan ${sh.name}`}
              >
                <Icon name="x" size={13} color={colors.danger} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  headRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: spacing.md },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { color: colors.sub, fontSize: 13, marginTop: 3 },
  panel: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, padding: spacing.lg, marginBottom: spacing.md,
  },
  panelTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  hint: { fontSize: 12, color: colors.sub, marginVertical: spacing.sm },
  label: { fontSize: 11, fontWeight: '700', color: colors.sub, textTransform: 'uppercase', marginBottom: 4, marginTop: 10 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 11, fontSize: 14, color: colors.ink, backgroundColor: colors.bg,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  listHead: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm, marginBottom: spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill,
    paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { color: colors.sub, fontWeight: '600', fontSize: 12 },
  chipTextActive: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  empty: { textAlign: 'center', color: colors.sub, marginTop: 32, fontSize: 13 },
  card: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 12, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, marginBottom: 8, backgroundColor: colors.surface,
  },
  name: { fontSize: 14, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.sub, marginTop: 2 },
  errorText: { fontSize: 12, color: colors.dangerText, marginTop: 4 },
  badge: { borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  smallBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.surface },
  smallBtnText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  iconBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  btnText: { color: colors.onPrimary || '#fff', fontWeight: '700', fontSize: 13 },
  btnDisabled: { backgroundColor: colors.surfaceAlt },
  btnDisabledText: { color: colors.sub, fontWeight: '700', fontSize: 13 },
  btnGhost: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  btnGhostText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
});
