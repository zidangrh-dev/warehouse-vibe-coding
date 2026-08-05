import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Linking, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, {
  Rect, Circle, Path, Line as SvgLine, Defs, Stop, LinearGradient as SvgGradient,
} from 'react-native-svg';
import Icon from './Icon';
import { colors, radius, shadow, spacing, font, statusLabel, statusColor, statusTint } from './theme';

export function StatusPill({ status }) {
  const c = statusColor(status);
  return (
    <View style={[s.pill, { borderColor: c + '55', backgroundColor: c + '0F' }]}>
      <View style={[s.pillDot, { backgroundColor: c }]} />
      <Text style={[s.pillText, { color: c }]}>{statusLabel(status)}</Text>
    </View>
  );
}

// Format sel "LAST UPDATE": tampilkan tanggal & waktu update terakhir secara lengkap.
function fmtUpdate(pkg) {
  const dt = pkg.updated_at || pkg.created_at;
  if (!dt) return '—';
  const d = new Date(dt);
  return `${d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })} · ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

export function PackageRow({ pkg, onPress, action }) {
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(pkg)} activeOpacity={0.7}>
      <View style={s.cardTop}>
        <View style={[s.iconBox, { backgroundColor: statusTint(pkg.status) }]}>
          <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : 'box'} size={20} color={statusColor(pkg.status)} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.awb} numberOfLines={1}>
            {pkg.awb_no || pkg.invoice_no}
          </Text>
          <Text style={s.detail} numberOfLines={1}>
            {pkg.customer_name || '(tanpa nama)'}
            {(pkg.platform || pkg.item_desc) ? `  ·  🏬 ${pkg.platform || pkg.item_desc}` : ''}
            {pkg.courier ? `  ·  🛵 ${pkg.courier}` : ''}
          </Text>
        </View>
        {action}
      </View>
      <View style={s.cardBottom}>
        <StatusPill status={pkg.status} />
        <Text style={s.codeChip}>🔑 {pkg.pickup_code || '—'}</Text>
        <Text style={s.time}>{fmtUpdate(pkg)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Tabel padat untuk layar lebar (desktop web) — kontrak props sama dengan
// PackageRow supaya screens.js tinggal switch render mode.

// Didefinisikan di LEVEL MODUL (bukan di dalam render) agar tipe komponennya
// stabil. Komponen yang dibuat di dalam fungsi render akan remount tiap render,
// sehingga TextInput kehilangan fokus setiap kali diketik 1 huruf.
function FilterInputCell({ placeholder, widthFlex, value, onChange }) {
  const isActive = !!String(value || '').trim();
  return (
    <View style={{ flex: widthFlex, paddingRight: 4, position: 'relative', justifyContent: 'center' }}>
      <TextInput
        style={[
          s.colInput,
          isActive ? {
            backgroundColor: colors.surface,
            borderColor: colors.primary,
            color: colors.primary,
            fontWeight: '700',
            paddingRight: 18,
          } : null,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        value={value}
        onChangeText={onChange}
      />
      {isActive && (
        <TouchableOpacity
          style={{ position: 'absolute', right: 8, top: 4, padding: 2 }}
          onPress={() => onChange('')}
        >
          <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '800' }}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function PackageTable({ items, onPress, renderAction, onSearchQuery, onColumnFilterChange, tab }) {
  const [filters, setFilters] = useState({ invoice: '', customer: '', toko: '', courier: '', code: '', status: '', pickup_type: '' });
  const debounceRef = useRef(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  const debouncedNotify = useCallback((next) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onColumnFilterChange?.(next);
    }, 500);
  }, [onColumnFilterChange]);

  const setF = (k) => (v) => {
    const val = String(v || '');
    // Baca nilai terbaru dari ref (bukan closure render) agar nilai yang
    // di-debounce selalu lengkap walau beberapa ketikan berjalan cepat.
    const next = { ...filtersRef.current, [k]: val };
    setFilters(next);
    debouncedNotify(next);
  };

  const resetFilters = () => {
    const next = { invoice: '', customer: '', toko: '', courier: '', code: '', status: '', pickup_type: '' };
    setFilters(next);
    onColumnFilterChange?.(next);
    onSearchQuery?.('');
  };

  const hasActiveFilters = Object.values(filters).some((v) => (v || '').trim() !== '');
  const activeCount = Object.values(filters).filter((v) => (v || '').trim() !== '').length;

  const filteredItems = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((pkg) => {
      if (!pkg) return false;
      const invF = (filters.invoice || '').trim().toLowerCase();
      if (invF && !`${pkg.awb_no || ''} ${pkg.invoice_no || ''}`.toLowerCase().includes(invF)) return false;

      const custF = (filters.customer || '').trim().toLowerCase();
      if (custF && !`${pkg.customer_name || ''} ${pkg.customer_phone || ''}`.toLowerCase().includes(custF)) return false;

      const tokoF = (filters.toko || '').trim().toLowerCase();
      if (tokoF && !`${pkg.platform || ''} ${pkg.item_desc || ''}`.toLowerCase().includes(tokoF)) return false;

      const courF = (filters.courier || '').trim().toLowerCase();
      if (courF && !`${pkg.courier || ''}`.toLowerCase().includes(courF)) return false;

      const codeF = (filters.code || '').trim().toLowerCase();
      if (codeF && !`${pkg.pickup_code || ''}`.toLowerCase().includes(codeF)) return false;

      const typeF = (filters.pickup_type || '').trim().toLowerCase();
      if (typeF && (pkg.pickup_type || '').toLowerCase() !== typeF) return false;

      const statF = (filters.status || '').trim().toLowerCase();
      if (statF && !`${pkg.status || ''} ${statusLabel(pkg.status) || ''}`.toLowerCase().includes(statF)) return false;

      return true;
    });
  }, [items, filters]);

  const STATUS_COLOR = {
    data_masuk: '#475569',
    absen_ambil_customer: '#4338CA',
    absen_gojek: '#047857',
    mencari_driver: '#B45309',
    driver_sampai_kios: '#6D28D9',
    done_pickup: '#0E7490',
    selesai: '#15803D',
    retur: '#B91C1C',
    cancel: '#334155',
  };

  const currentStatusColor = STATUS_COLOR[filters.status] || colors.ink;

  const applyQuickFilter = (typeVal, statusVal) => {
    const next = {
      ...filters,
      pickup_type: typeVal,
      status: statusVal,
    };
    setFilters(next);
    onColumnFilterChange?.(next);
  };

  const allPresetChips = [
    { label: 'Semua', type: '', status: '' },
    { label: '🧍 Ambil Customer', type: 'customer', status: '', allowedTabs: ['semua', 'arsip', 'selfpickup'] },
    { label: '🛵 Gojek / Instant', type: 'gojek', status: '', allowedTabs: ['semua', 'arsip', 'gojek'] },
    { label: '✅ Selesai', type: '', status: 'selesai', allowedTabs: ['semua', 'arsip', 'selesai'] },
    { label: '↩️ Retur', type: '', status: 'retur', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
    { label: '❌ Cancel', type: '', status: 'cancel', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
  ];

  const presetChips = allPresetChips.filter((chip) => {
    if (!chip.allowedTabs || !tab) return true;
    return chip.allowedTabs.includes(tab);
  });

  return (
    <View style={s.table}>
      {/* Quick Interactive Filter Presets Bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap', gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: colors.sub, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            ⚡ Filter Cepat:
          </Text>
          {presetChips.map((chip) => {
            const isSelected = chip.type
              ? filters.pickup_type === chip.type
              : chip.status
              ? filters.status === chip.status
              : !filters.pickup_type && !filters.status;
            return (
              <TouchableOpacity
                key={chip.label}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: radius.pill,
                  backgroundColor: isSelected ? colors.primary : '#E2E8F0',
                }}
                onPress={() => applyQuickFilter(chip.type, chip.status)}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#FFFFFF' : colors.sub }}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasActiveFilters && (
          <TouchableOpacity
            style={{ backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}
            onPress={resetFilters}
          >
            <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '800' }}>
              ✕ Reset ({activeCount} Filter Aktif · {filteredItems.length}/{(items || []).length})
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Header Row */}
      <View style={s.tableHeadRow}>
        <Text style={[s.th, { width: 36 }]} />
        <Text style={[s.th, { flex: 1.2 }]}>AWB / Invoice</Text>
        <Text style={[s.th, { flex: 1.2 }]}>Customer</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Nama Toko</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Kurir</Text>
        <Text style={[s.th, { flex: 0.8 }]}>Pickup Code</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Status</Text>
        <Text style={[s.th, { flex: 0.9 }]}>LAST UPDATE</Text>
        <Text style={[s.th, { flex: 1.0, textAlign: 'right' }]}>Aksi</Text>
      </View>

      {/* Filter Row (Bersih & Elegan - Hanya Warna Teks yang Berubah per Nama/Status) */}
      <View style={[s.tableHeadRow, { backgroundColor: '#F8FAFC', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={{ width: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.sub }}>🔍</Text>
        </View>
        <FilterInputCell placeholder="Filter Invoice..." widthFlex={1.2} value={filters.invoice || ''} onChange={setF('invoice')} />
        <FilterInputCell placeholder="Filter Customer..." widthFlex={1.2} value={filters.customer || ''} onChange={setF('customer')} />
        <FilterInputCell placeholder="Filter Toko..." widthFlex={1.0} value={filters.toko || ''} onChange={setF('toko')} />
        <FilterInputCell placeholder="Filter Kurir..." widthFlex={1.0} value={filters.courier || ''} onChange={setF('courier')} />
        <FilterInputCell placeholder="Filter Code..." widthFlex={0.8} value={filters.code || ''} onChange={setF('code')} />

        {/* Dropdown Status: Latar Putih Bersih, Hanya Warna Teks Nama Status yang Berubah */}
        <View style={{ flex: 1.0, paddingRight: 4, position: 'relative' }}>
          {Platform.OS === 'web' ? (
            <select
              style={{
                backgroundColor: '#FFFFFF',
                border: filters.status ? `1.5px solid ${currentStatusColor}` : `1px solid ${colors.border}`,
                borderRadius: 6,
                padding: '4px 6px',
                fontSize: 11,
                color: currentStatusColor,
                outline: 'none',
                width: '100%',
                cursor: 'pointer',
                fontWeight: '700',
              }}
              value={filters.status}
              onChange={(e) => setF('status')(e.target.value)}
            >
              <option value="" style={{ color: colors.ink }}>▼ Filter Status...</option>
              <option value="data_masuk" style={{ color: '#475569' }}>Data Masuk</option>
              <option value="absen_ambil_customer" style={{ color: '#4338CA' }}>Absen Ambil Customer</option>
              <option value="absen_gojek" style={{ color: '#047857' }}>Absen Gojek</option>
              <option value="mencari_driver" style={{ color: '#B45309' }}>Mencari Driver</option>
              <option value="driver_sampai_kios" style={{ color: '#6D28D9' }}>Driver Sampai Kios</option>
              <option value="done_pickup" style={{ color: '#0E7490' }}>Done Pickup</option>
              <option value="selesai" style={{ color: '#15803D' }}>Selesai</option>
              <option value="retur" style={{ color: '#B91C1C' }}>Retur</option>
              <option value="cancel" style={{ color: '#334155' }}>Cancel</option>
            </select>
          ) : (
            <TextInput
              style={[s.colInput, filters.status ? { backgroundColor: '#FFFFFF', borderColor: '#3B82F6', color: currentStatusColor, fontWeight: '700' } : null]}
              placeholder="Filter Status..."
              value={filters.status}
              onChangeText={setF('status')}
            />
          )}
        </View>
        <View style={{ flex: 0.9 }} />
        <View style={{ flex: 1.0 }} />
      </View>

      {/* Table Rows */}
      {filteredItems.map((pkg) => (
        <TouchableOpacity key={pkg.id} style={s.tr} onPress={() => onPress(pkg)} activeOpacity={0.6}>
          <View style={[s.trIconBox, { backgroundColor: statusTint(pkg.status) }]}>
            <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : 'box'} size={16} color={statusColor(pkg.status)} />
          </View>
          <Text style={[s.td, { flex: 1.2, fontWeight: '700', fontFamily: font.mono }]} numberOfLines={1}>
            {pkg.awb_no || pkg.invoice_no}
          </Text>
          <Text style={[s.td, { flex: 1.2 }]} numberOfLines={1}>{pkg.customer_name || '(tanpa nama)'}</Text>
          <Text style={[s.td, { flex: 1.0, fontWeight: '600', color: colors.ink }]} numberOfLines={1}>
            {pkg.platform || pkg.item_desc || '—'}
          </Text>
          <Text style={[s.td, { flex: 1.0, color: colors.sub }]} numberOfLines={1}>
            {pkg.courier || '—'}
          </Text>
          <Text style={[s.td, { flex: 0.8, fontFamily: font.mono, fontWeight: '700', color: pkg.pickup_code ? colors.ink : colors.faint }]} numberOfLines={1}>
            {pkg.pickup_code || '—'}
          </Text>
          <View style={{ flex: 1.0 }}><StatusPill status={pkg.status} /></View>
          <Text style={[s.td, { flex: 0.9, color: colors.faint, fontSize: 12 }]} numberOfLines={1}>
            {fmtUpdate(pkg)}
          </Text>
          <View style={{ flex: 1.0, alignItems: 'flex-end' }}>
            {renderAction ? renderAction(pkg) : null}
          </View>
        </TouchableOpacity>
      ))}
      {filteredItems.length === 0 && (
        <Text style={s.tableEmpty}>
          {hasActiveFilters ? 'Tidak ada data yang cocok dengan filter kolom.' : 'Tidak ada data.'}
        </Text>
      )}
    </View>
  );
}

// ---- Primitif dashboard ----

export function StatCard({ label, value, sub, accent = colors.primary, icon, delta }) {
  return (
    <View style={s.statCard}>
      <View style={[s.statAccent, { backgroundColor: accent }]} />
      <View style={s.statHead}>
        {icon ? (
          <View style={[s.statIcon, { backgroundColor: accent + '18' }]}>
            <Icon name={icon} size={18} color={accent} />
          </View>
        ) : null}
        <Text style={s.statLabel} numberOfLines={2}>{label}</Text>
      </View>
      <Text style={s.statValue}>{value}</Text>
      <View style={s.statFoot}>
        {delta ? (
          <View style={[s.deltaPill, { backgroundColor: (delta.up ? colors.ok : colors.danger) + '18' }]}>
            <Text style={[s.deltaText, { color: delta.up ? colors.ok : colors.danger }]}>
              {delta.up ? '▲' : '▼'} {delta.text}
            </Text>
          </View>
        ) : null}
        {!!sub && <Text style={s.statSub} numberOfLines={1}>{sub}</Text>}
      </View>
    </View>
  );
}

export function SectionCard({ title, subtitle, right, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>{title}</Text>
          {!!subtitle && <Text style={s.sectionSub}>{subtitle}</Text>}
        </View>
        {right}
      </View>
      {children}
    </View>
  );
}

// Bar chart vertikal sederhana berbasis SVG — cukup untuk dataset kecil
// (jumlah status/hari/user), tanpa dependency chart tambahan.
export function SimpleBarChart({ data, height = 140, valueKey = 'value', labelKey = 'label', colorKey }) {
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const barW = data.length ? Math.max(18, Math.min(48, 280 / data.length)) : 24;
  const gap = 10;
  const width = data.length * (barW + gap) + gap;
  return (
    <View>
      <Svg width="100%" height={height + 24} viewBox={`0 0 ${width} ${height + 24}`}>
        {data.map((d, i) => {
          const h = (d[valueKey] / max) * height;
          const x = gap + i * (barW + gap);
          const color = colorKey ? d[colorKey] : colors.primary;
          return (
            <Rect key={i} x={x} y={height - h} width={barW} height={Math.max(2, h)} rx={4} fill={color} />
          );
        })}
      </Svg>
      <View style={s.barLabelsRow}>
        {data.map((d, i) => (
          <Text key={i} style={[s.barLabel, { width: barW + gap }]} numberOfLines={1}>
            {d[labelKey]}
          </Text>
        ))}
      </View>
    </View>
  );
}

// Area chart bergradien untuk deret waktu (throughput harian).
export function AreaChart({ data, height = 150, valueKey = 'value', color = colors.primary, gradId = 'areaFill' }) {
  const n = data.length;
  if (!n) return null;
  const W = 320;
  const padT = 10, padB = 6;
  const chartH = height - padT - padB;
  const max = Math.max(1, ...data.map((d) => d[valueKey]));
  const x = (i) => (n <= 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => padT + chartH - (v / max) * chartH;
  const pts = data.map((d, i) => [x(i), y(d[valueKey])]);
  const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'} ${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const area = `${line} L ${W} ${padT + chartH} L 0 ${padT + chartH} Z`;
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
      <Defs>
        <SvgGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.30" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      {[0, 0.5, 1].map((g, i) => (
        <SvgLine key={i} x1="0" y1={padT + chartH * g} x2={W} y2={padT + chartH * g}
          stroke={colors.border} strokeWidth="1" strokeDasharray="4 5" />
      ))}
      <Path d={area} fill={`url(#${gradId})`} />
      <Path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([px, py], i) => (
        <Circle key={i} cx={px} cy={py} r={i === n - 1 ? 3.5 : 2} fill={colors.surface} stroke={color} strokeWidth="2" />
      ))}
    </Svg>
  );
}

