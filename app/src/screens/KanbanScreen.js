// Tab Kanban — papan semua status (ala Trello) TANPA mengubah proses/aksi yang
// sudah ada. Paket dikelompokkan per status; kartu:
//   • klik kartu        -> PackageModal (aksi & foto yang sama persis dgn tabel)
//   • aksi cepat inline -> tombol langkah berikutnya (sesuai NEXT_ACTIONS);
//                          status yang butuh input/foto dibuka lewat modal
//   • drag & drop (web) -> pindah antar kolom; hanya transisi valid yang
//                          diizinkan (server tetap memvalidasi foto/driver)
// Data diambil sekali dari endpoint list dengan kanban=1 (semua paket aktif).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api, getSocket } from '../api';
import {
  colors, radius, shadow, font, notice,
  statusLabel, statusColor, statusTint, NEXT_ACTIONS,
} from '../theme';
import { tokoLabel } from '../components';
import PackageModal from '../PackageModal';
import DriverInfoModal from '../DriverInfoModal';
import { useBreakpoint } from '../responsive';
import { s } from './styles';

// Urutan kolom = urutan pipeline, kolom terminal (selesai/cancel) di ujung.
// data_masuk TIDAK ditampilkan di kanban (paket diurus lewat tab Scan).
const COLUMNS = [
  'absen_ambil_customer',
  'absen_gojek',
  'mencari_driver',
  'data_driver_ready',
  'driver_sampai_kios',
  'done_pickup',
  'retur',
  'selesai',
  'cancel',
];

const TYPE_CHIPS = [
  { label: 'Semua', value: '' },
  { label: '🛵 Gojek', value: 'gojek' },
  { label: '🧍 Self Pickup', value: 'customer' },
];

const allowedTargets = (status) => (NEXT_ACTIONS[status] || []).map((a) => a.to);
// Transisi yang butuh input/foto di modal -> jangan PATCH langsung.
const modalTargets = new Set(['done_pickup', 'data_driver_ready']);

// Teks yang dicari pada kartu (satukan semua field, lowercase).
const searchable = (pkg) =>
  `${pkg.invoice_no || ''} ${pkg.awb_no || ''} ${pkg.driver_info || ''} ${tokoLabel(pkg)} ${pkg.pickup_code || ''} ${pkg.customer_name || ''}`.toLowerCase();

