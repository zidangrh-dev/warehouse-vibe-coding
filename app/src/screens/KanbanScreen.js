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
  View, Text, TextInput, ScrollView, TouchableOpacity, Modal,
  Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { api, getSocket } from '../api';
import {
  colors, radius, shadow, font, notice, confirmAsync,
  statusLabel, statusColor, statusTint, NEXT_ACTIONS,
} from '../theme';
import { tokoLabel } from '../components';
import { fmtTime } from '../utils/format';
import Icon from '../Icon';
import PackageModal from '../PackageModal';
import { ArchiveModal } from '../ArchiveModal';
import { CalendarInput } from '../CalendarInput';
import { useBreakpoint } from '../responsive';
import { useDebouncedValue } from '../hooks/usePackages';
import { s } from './styles';

// Urutan kolom = urutan pipeline, kolom terminal (selesai/cancel) di ujung.
// data_masuk TIDAK ditampilkan di kanban (paket diurus lewat tab Scan).
const COLUMNS = [
  'absen_ambil_customer',
  'absen_gojek',
  'mencari_driver',
  'driver_sampai_kios',
  'selesai',
  'retur',
  'cancel',
  'dikirim_ke_gudang',
  'diterima_gudang',
];

const TYPE_CHIPS = [
  { label: 'Semua', value: '' },
  { label: 'Gojek', icon: 'scooter', value: 'gojek' },
  { label: 'Self Pickup', icon: 'user', value: 'customer' },
  { label: 'Anteran', icon: 'box', value: 'anteran' },
];

const allowedTargets = (status) => {
  const targets = (NEXT_ACTIONS[status] || []).map((a) => a.to);
  // Kanban: geser bolak-balik mencari_driver <-> driver_sampai_kios.
  if (status === 'driver_sampai_kios' && !targets.includes('mencari_driver')) {
    targets.push('mencari_driver');
  }
  return targets;
};
// Transisi yang butuh input/foto/konfirmasi di modal -> jangan PATCH langsung.
const modalTargets = new Set(['selesai', 'retur', 'cancel']);

// Teks yang dicari pada kartu (satukan semua field, lowercase).
const searchable = (pkg) =>
  `${pkg.invoice_no || ''} ${pkg.awb_no || ''} ${pkg.driver_info || ''} ${tokoLabel(pkg)} ${pkg.pickup_code || ''} ${pkg.customer_name || ''}`.toLowerCase();

// "2026-08-07" -> "07/08/2026" (konvensi Indonesia). Aman walau string ISO aneh.
function fmtDate(d) {
  if (!d) return '';
  const s = String(d).slice(0, 10);
  const [y, m, dd] = s.split('-');
  return y && m && dd ? `${dd}/${m}/${y}` : s;
}

// Cache antar-sesi modul (stale-while-revalidate): kembali ke tab Kanban langsung
// tampil data lama dulu, lalu di-refresh di belakang — tab terasa instan.
const kanbanCache = { key: '', items: null };