// Donut chart untuk proporsi status, dengan angka total di tengah.
export function SimpleDonutChart({ data, size = 140, valueKey = 'value', colorKey = 'color', centerLabel, centerSub }) {
  const total = Math.max(1, data.reduce((a, d) => a + d[valueKey], 0));
  const r = size / 2 - 8;
  const cx = size / 2;
  const cy = size / 2;
  let angle = -90;
  const segs = data.map((d) => {
    const frac = d[valueKey] / total;
    const start = angle;
    const sweep = frac * 360;
    angle += sweep;
    return { ...d, start, sweep };
  });
  const polar = (a) => {
    const rad = (Math.PI / 180) * a;
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
  };
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segs.map((seg, i) => {
          if (seg[valueKey] <= 0) return null;
          const [x1, y1] = polar(seg.start);
          const [x2, y2] = polar(seg.start + seg.sweep);
          const large = seg.sweep > 180 ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          return <Path key={i} d={d} fill={seg[colorKey]} />;
        })}
        <Circle cx={cx} cy={cy} r={r * 0.64} fill={colors.surface} />
      </Svg>
      {centerLabel != null && (
        <View style={s.donutCenter} pointerEvents="none">
          <Text style={s.donutValue}>{centerLabel}</Text>
          {!!centerSub && <Text style={s.donutSub}>{centerSub}</Text>}
        </View>
      )}
    </View>
  );
}