function fmtTime(dt) {
  if (!dt) return '—';
  const d = new Date(dt);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }) +
    ` ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function KanbanScreen({ user }) {
  const { isWeb } = useBreakpoint();
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [driverPkg, setDriverPkg] = useState(null);
  const dragging = useRef(null);
  // Slot drop antar kartu: { status, index } — index posisi kartu target.
  const [insert, setInsert] = useState(null);
  // Search per kolom: { [status]: kata kunci }.
  const [colSearch, setColSearch] = useState({});

  const load = useCallback(async () => {
    try {
      const res = await api.kanbanBoard(q, { pickup_type: typeFilter });
      setItems(res.items || []);
    } catch (e) {
      notice(`Gagal memuat papan: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [q, typeFilter]);

  useEffect(() => {
    load();
    const socket = getSocket();
    const onChanged = () => load();
    socket.on('packages:changed', onChanged);
    return () => socket.off('packages:changed', onChanged);
  }, [load]);

  const byStatus = useMemo(() => {
    const m = {};
    for (const p of items) (m[p.status] ||= []).push(p);
    return m;
  }, [items]);
  const total = items.length;
  const searching = !!(q.trim() || typeFilter);

  const moveTo = async (pkg, target) => {
    if (pkg.status === target) return;
    if (!allowedTargets(pkg.status).includes(target)) {
      notice(`Tidak bisa langsung pindah ke "${statusLabel(target)}".`);
      return;
    }
    if (modalTargets.has(target)) {
      if (target === 'data_driver_ready') setDriverPkg(pkg);
      else setOpenId(pkg.id);
      return;
    }
    try {
      await api.updatePackage(pkg.id, { status: target });
      load();
    } catch (e) {
      notice(e.message);
    }
  };

  const saveDriver = async (pkg, info, code) => {
    if (!String(info || '').trim()) return notice('Isi data driver dulu (nama / no HP).');
    try {
      await api.updatePackage(pkg.id, {
        status: 'data_driver_ready',
        driver_info: info.trim(),
        ...(String(code || '').trim() ? { pickup_code: String(code).trim() } : {}),
      });
      load();
    } catch (e) {
      notice(e.message);
    }
  };

  // Drop pada kolom (status) — validasi transisi primary tetap di moveTo().
  // `insert` hanya penanda visual; urutan akhir tetap hasil query updated_at.
  const handleDrop = (status) => {
    const pkg = dragging.current;
    dragging.current = null;
    setInsert(null);
    if (pkg && status) moveTo(pkg, status);
  };

  if (loading && !items.length) {
    return <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />;
  }

  return (
    <View style={s.screen}>
      <View style={s.topBar}>
        <TextInput
          style={[s.input, { flex: 1, marginBottom: 0 }]}
          placeholder="🔍 Cari invoice / nama / driver..."
          value={q}
          onChangeText={setQ}
        />
      </View>

      <View style={kb.chipRow}>
        {TYPE_CHIPS.map((c) => {
          const active = typeFilter === c.value;
          return (
            <TouchableOpacity
              key={c.value || 'all'}
              style={[kb.chip, active && kb.chipActive]}
              onPress={() => setTypeFilter(c.value)}
            >
              <Text style={[kb.chipText, active && kb.chipTextActive]}>{c.label}</Text>
            </TouchableOpacity>
          );
        })}
        <Text style={kb.chipCount}>
          {searching ? `Hasil ${total}` : `${total} paket aktif`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 4, alignItems: 'flex-start' }}
      >
        {COLUMNS.map((st) => (
          <KanbanColumn
            key={st}
            status={st}
            count={byStatus[st]?.length || 0}
            insert={insert}
            onInsert={setInsert}
            onDrop={() => handleDrop(st)}
            search={colSearch[st] || ''}
            onSearch={(v) => setColSearch((prev) => ({ ...prev, [st]: v }))}
            renderCard={(pkg, regNode) => (
              <KanbanCard
                key={pkg.id}
                pkg={pkg}
                isAdmin={isAdmin}
                isWeb={isWeb}
                regNode={regNode}
                onOpen={() => setOpenId(pkg.id)}
                onMove={(t) => moveTo(pkg, t)}
                onSaveDriver={(info, code) => saveDriver(pkg, info, code)}
                onDragStart={() => (dragging.current = pkg)}
                onDragEnd={() => (dragging.current = null)}
              />
            )}
            cards={byStatus[st] || []}
          />
        ))}
      </ScrollView>

      <PackageModal pkgId={openId} user={user} onClose={() => setOpenId(null)} onChanged={load} />
      <DriverInfoModal visible={!!driverPkg} pkg={driverPkg} onClose={() => setDriverPkg(null)} onSaved={load} />
    </View>
  );
}