export default function KanbanScreen({ user }) {
  const { isWeb } = useBreakpoint();
  const isAdmin = user.role === 'admin' || user.role === 'superadmin';
  const isWarehouse = user.role === 'warehouse';
  const isSuperadmin = user.role === 'superadmin';

  const canShip = isAdmin || isSuperadmin;       // Admin Kios & Super Admin
  const canReceive = isWarehouse || isSuperadmin; // Warehouse & Super Admin
  const [q, setQ] = useState('');
  const debouncedQ = useDebouncedValue(q, 400);
  const [typeFilter, setTypeFilter] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const dragging = useRef(null);
  // Slot drop antar kartu: { status, index } — index posisi kartu target.
  const [insert, setInsert] = useState(null);
  // Search per kolom: { [status]: kata kunci }.
  const [colSearch, setColSearch] = useState({});
  // Navigasi tanggal: null = papan aktif; tanggal = kanban snapshot hari tsb.
  const [selectedDate, setSelectedDate] = useState(null);
  const [archiveGroups, setArchiveGroups] = useState([]);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveListOpen, setArchiveListOpen] = useState(false);
  const [customDate, setCustomDate] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const res = await api.archiveSummary();
      setArchiveGroups(res.items || []);
    } catch (e) {
      // gagal ambil ringkasan — chips tanggal diabaikan, bukan fatal.
    }
  }, []);

  const restoreByDate = async (date) => {
    if (!(await confirmAsync('Pulihkan arsip?', `Yakin ingin mengembalikan semua paket arsip tanggal ${fmtDate(date)} ke kanban?`))) return;
    try {
      const res = await api.restoreArchiveByDate(date);
      notice(`Berhasil memulihkan ${res.count} paket tanggal ${fmtDate(date)} ke kanban!`);
      if (selectedDate === date) setSelectedDate(null);
      loadSummary();
      load();
    } catch (e) {
      notice(`Gagal memulihkan: ${e.message}`);
    }
  };

  const load = useCallback(async () => {
    const cacheKey = `${debouncedQ}|${typeFilter}|${selectedDate || ''}`;
    // Stale-while-revalidate: tampilkan data cache yang masih sesuai dulu.
    if (kanbanCache.key === cacheKey && kanbanCache.items?.length) {
      setItems(kanbanCache.items);
    }
    try {
      const res = await api.kanbanBoard(debouncedQ, {
        pickup_type: typeFilter,
        ...(selectedDate ? { date: selectedDate } : {}),
      });
      kanbanCache.key = cacheKey;
      kanbanCache.items = res.items || [];
      setItems(kanbanCache.items);
    } catch (e) {
      notice(`Gagal memuat papan: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, typeFilter, selectedDate]);

  useEffect(() => {
    load();
    loadSummary();
    const socket = getSocket();
    // Koalesce burst event socket: banyak perubahan cepat -> cukup satu refetch.
    const reloadTimerRef = { current: null };
    const onChanged = () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = setTimeout(() => load(), 400);
    };
    socket.on('packages:changed', onChanged);
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
      socket.off('packages:changed', onChanged);
    };
  }, [load, loadSummary]);

  const byStatus = useMemo(() => {
    const m = {};
    for (const p of items) (m[p.status] ||= []).push(p);
    return m;
  }, [items]);
  const total = items.length;
  const searching = !!(q.trim() || typeFilter);

  const moveTo = async (pkg, target, extraData) => {
    if (pkg.status === target && !extraData) return;
    if (!allowedTargets(pkg.status).includes(target)) {
      notice(`Tidak bisa langsung pindah ke "${statusLabel(target)}".`);
      return;
    }
    if (target === 'dikirim_ke_gudang' && !canShip) {
      notice('Hanya Admin Kios yang berhak menyerahkan barang ke Kurir.');
      return;
    }
    if (target === 'diterima_gudang' && !canReceive) {
      notice('Hanya Tim Warehouse yang berhak menerima barang di Gudang Utama.');
      return;
    }
    if (modalTargets.has(target)) {
      setOpenId(pkg.id);
      return;
    }
    try {
      await api.updatePackage(pkg.id, { status: target, ...(extraData || {}), baseUpdatedAt: pkg.updated_at });
      load();
    } catch (e) {
      if (e && e.status === 409) {
        notice("Data diubah pengguna lain — memuat ulang...");
        load();
      } else {
        notice(e.message);
      }
    }
  };

  const saveDriver = async (pkg, info, code) => {
    try {
      await api.updatePackage(pkg.id, {
        status: 'driver_sampai_kios',
        driver_info: info.trim(),
        ...(String(code || '').trim() ? { pickup_code: String(code).trim() } : {}),
        baseUpdatedAt: pkg.updated_at,
      });
      load();
    } catch (e) {
      if (e && e.status === 409) {
        notice("Data diubah pengguna lain — memuat ulang...");
        load();
      } else {
        notice(e.message);
      }
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
          placeholder="Cari invoice / nama / driver..."
          value={q}
          onChangeText={setQ}
        />
        <TouchableOpacity
          style={[s.bigBtn, { backgroundColor: colors.primary }]}
          onPress={() => setArchiveListOpen(true)}
        >
          <Text style={s.btnText}>Arsip</Text>
        </TouchableOpacity>
      </View>

      {/* Banner saat melihat kanban tanggal lama */}
      {selectedDate && (
        <View style={kb.banner}>
          <Text style={kb.bannerText}>
            Menampilkan kanban {fmtDate(selectedDate)} — {total} paket
          </Text>
          <TouchableOpacity style={kb.bannerBtn} onPress={() => setSelectedDate(null)}>
            <Text style={kb.bannerBtnText}>← Kembali ke Aktif</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={kb.chipRow}>
        {TYPE_CHIPS.map((c) => {
          const active = typeFilter === c.value;
          return (
            <TouchableOpacity
              key={c.value || 'all'}
              style={[kb.chip, active && kb.chipActive]}
              onPress={() => setTypeFilter(c.value)}
            >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              {c.icon && <Icon name={c.icon} size={12} color={active ? '#fff' : colors.sub} strokeWidth={2} />}
              <Text style={[kb.chipText, active && kb.chipTextActive]}>{c.label}</Text>
            </View>
            </TouchableOpacity>
          );
        })}
        <Text style={kb.chipCount}>
          {searching ? `Hasil ${total}` : selectedDate ? `${total} paket` : `${total} paket aktif`}
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
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
                canShip={canShip}
                canReceive={canReceive}
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
      <ArchiveListModal
        visible={archiveListOpen}
        groups={archiveGroups}
        customDate={customDate}
        onCustomDate={setCustomDate}
        onPick={(date) => { setSelectedDate(date); setArchiveListOpen(false); }}
        onArchive={() => { setArchiveListOpen(false); setArchiveModalOpen(true); }}
        canRestore={isSuperadmin}
        onRestore={restoreByDate}
        onClose={() => setArchiveListOpen(false)}
      />
      <ArchiveModal
        visible={archiveModalOpen}
        onClose={() => setArchiveModalOpen(false)}
        onArchived={() => { load(); loadSummary(); }}
      />
    </View>
  );
}

// ---- Popup daftar arsip per tanggal (ala menu Arsip Trello) ----
function ArchiveListModal({ visible, groups, customDate, onCustomDate, onPick, onArchive, canRestore, onRestore, onClose }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={kb.modalBackdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={kb.modalSheet} activeOpacity={1} onPress={(e) => e?.stopPropagation?.()}>
          <View style={kb.modalHead}>
            <Text style={kb.modalTitle}>Arsip</Text>
            <TouchableOpacity style={kb.modalClose} onPress={onClose}>
              <Icon name="x" size={18} color={colors.sub} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={kb.archiveBtn} onPress={onArchive}>
            <Text style={kb.archiveBtnText}>Arsipkan Tanggal…</Text>
          </TouchableOpacity>

          <View style={kb.customRow}>
            <CalendarInput value={customDate} onChange={onCustomDate} />
            <TouchableOpacity
              style={[kb.openBtn, { paddingVertical: 7, paddingHorizontal: 12 }]}
              onPress={() => { if (customDate) onPick(customDate); }}
            >
              <Text style={[kb.openBtnText, { fontSize: 11.5 }]}>Buka</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator>
            {groups.length === 0 ? (
              <Text style={kb.emptyCol}>Belum ada paket yang diarsip.</Text>
            ) : (
              groups.map((g) => (
                <View key={g.date} style={kb.archiveRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={kb.archiveDate}>{fmtDate(g.date)}</Text>
                    <Text style={kb.archiveCount}>{g.count} paket diarsip</Text>
                  </View>
                  {canRestore && (
                    <TouchableOpacity
                      style={kb.restoreBtn}
                      accessibilityLabel={`Pulihkan arsip ${fmtDate(g.date)}`}
                      onPress={() => onRestore(g.date)}
                    >
                      <Icon name="rotate" size={14} color="#fff" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={kb.openBtn} onPress={() => onPick(g.date)}>
                    <Text style={kb.openBtnText}>Buka</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
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
          placeholder="cari invoice/driver/toko..."
          placeholderTextColor={colors.faint}
          value={search}
          onChangeText={onSearch}
        />
        {!!search && (
          <TouchableOpacity style={kb.colSearchClear} onPress={() => onSearch('')}>
            <Text style={kb.colSearchClearText}>
              <Icon name="x" size={11} color={colors.sub} strokeWidth={3} />
            </Text>
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
function KanbanCard({ pkg, isAdmin, canShip, canReceive, isWeb, regNode, onOpen, onMove, onSaveDriver, onDragStart, onDragEnd }) {
  const [driverDraft, setDriverDraft] = useState('');
  const [codeDraft, setCodeDraft] = useState('');
  const ref = useRef(null);
  const setNode = (n) => { ref.current = n; regNode?.(n); };

  const canOperate = isAdmin || canShip || canReceive;
  // web: jadikan kartu draggable (HTML5 DnD) jika berhak beroperasi & ada transisi.
  const draggable = isWeb && canOperate && allowedTargets(pkg.status).length > 0;
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
  const canShiftBack = pkg.status === 'driver_sampai_kios';

  return (
    <View ref={setNode} style={kb.card}>
      <TouchableOpacity onPress={onOpen} style={kb.cardBody} activeOpacity={0.7}>
        <View style={kb.cardTop}>
          <View style={[kb.boxIcon, { backgroundColor: statusTint(pkg.status) }]}>
            <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : 'box'} size={12} color={statusColor(pkg.status)} strokeWidth={2} />
          </View>
          <Text style={kb.awb} numberOfLines={1}>{pkg.awb_no || pkg.invoice_no}</Text>
          <Text style={kb.time} numberOfLines={1}>{fmtTime(pkg.updated_at)}</Text>
        </View>
        <Text style={kb.customer} numberOfLines={1}>{pkg.customer_name || '(tanpa nama)'}</Text>
        <Text style={kb.toko} numberOfLines={1}>{tokoLabel(pkg)}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {!!pkg.pickup_code && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="key" size={10} color={colors.primary} strokeWidth={2} />
              <Text style={kb.codeChip} numberOfLines={1}>{pkg.pickup_code}</Text>
            </View>
          )}
          {!!pkg.driver_refreshed && (
            <View style={kb.refreshBadge}>
              <Text style={kb.refreshBadgeText}>REFRESH</Text>
            </View>
          )}
          {!!pkg.is_hold && (
            <View style={kb.holdBadge}>
              <Text style={kb.holdBadgeText}>HOLD</Text>
            </View>
          )}
          {!!pkg.is_cari_driver && (
            <View style={kb.cariBadge}>
              <Text style={kb.cariBadgeText}>CARI DRIVER</Text>
            </View>
          )}
          {!!pkg.done_by && (
            <View style={kb.nameTag}>
              <Text style={kb.nameTagText} numberOfLines={1}>{pkg.done_by}</Text>
            </View>
          )}
        </View>
        {!!pkg.driver_info && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 }}>
            <Icon name="scooter" size={10} color={colors.primary} strokeWidth={2} />
            <Text style={kb.driverChip} numberOfLines={1}>{pkg.driver_info}</Text>
          </View>
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
              style={[kb.bigSave, { backgroundColor: statusColor('driver_sampai_kios') }]}
              onPress={() => onSaveDriver(driverDraft, codeDraft)}
              activeOpacity={0.85}
            >
              <Text style={kb.bigSaveText}>Simpan Data</Text>
            </TouchableOpacity>
          </View>
        )}

        {canShiftBack && (
          <TouchableOpacity
            style={[kb.miniBtn, { backgroundColor: statusColor('mencari_driver') }]}
            onPress={() => onMove('mencari_driver')}
            activeOpacity={0.85}
          >
            <Text style={kb.miniBtnText} numberOfLines={1}>Kembali ke Mencari Driver</Text>
          </TouchableOpacity>
        )}

        {actions.map((a) => {
          // Di kartu mencari driver, pindah ke driver_sampai_kios cukup lewat
          // tombol "Simpan Data" (biar data driver & pickup code pasti tersimpan).
          if (showsDriverInput && a.to === 'driver_sampai_kios') return null;
          const allowed = a.to === 'dikirim_ke_gudang' ? canShip : a.to === 'diterima_gudang' ? canReceive : isAdmin;
          if (!allowed) return null;
          return (
            <ActionBtn
              key={a.to}
              label={a.label.replace(/^\S+\s/, '')}
              color={statusColor(a.to)}
              onPress={() => {
                const extra = {};
                if (showsDriverInput && driverDraft.trim()) {
                  extra.driver_info = driverDraft.trim();
                }
                if (showsDriverInput && codeDraft.trim()) {
                  extra.pickup_code = codeDraft.trim();
                }
                onMove(a.to, Object.keys(extra).length > 0 ? extra : undefined);
              }}
            />
          );
        })}
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

  // Popup daftar arsip per tanggal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalSheet: {
    width: '100%', maxWidth: 420, backgroundColor: colors.surface,
    borderRadius: radius.sheet, padding: 16, borderWidth: 1, borderColor: colors.border,
    ...shadow.float,
  },
  modalHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.ink },
  modalClose: { padding: 6 },
  archiveBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 9, alignItems: 'center', justifyContent: 'center',
  },
  archiveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 8 },
  archiveRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.card, paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8,
  },
  archiveDate: { fontWeight: '800', color: colors.ink, fontSize: 12.5, fontFamily: font.mono },
  archiveCount: { color: colors.faint, fontSize: 10.5, marginTop: 1 },
  restoreBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center',
  },
  openBtn: {
    backgroundColor: '#10B981', borderRadius: radius.pill,
    paddingVertical: 4, paddingHorizontal: 9,
  },
  openBtnText: { color: '#fff', fontWeight: '800', fontSize: 10.5 },

  banner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 8, marginHorizontal: 14, marginTop: 10,
    backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0',
    borderRadius: radius.card, paddingVertical: 8, paddingHorizontal: 12,
  },
  bannerText: { color: '#065F46', fontWeight: '700', fontSize: 12 },
  bannerBtn: {
    backgroundColor: '#10B981', borderRadius: radius.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },

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
  codeChip: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, fontSize: 10.5, fontWeight: '700', color: colors.primary },
  refreshBadge: { alignSelf: 'flex-start', backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  refreshBadgeText: { color: colors.danger, fontSize: 9.5, fontWeight: '800' },
  holdBadge: { alignSelf: 'flex-start', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  holdBadgeText: { color: '#B45309', fontSize: 9.5, fontWeight: '800' },
  cariBadge: { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2 },
  cariBadgeText: { color: '#1D4ED8', fontSize: 9.5, fontWeight: '800' },
  nameTag: { alignSelf: 'flex-start', backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: radius.pill, paddingHorizontal: 7, paddingVertical: 2, maxWidth: 130 },
  nameTagText: { color: colors.primary, fontSize: 9.5, fontWeight: '800' },
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