// Tampilkan pickup code sebagai QR + tombol kirim WhatsApp ke customer.
export function CodeModal({ pkg, onClose }) {
  if (!pkg) return null;
  const waText = encodeURIComponent(
    `Halo ${pkg.customer_name || ''}, paket ${pkg.invoice_no} sudah siap diambil di kios. ` +
    `Tunjukkan kode pickup ini ke admin: ${pkg.pickup_code}`
  );
  // Nomor dari marketplace sering disensor ("(+62)896******56") — jangan tampilkan
  // tombol WA untuk nomor sensor, hasil bersihannya akan jadi nomor orang lain.
  const masked = (pkg.customer_phone || '').includes('*');
  const phone = masked ? '' : (pkg.customer_phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>Pickup Code</Text>
          <Text style={s.sheetSub}>{pkg.invoice_no} · {pkg.customer_name}</Text>
          <View style={s.qrWrap}>
            <QRCode value={String(pkg.pickup_code)} size={170} />
          </View>
          <Text style={s.codeText}>{pkg.pickup_code}</Text>
          {!!phone && (
            <TouchableOpacity
              style={[s.btn, { backgroundColor: '#25D366' }]}
              onPress={() => Linking.openURL(`https://wa.me/${phone}?text=${waText}`)}
            >
              <Text style={s.btnText}>Kirim via WhatsApp</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose}>
            <Text style={[s.btnText, { color: colors.ink }]}>Tutup</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Setelah admin scan kode customer: isi nama pengambil lalu konfirmasi.
export function PickerNameModal({ visible, onSubmit, onClose }) {
  const [name, setName] = useState('');
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>Nama Pengambil</Text>
          <TextInput
            style={s.input}
            placeholder="Nama orang yang mengambil paket"
            placeholderTextColor={colors.faint}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.ok }]}
            onPress={() => { onSubmit(name.trim()); setName(''); }}
          >
            <Text style={s.btnText}>Konfirmasi Pengambilan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.btn, s.btnGhost]} onPress={onClose}>
            <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10, ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 40, height: 40, borderRadius: radius.input,
    alignItems: 'center', justifyContent: 'center',
  },
  awb: { fontWeight: '700', color: colors.ink, fontSize: 15, letterSpacing: 0.1, fontFamily: font.mono },
  detail: { color: colors.sub, fontSize: 13, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  time: { color: colors.faint, fontSize: 12, fontWeight: '600' },
  codeChip: { color: colors.sub, fontSize: 12, fontWeight: '700', fontFamily: font.mono },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
    borderRadius: radius.pill, paddingVertical: 4, paddingHorizontal: 9,
    alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontWeight: '700', fontSize: 12 },

  // Tabel desktop
  table: {
    backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  tableHeadRow: {
    flexDirection: 'row', backgroundColor: colors.surfaceAlt,
    paddingVertical: 10, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: 11, fontWeight: '700', color: colors.sub, textTransform: 'uppercase', letterSpacing: 0.4 },
  tr: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10,
  },
  trIconBox: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  td: { fontSize: 13, color: colors.ink },
  tableEmpty: { textAlign: 'center', color: colors.faint, padding: 24 },

  // Dashboard primitives
  statCard: {
    backgroundColor: colors.surface, borderRadius: radius.card,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    padding: 16, paddingTop: 18, minHeight: 118, ...shadow.card,
  },
  statAccent: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  statIcon: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  statLabel: { color: colors.sub, fontSize: 12.5, fontWeight: '600', flex: 1 },
  statValue: { color: colors.ink, fontSize: 28, fontWeight: '800', marginTop: 10, letterSpacing: -0.5 },
  statFoot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  statSub: { color: colors.faint, fontSize: 11.5, flexShrink: 1 },
  deltaPill: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  deltaText: { fontSize: 11, fontWeight: '800' },
  donutCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  donutValue: { fontSize: 22, fontWeight: '800', color: colors.ink, letterSpacing: -0.5 },
  donutSub: { fontSize: 10.5, color: colors.sub, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: {
    backgroundColor: colors.surface, borderRadius: radius.card, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, ...shadow.card,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.md },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  sectionSub: { fontSize: 12, color: colors.sub, marginTop: 2 },
  barLabelsRow: { flexDirection: 'row', marginTop: 4 },
  barLabel: { fontSize: 10, color: colors.faint, textAlign: 'center' },

  backdrop: {
    flex: 1, backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 22,
    borderWidth: 1, borderColor: colors.border,
    width: '100%', maxWidth: 380, ...shadow.float,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: 14,
  },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  sheetSub: { color: colors.sub, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  qrWrap: {
    alignSelf: 'center', padding: 14, borderRadius: 12, marginVertical: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  codeText: {
    fontSize: 26, fontWeight: '800', letterSpacing: 6, fontFamily: font.mono,
    textAlign: 'center', color: colors.ink, marginBottom: 12,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 13, fontSize: 15, marginVertical: 12, color: colors.ink,
    backgroundColor: colors.bg,
  },
  btn: {
    borderRadius: radius.pill, padding: 13, alignItems: 'center', marginTop: 8,
    backgroundColor: colors.primary,
  },
  btnGhost: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  colInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    color: colors.ink,
  },
});