// ---- Kolom papan ----
function KanbanColumn({ status, cards, insert, onInsert, onDrop, renderCard, search, onSearch }) {
  const colRef = useRef(null);
  const cardNodes = useRef([]);

  const isOver = insert?.status === status;
  const term = (search || '').trim().toLowerCase();
  // Filter kartu per kolom — search local (invoice/awb, driver, toko, pickup code, customer).
  const visible = term ? cards.filter((p) => searchable(p).includes(term)) : cards;

  useEffect(() => {
    if (Platform.OS !== 'web' || !colRef.current) return;
    const node = colRef.current;

    const onDragEnter = (e) => {
      e.preventDefault();
      onInsert({ status, index: -1 });
    };
    const onDragOver = (e) => {
      e.preventDefault();
      if (!e.dataTransfer.types.includes('text/plain')) return;
      // hitung slot: index kartu pertama yang bawahnya lebih dari posisi pointer
      let idx = cardNodes.current.length;
      for (let i = 0; i < cardNodes.current.length; i++) {
        const r = cardNodes.current[i]?.getBoundingClientRect?.();
        if (r && e.clientY < r.bottom) { idx = i; break; }
      }
      onInsert({ status, index: idx });
    };
    const onDragLeave = (e) => {
      // abaikan jika masih di dalam kolom (antar kartu)
      let cur = e.relatedTarget;
      while (cur && cur !== node && cur !== document.body) cur = cur.parentNode;
      if (cur === node) return;
      onInsert(null);
    };
    const onDropEv = (e) => {
      e.preventDefault();
      onDrop();
    };

    node.addEventListener('dragenter', onDragEnter);
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDropEv);
    return () => {
      node.removeEventListener('dragenter', onDragEnter);
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDropEv);
    };
  }, [status, onInsert, onDrop]);

  const slotColor = statusColor(status);

  return (
    <View
      ref={colRef}
      style={[kb.col, isOver && { borderColor: slotColor, backgroundColor: slotColor + '0D' }]}
    >
      <View style={[kb.colHead, { borderBottomColor: slotColor + '44' }]}>
        <View style={[kb.colDot, { backgroundColor: slotColor }]} />
        <Text style={[kb.colTitle, { color: slotColor }]} numberOfLines={1}>
          {statusLabel(status)}
        </Text>
        <View style={[kb.colBadge, { backgroundColor: slotColor + '18' }]}>
          <Text style={[kb.colBadgeText, { color: slotColor }]}>{visible.length}</Text>
        </View>
      </View>
      <View style={kb.colSearchBox}>
        <TextInput
          style={kb.colSearchInput}
          placeholder="🔍 cari invoice/driver/toko..."
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={onSearch}
        />
        {!!search && (
          <TouchableOpacity style={kb.colSearchClear} onPress={() => onSearch('')}>
            <Text style={kb.colSearchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <ScrollView contentContainerStyle={{ padding: 8, gap: 8 }} showsVerticalScrollIndicator={false}>
        {visible.length > 0 ? (
          visible.map((pkg, i) => (
            <View key={pkg.id}>
              {isOver && (
                <View style={[kb.slot, { borderColor: slotColor, backgroundColor: slotColor + '1A' }, insert?.index === i && kb.slotActive]} />
              )}
              {renderCard(pkg, (n) => (cardNodes.current[i] = n))}
            </View>
          ))
        ) : (
          <Text style={kb.emptyCol}>{term ? 'Tidak ada hasil' : '—'}</Text>
        )}
        {visible.length > 0 && isOver && (
          <View style={[kb.slot, { borderColor: slotColor, backgroundColor: slotColor + '1A' }, insert?.index === visible.length && kb.slotActive]} />
        )}
      </ScrollView>
    </View>
  );
}

// ---- Kartu papan (input inline sesuai status) ----
function KanbanCard({ pkg, isAdmin, isWeb, regNode, onOpen, onMove, onSaveDriver, onDragStart, onDragEnd }) {
  const [driverDraft, setDriverDraft] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  const ref = useRef(null);
  const setNode = (n) => { ref.current = n; regNode?.(n); };

  // web: jadikan kartu draggable (HTML5 DnD) hanya bila admin & ada transisi.
  const draggable = isWeb && isAdmin && allowedTargets(pkg.status).length > 0;
  useEffect(() => {
    if (!draggable || !ref.current) return;
    const node = ref.current;
    node.setAttribute('draggable', 'true');
    const start = (e) => {
      e.dataTransfer.setData('text/plain', String(pkg.id));
      e.dataTransfer.effectAllowed = 'move';
      onDragStart();
    };
    const end = () => onDragEnd();
    node.addEventListener('dragstart', start);
    node.addEventListener('dragend', end);
    return () => {
      node.setAttribute('draggable', 'false');
      node.removeEventListener('dragstart', start);
      node.removeEventListener('dragend', end);
    };
  }, [draggable, pkg.id, onDragStart, onDragEnd]);

  const actions = NEXT_ACTIONS[pkg.status] || [];
  const showsDriverInput = pkg.status === 'mencari_driver';

  return (
    <View ref={setNode} style={kb.card}>
      <TouchableOpacity onPress={onOpen} style={kb.cardBody} activeOpacity={0.7}>
        <View style={kb.cardTop}>
          <View style={[kb.boxIcon, { backgroundColor: statusTint(pkg.status) }]}>
            <Text style={{ fontSize: 12 }}>{pkg.pickup_type === 'gojek' ? '🛵' : '📦'}</Text>
          </View>
          <Text style={kb.awb} numberOfLines={1}>{pkg.awb_no || pkg.invoice_no}</Text>
          <Text style={kb.time} numberOfLines={1}>{fmtTime(pkg.updated_at)}</Text>
        </View>
        <Text style={kb.customer} numberOfLines={1}>{pkg.customer_name || '(tanpa nama)'}</Text>
        <Text style={kb.toko} numberOfLines={1}>{tokoLabel(pkg)}</Text>
        {!!pkg.pickup_code && (
          <Text style={kb.codeChip} numberOfLines={1}>🔑 {pkg.pickup_code}</Text>
        )}
        {!!pkg.driver_info && (
          <Text style={kb.driverChip} numberOfLines={1}>🛵 {pkg.driver_info}</Text>
        )}
      </TouchableOpacity>

      <View style={kb.actions}>
        {showsDriverInput && (
          <View style={kb.driverBox}>
            {!pkg.pickup_code && (
              <TextInput
                style={kb.codeInput}
                placeholder="Pickup code (jika belum ada)"
                placeholderTextColor={colors.faint}
                value={codeDraft}
                onChangeText={setCodeDraft}
                autoCapitalize="characters"
              />
            )}
            <TextInput
              style={kb.inlineInput}
              placeholder="Nama / No HP / dll"
              placeholderTextColor={colors.faint}
              value={driverDraft}
              onChangeText={setDriverDraft}
              multiline
            />
            <TouchableOpacity
              style={[kb.bigSave, { backgroundColor: statusColor('data_driver_ready') }]}
              onPress={() => onSaveDriver(driverDraft, codeDraft)}
              activeOpacity={0.85}
            >
              <Text style={kb.bigSaveText}>💾 Simpan Data Driver</Text>
            </TouchableOpacity>
          </View>
        )}

        {actions.map((a) =>
          showsDriverInput && a.to === 'data_driver_ready' ? null : (
            <ActionBtn
              key={a.to}
              label={a.label.replace(/^\S+\s/, '')}
              color={statusColor(a.to)}
              onPress={() => (isAdmin ? onMove(a.to) : onOpen())}
            />
          )
        )}
      </View>
    </View>
  );
}

function ActionBtn({ label, color, onPress }) {
  return (
    <TouchableOpacity
      style={[kb.miniBtn, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={kb.miniBtnText} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const kb = StyleSheet.create({
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingTop: 12, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.sub, fontWeight: '600', fontSize: 12.5 },
  chipTextActive: { color: '#fff', fontWeight: '700' },
  chipCount: { marginLeft: 'auto', color: colors.faint, fontWeight: '600', fontSize: 12 },

  col: {
    width: 280, backgroundColor: colors.surfaceAlt, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, margin: 6, maxHeight: '100%',
    ...shadow.card,
  },
  colHead: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  colDot: { width: 9, height: 9, borderRadius: 5 },
  colTitle: { fontWeight: '700', fontSize: 12.5, flex: 1 },
  colBadge: {
    minWidth: 22, paddingHorizontal: 6, borderRadius: radius.pill,
    alignItems: 'center', paddingVertical: 2,
  },
  colBadgeText: { fontWeight: '800', fontSize: 11 },
  colSearchBox: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingTop: 8,
  },
  colSearchInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.surface, paddingVertical: 5, paddingHorizontal: 8,
    fontSize: 11.5, color: colors.ink,
  },
  colSearchClear: {
    width: 22, height: 22, borderRadius: 11, marginLeft: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.border,
  },
  colSearchClearText: { color: colors.sub, fontWeight: '800', fontSize: 11 },
  emptyCol: { color: colors.faint, textAlign: 'center', fontSize: 12, paddingVertical: 10 },

  // Slot drop antar kartu (gaya Trello) — garis putus-putus tipis.
  slot: {
    height: 6, marginVertical: 3, borderRadius: 3, borderWidth: 1.5, borderStyle: 'dashed',
  },
  slotActive: { height: 12, borderWidth: 2 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden', ...shadow.card,
  },
  cardBody: { padding: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxIcon: { width: 22, height: 22, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  awb: { flex: 1, fontFamily: font.mono, fontWeight: '700', fontSize: 12, color: colors.ink },
  time: { color: colors.faint, fontSize: 10 },
  customer: { marginTop: 6, fontWeight: '700', fontSize: 12.5, color: colors.ink },
  toko: { color: colors.sub, fontSize: 11, marginTop: 2 },
  codeChip: { alignSelf: 'flex-start', marginTop: 6, backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10.5, fontWeight: '700', color: colors.primary },
  driverChip: { alignSelf: 'flex-start', marginTop: 4, fontSize: 10.5, fontWeight: '700', color: colors.primary },

  actions: { padding: 8, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 },
  driverBox: { gap: 6 },

  inlineInput: {
    flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.bg, padding: 8, fontSize: 13, color: colors.ink,
    minHeight: 38, textAlignVertical: 'center',
  },
  codeInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    backgroundColor: colors.bg, paddingVertical: 5, paddingHorizontal: 8,
    fontSize: 12, color: colors.ink, fontFamily: font.mono,
  },
  bigSave: {
    borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  bigSaveText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  miniBtn: {
    borderRadius: radius.pill, paddingVertical: 6, paddingHorizontal: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  miniBtnText: { color: '#fff', fontWeight: '700', fontSize: 11 },
});