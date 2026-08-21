import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Linking, Platform, ActivityIndicator, ScrollView, Pressable,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, {
  Rect, Circle, Path, Line as SvgLine, Defs, Stop, LinearGradient as SvgGradient,
} from 'react-native-svg';
import Icon from './Icon';
import { colors, radius, shadow, spacing, font, notice, confirmAsync, STATUS_META, statusLabel, statusColor, statusTint } from './theme';
import { api } from './api';
import { fmtUpdate } from './utils/format';

// Helper: inline icon + text
const IL = ({ icon, text, color, size = 13 }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Icon name={icon} size={size} color={color || colors.sub} strokeWidth={2} />
    <Text style={{ color: color || colors.sub, fontSize: size, fontWeight: '600' }}>{text}</Text>
  </View>
);

export function StatusPill({ status }) {
  const c = statusColor(status);
  return (
    <View style={[s.pill, { borderColor: c + '55', backgroundColor: c + '0F' }]}>
      <View style={[s.pillDot, { backgroundColor: c }]} />
      <Text style={[s.pillText, { color: c }]}>{statusLabel(status)}</Text>
    </View>
  );
}

// Nama toko: gabungkan marketplace (Commerce Platform) + nama toko yang
// diparsing dari kolom Title/item. Title berformat "MARKETPLACE - NAMA TOKO"
// (mis. "Tiktok - Digitech Mall" => toko "Digitech Mall").
export function tokoLabel(pkg) {
  if (pkg.seller_name) return pkg.seller_name;
  const p = (pkg.platform || '').trim();
  const t = (pkg.item_desc || '').trim();
  if (!t) return p || '—';
  const idx = t.indexOf(' - ');
  if (idx >= 0) {
    const prefix = t.slice(0, idx).trim();
    const store = t.slice(idx + 3).trim();
    return [p || prefix, store].filter(Boolean).join(' ');
  }
  return p ? `${p} ${t}`.trim() : t;
}

// Pill tag NAMA — penanda siapa yang memproses done pickup (display-only,
// persis seperti badge REFRESH; pengaturan nama dilakukan di PackageModal).
function NameTag({ pkg }) {
  if (!pkg.done_by) return null;
  return (
    <View style={s.nameTag}>
      <Icon name="user_check" size={9} color={colors.primary} strokeWidth={2.5} />
      <Text style={[s.nameTagText, { color: colors.primary }]} numberOfLines={1}>
        {pkg.done_by}
      </Text>
    </View>
  );
}

export function PackageRow({ pkg, onPress, action, selected, onToggleSelect }) {
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(pkg)} activeOpacity={0.7}>
      <View style={s.cardTop}>
        <View style={s.iconBox}>
          {onToggleSelect ? (
            <TouchableOpacity
              style={[s.selectBox, selected && s.selectBoxActive]}
              onPress={(e) => { e.stopPropagation?.(); onToggleSelect(pkg.id); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {selected && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
            </TouchableOpacity>
          ) : (
            <>
              <View style={[StyleSheet.absoluteFill, { backgroundColor: statusTint(pkg.status), borderRadius: radius.input }]} />
              <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : pkg.pickup_type === 'anteran' ? 'box' : 'box'} size={20} color={statusColor(pkg.status)} />
            </>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.awb} numberOfLines={1}>
            {pkg.awb_no || pkg.invoice_no}
          </Text>
          <Text style={s.detail} numberOfLines={1}>
            {pkg.customer_name || '(tanpa nama)'}
            {tokoLabel(pkg) !== '—' ? `  ·  ${tokoLabel(pkg)}` : ''}
            {pkg.courier ? `  ·  ${pkg.courier}` : ''}
          </Text>
        </View>
        {action}
      </View>
      <View style={s.cardBottom}>
        <StatusPill status={pkg.status} />
        <Text style={s.time}>{fmtUpdate(pkg)}</Text>
      </View>
      <View style={s.cardRowMeta}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="key" size={11} color={colors.sub} strokeWidth={2} />
          <Text style={s.codeChip} numberOfLines={1}>{pkg.pickup_code || '—'}</Text>
        </View>
        {pkg.pickup_type === 'anteran' && (
          <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="box" size={9} color="#92400E" strokeWidth={2.5} />
            <Text style={{ color: '#92400E', fontSize: 9.5, fontWeight: '800' }}>ANTERAN</Text>
          </View>
        )}
        {pkg.pickup_type === 'buyback' && (
          <View style={{ backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#C4B5FD', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="box" size={9} color="#6D28D9" strokeWidth={2.5} />
            <Text style={{ color: '#6D28D9', fontSize: 9.5, fontWeight: '800' }}>BUYBACK</Text>
          </View>
        )}
        {!!pkg.driver_refreshed && (
          <View style={s.refreshBadge}>
            <Text style={s.refreshBadgeText}>REFRESH</Text>
          </View>
        )}
        {!!pkg.is_hold && (
          <View style={s.holdBadge}>
            <Text style={s.holdBadgeText}>HOLD</Text>
          </View>
        )}
        {!!pkg.is_cari_driver && (
          <View style={s.cariBadge}>
            <Text style={s.cariBadgeText}>CARI DRIVER</Text>
          </View>
        )}
        <NameTag pkg={pkg} />
        {!!pkg.driver_info && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Icon name="scooter" size={11} color={colors.primary} strokeWidth={2} />
            <Text style={s.driverChip} numberOfLines={1}>{pkg.driver_info}</Text>
          </View>
        )}
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

export function PackageTable({ items, onPress, renderAction, onSearchQuery, onColumnFilterChange, tab, selectedIds, onToggleSelect, onSelectAll }) {
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
      if (tokoF && !tokoLabel(pkg).toLowerCase().includes(tokoF)) return false;

      const courF = (filters.courier || '').trim().toLowerCase();
      if (courF && !`${pkg.courier || ''}`.toLowerCase().includes(courF)) return false;

      const codeF = (filters.code || '').trim().toLowerCase();
      if (codeF && !`${pkg.pickup_code || ''} ${pkg.driver_info || ''}`.toLowerCase().includes(codeF)) return false;

      const typeF = (filters.pickup_type || '').trim().toLowerCase();
      if (typeF && (pkg.pickup_type || '').toLowerCase() !== typeF) return false;

      const statF = (filters.status || '').trim().toLowerCase();
      if (statF && !`${pkg.status || ''} ${statusLabel(pkg.status) || ''}`.toLowerCase().includes(statF)) return false;

      return true;
    });
  }, [items, filters]);

  const currentStatusColor = statusColor(filters.status) || colors.ink;

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
    { label: 'Ambil Customer', icon: 'user', type: 'customer', status: '', allowedTabs: ['semua', 'arsip', 'selfpickup', 'scan'] },
    { label: 'Gojek / Instant', icon: 'scooter', type: 'gojek', status: '', allowedTabs: ['semua', 'arsip', 'gojek', 'scan'] },
    { label: 'Anteran Internal', icon: 'box', type: 'anteran', status: '', allowedTabs: ['semua', 'arsip', 'scan'] },
    { label: 'Selesai', icon: 'check', type: '', status: 'selesai', allowedTabs: ['semua', 'arsip', 'selesai'] },
    { label: 'Retur', icon: 'rotate', type: '', status: 'retur', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
    { label: 'Cancel', icon: 'x_circle', type: '', status: 'cancel', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
    { label: 'Dikirim ke Gudang', icon: 'truck', type: '', status: 'dikirim_ke_gudang', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
    { label: 'Diterima Gudang', icon: 'arrow_down', type: '', status: 'diterima_gudang', allowedTabs: ['semua', 'arsip', 'cancelretur'] },
    { label: 'Absen Gojek', type: '', status: 'absen_gojek', allowedTabs: ['gojek'] },
    { label: 'Mencari Driver', type: '', status: 'mencari_driver', allowedTabs: ['gojek'] },
    { label: 'Driver Sampai Kios', type: '', status: 'driver_sampai_kios', allowedTabs: ['gojek'] },
    { label: 'Selesai', type: '', status: 'selesai', allowedTabs: ['gojek'] },
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
                    Filter Cepat:
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  {chip.icon && <Icon name={chip.icon} size={10} color={isSelected ? '#FFFFFF' : colors.sub} strokeWidth={2.5} />}
                  <Text style={{ fontSize: 11, fontWeight: '700', color: isSelected ? '#FFFFFF' : colors.sub }}>
                    {chip.label}
                  </Text>
                </View>
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
        {onToggleSelect ? (
          <TouchableOpacity
            style={[s.selectBox, { marginRight: 8 }, (selectedIds && selectedIds.size === filteredItems.length && filteredItems.length > 0) && s.selectBoxActive]}
            onPress={onSelectAll}
          >
            {(selectedIds && selectedIds.size === filteredItems.length && filteredItems.length > 0) && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
          </TouchableOpacity>
        ) : (
          <View style={{ width: 22 }} />
        )}
        <Text style={[s.th, { flex: 1.2 }]}>AWB / Invoice</Text>
        <Text style={[s.th, { flex: 1.2 }]}>Customer</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Nama Toko</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Kurir</Text>
        <Text style={[s.th, { flex: 0.9 }]}>Pickup Code</Text>
        <Text style={[s.th, { flex: 1.0 }]}>Status</Text>
        <Text style={[s.th, { flex: 0.9 }]}>LAST UPDATE</Text>
        <Text style={[s.th, { flex: 1.0, textAlign: 'right' }]}>Aksi</Text>
      </View>

      {/* Filter Row (Bersih & Elegan - Hanya Warna Teks yang Berubah per Nama/Status) */}
      <View style={[s.tableHeadRow, { backgroundColor: '#F8FAFC', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={{ width: 22, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="search" size={11} color={colors.sub} strokeWidth={2} />
        </View>
        <FilterInputCell placeholder="Filter Invoice..." widthFlex={1.2} value={filters.invoice || ''} onChange={setF('invoice')} />
        <FilterInputCell placeholder="Filter Customer..." widthFlex={1.2} value={filters.customer || ''} onChange={setF('customer')} />
        <FilterInputCell placeholder="Filter Toko..." widthFlex={1.0} value={filters.toko || ''} onChange={setF('toko')} />
        <FilterInputCell placeholder="Filter Kurir..." widthFlex={1.0} value={filters.courier || ''} onChange={setF('courier')} />
        <FilterInputCell placeholder="Filter Code / Driver..." widthFlex={0.8} value={filters.code || ''} onChange={setF('code')} />

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
              {Object.keys(STATUS_META).map((key) => (
                <option key={key} value={key} style={{ color: statusColor(key) }}>
                  {statusLabel(key)}
                </option>
              ))}
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
          {onToggleSelect ? (
            <TouchableOpacity
              style={[s.selectBox, selectedIds?.has(pkg.id) && s.selectBoxActive]}
              onPress={(e) => { e.stopPropagation?.(); onToggleSelect(pkg.id); }}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              {selectedIds?.has(pkg.id) && <Icon name="check" size={13} color="#fff" strokeWidth={3} />}
            </TouchableOpacity>
          ) : (
            <View style={[s.trIconBox, { backgroundColor: statusTint(pkg.status) }]}>
              <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : 'box'} size={16} color={statusColor(pkg.status)} />
            </View>
          )}
          <Text style={[s.td, { flex: 1.2, fontWeight: '700', fontFamily: font.mono }]} numberOfLines={1}>
            {pkg.awb_no || pkg.invoice_no}
          </Text>
          <Text style={[s.td, { flex: 1.2 }]} numberOfLines={1}>{pkg.customer_name || '(tanpa nama)'}</Text>
          <Text style={[s.td, { flex: 1.0, fontWeight: '600', color: colors.ink }]} numberOfLines={1}>
            {tokoLabel(pkg)}
          </Text>
          <Text style={[s.td, { flex: 1.0, color: colors.sub }]} numberOfLines={1}>
            {pkg.courier || '—'}
          </Text>
          <View style={{ flex: 0.9 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              <Text style={[s.td, { fontFamily: font.mono, fontWeight: '700', color: pkg.pickup_code ? colors.ink : colors.faint }]} numberOfLines={1}>
                {pkg.pickup_code || '—'}
              </Text>
              {pkg.pickup_type === 'anteran' && (
                <View style={{ backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Icon name="box" size={8} color="#92400E" strokeWidth={2.5} />
                  <Text style={{ color: '#92400E', fontSize: 9, fontWeight: '800' }}>ANTERAN</Text>
                </View>
              )}
              {pkg.pickup_type === 'buyback' && (
                <View style={{ backgroundColor: '#EDE9FE', borderWidth: 1, borderColor: '#C4B5FD', borderRadius: radius.pill, paddingHorizontal: 5, paddingVertical: 1, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <Icon name="box" size={8} color="#6D28D9" strokeWidth={2.5} />
                  <Text style={{ color: '#6D28D9', fontSize: 9, fontWeight: '800' }}>BUYBACK</Text>
                </View>
              )}
              {!!pkg.driver_refreshed && (
                <View style={s.refreshBadge}>
                  <Text style={s.refreshBadgeText}>REFRESH</Text>
                </View>
              )}
              {!!pkg.is_hold && (
                <View style={s.holdBadge}>
                  <Text style={s.holdBadgeText}>HOLD</Text>
                </View>
              )}
              {!!pkg.is_cari_driver && (
                <View style={s.cariBadge}>
                  <Text style={s.cariBadgeText}>CARI DRIVER</Text>
                </View>
              )}
              <NameTag pkg={pkg} />
            </View>
            {!!pkg.driver_info && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                <Icon name="scooter" size={10} color={colors.primary} strokeWidth={2} />
                <Text style={[s.td, { color: colors.primary, fontSize: 10.5, fontWeight: '700' }]} numberOfLines={1}>
                  {pkg.driver_info}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flex: 1.0 }}><StatusPill status={pkg.status} /></View>
          <Text style={[s.td, { flex: 0.9, color: colors.faint, fontSize: 10.5 }]} numberOfLines={1}>
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

// Chart throughput modern & responsif: area gradien + gridline bernomor +
// tooltip interaktif (hover di web, tap di Android) + axis tanggal yang
// dijarangkan otomatis. Tidak butuh dependency chart tambahan.
export function ThroughputChart({ data, color = colors.primary, height = 200 }) {
  const [hover, setHover] = useState(null);
  const list = Array.isArray(data) ? data : [];
  const n = list.length;
  if (!n) return null;

  const W = 640;
  const padL = 34, padR = 8, padT = 18, padB = 6;
  const innerW = W - padL - padR;
  const innerH = height - padT - padB;
  const vals = list.map((d) => Number(d.value) || 0);
  const max = Math.max(1, ...vals);
  const x = (i) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v) => padT + innerH - (v / max) * innerH;

  const pts = list.map((d, i) => ({ ...d, x: x(i), y: y(Number(d.value) || 0) }));
  const bottomY = padT + innerH;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L ${pts[n - 1].x.toFixed(1)} ${bottomY} L ${pts[0].x.toFixed(1)} ${bottomY} Z`;
  const grid = [
    { g: 0, label: String(max) },
    { g: 0.5, label: String(Math.round(max / 2)) },
    { g: 1, label: '0' },
  ];
  const labelStep = Math.max(1, Math.ceil(n / 8));

  const hoverPct = hover != null ? (pts[hover].x / W) * 100 : 0;
  const tooltipHalf = 6;
  const tooltipLeft = Math.min(100 - tooltipHalf - 1, Math.max(tooltipHalf + 1, hoverPct));
  const h = hover != null ? pts[hover] : null;

  return (
    <View style={{ position: 'relative' }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="thrFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.32" />
            <Stop offset="0.7" stopColor={color} stopOpacity="0.07" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {grid.map(({ g }, i) => (
          <SvgLine key={i} x1={padL} y1={padT + innerH * g} x2={W - padR} y2={padT + innerH * g}
            stroke={colors.border} strokeWidth="1" strokeDasharray={g === 0 ? '' : '4 6'} />
        ))}
        <Path d={area} fill="url(#thrFill)" />
        <Path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4 : 2.6}
            fill={i === n - 1 ? color : colors.surface} stroke={color} strokeWidth="2" />
        ))}
        {h && <Path d={`M ${h.x} ${padT} L ${h.x} ${bottomY}`} stroke={color} strokeWidth="1" strokeDasharray="3 4" opacity="0.7" />}
      </Svg>

      {/* Label angka gridline (kiri) */}
      {grid.map(({ g, label }, i) => (
        <Text key={i} style={{ position: 'absolute', left: 0, top: `${(((padT + innerH * g - 5) / height) * 100)}%`, width: 30, textAlign: 'right', fontSize: 9.5, color: colors.faint }}>
          {label}
        </Text>
      ))}

      {/* Kolom interaktif untuk hover/tap */}
      <View style={{ position: 'absolute', top: padT, left: padL, right: padR, bottom: padB, flexDirection: 'row' }}>
        {pts.map((p, i) => {
          const handlers = Platform.OS === 'web'
            ? { onMouseEnter: () => setHover(i), onMouseLeave: () => setHover(null) }
            : {};
          void p;
          return (
            <TouchableOpacity key={i} style={{ flex: 1 }} onPressIn={() => setHover(i)} {...handlers} />
          );
        })}
      </View>

      {/* Tooltip titik aktif */}
      {h && (
        <View pointerEvents="none" style={{ position: 'absolute', top: 2, left: `${tooltipLeft}%`, transform: [{ translateX: -44 }], alignItems: 'center', zIndex: 10 }}>
          <View style={{ backgroundColor: colors.ink, paddingVertical: 3, paddingHorizontal: 9, borderRadius: 8 }}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>{h.value}</Text>
            <Text style={{ color: '#D1D5DB', fontSize: 9, textAlign: 'center' }}>{h.label}</Text>
          </View>
          <View style={{ width: 8, height: 8, backgroundColor: colors.ink, transform: [{ rotate: '45deg' }], marginTop: -4 }} />
        </View>
      )}

      {/* Axis tanggal: setiap flex=1, yang tidak terbaca di-skip otomatis */}
      <View style={{ flexDirection: 'row', marginTop: 2 }}>
        {pts.map((p, i) => (
          <Text key={i} style={[
            axisLabelStyle,
            {
              flex: 1,
              textAlign: i === 0 ? 'left' : i === n - 1 ? 'right' : 'center',
              opacity: i % labelStep === 0 || i === n - 1 ? 1 : 0,
              color: i === hover ? color : colors.faint,
              fontWeight: i === hover ? '700' : '400',
            },
          ]}>
            {p.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const axisLabelStyle = { fontSize: 9.5 };

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

// Tampilkan pickup code sebagai QR + tombol copy gambar & kirim WhatsApp ke customer.
export function CodeModal({ pkg, onClose }) {
  const qrRef = useRef(null);
  const [copying, setCopying] = useState(false);

  if (!pkg) return null;

  const waText = encodeURIComponent(
    `Halo ${pkg.customer_name || ''}, paket ${pkg.invoice_no} sudah siap diambil di kios. ` +
    `Tunjukkan kode pickup ini ke admin: ${pkg.pickup_code}`
  );
  // Nomor dari marketplace sering disensor ("(+62)896******56") — jangan tampilkan
  // tombol WA untuk nomor sensor, hasil bersihannya akan jadi nomor orang lain.
  const masked = (pkg.customer_phone || '').includes('*');
  const phone = masked ? '' : (pkg.customer_phone || '').replace(/[^0-9]/g, '').replace(/^0/, '62');

  const copyCardImage = async () => {
    if (copying) return;
    if (!qrRef.current) return notice('QR Code belum siap');
    setCopying(true);

    qrRef.current.toDataURL(async (dataUrl) => {
      try {
        if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
          const qrImg = new window.Image();
          qrImg.crossOrigin = 'anonymous';
          qrImg.onload = async () => {
            const canvas = document.createElement('canvas');
            const W = 420;
            const H = 500;
            canvas.width = W;
            canvas.height = H;
            const ctx = canvas.getContext('2d');

            // Background Card dengan rounded border & Shadow aesthetic
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, W, H);

            // Border luar card
            ctx.strokeStyle = '#E2E8F0';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, W - 4, H - 4);

            // Header Banner
            ctx.fillStyle = '#2E5AAC';
            ctx.fillRect(0, 0, W, 52);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('PickHub · KIOS PICKUP', W / 2, 33);

            // Invoice & Customer Info
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText(`Invoice: ${pkg.invoice_no}`, W / 2, 82);

            ctx.fillStyle = '#0F172A';
            ctx.font = '14px sans-serif';
            const cust = pkg.customer_name ? `Customer: ${pkg.customer_name}` : '';
            if (cust) ctx.fillText(cust, W / 2, 104);

            // QR Code Image (ukuran 200x200 di tengah)
            const qrSize = 200;
            const qrX = (W - qrSize) / 2;
            const qrY = 125;

            // Background petak QR Code
            ctx.fillStyle = '#F8FAFC';
            ctx.fillRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
            ctx.strokeStyle = '#CBD5E1';
            ctx.lineWidth = 1;
            ctx.strokeRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);

            ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

            // Label Pickup Code
            ctx.fillStyle = '#64748B';
            ctx.font = 'bold 11px sans-serif';
            ctx.fillText('KODE PICKUP / PASSCODE', W / 2, 375);

            // Kode Pickup Besar
            ctx.fillStyle = '#1E3F80';
            ctx.font = 'bold 36px monospace, sans-serif';
            ctx.fillText(String(pkg.pickup_code || '—'), W / 2, 420);

            // Footer Subtitle
            ctx.fillStyle = '#94A3B8';
            ctx.font = '11px sans-serif';
            ctx.fillText('Tunjukkan kode ini ke admin kios saat pengambilan paket', W / 2, 465);

            canvas.toBlob(async (blob) => {
              try {
                if (navigator.clipboard && window.ClipboardItem) {
                  await navigator.clipboard.write([
                    new window.ClipboardItem({ 'image/png': blob }),
                  ]);
                  notice('Gambar kartu pickup (QR + Kode) berhasil disalin ke clipboard!');
                } else {
                  notice('Browser Anda tidak mendukung salin gambar langsung.');
                }
              } catch (err) {
                notice('Gagal menyalin gambar: ' + err.message);
              } finally {
                setCopying(false);
              }
            }, 'image/png');
          };
          qrImg.src = `data:image/png;base64,${dataUrl}`;
        } else {
          notice('Fitur salin gambar ke clipboard didukung di browser web.');
          setCopying(false);
        }
      } catch (err) {
        notice('Gagal memproses gambar: ' + err.message);
        setCopying(false);
      }
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e?.stopPropagation?.()}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>Pickup Code</Text>
          <Text style={s.sheetSub}>{pkg.invoice_no} · {pkg.customer_name}</Text>
          <View style={s.qrWrap}>
            <QRCode getRef={(c) => (qrRef.current = c)} value={String(pkg.pickup_code)} size={170} />
          </View>
          <Text style={s.codeText}>{pkg.pickup_code}</Text>

          <TouchableOpacity
            style={[s.btn, { backgroundColor: colors.primary, marginBottom: 8 }]}
            onPress={copyCardImage}
            disabled={copying}
          >
            {copying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.btnText}>Copy Gambar Card (QR + Kode)</Text>
            )}
          </TouchableOpacity>

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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Setelah admin scan kode customer: isi nama pengambil lalu konfirmasi.
export function PickerNameModal({ visible, onSubmit, onClose }) {
  const [name, setName] = useState('');
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e?.stopPropagation?.()}>
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Dropdown nama staf kios: menandai siapa yang memproses done pickup.
// Pengelolaan daftar (tambah/edit/hapus) hanya utk Super Admin & Admin.
export function NamePickerModal({ visible, pkg, userRole, onClose, onChanged, onPicked }) {
  const canManage = userRole === 'superadmin' || userRole === 'admin';
  const [names, setNames] = useState([]);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');

  const loadNames = useCallback(async () => {
    try {
      setNames(await api.staffNames());
    } catch (e) {
      notice(e.message);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    loadNames();
  }, [visible, loadNames]);

  if (!visible || !pkg) return null;

  const current = pkg.done_by || '';

  const pick = async (name) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { done_by: name, baseUpdatedAt: pkg.updated_at });
      notice(name ? `Diproses oleh: ${name}` : 'Tanda nama dihapus');
      onPicked?.(name);
      onChanged?.();
      onClose();
    } catch (e) {
      if (e && e.status === 409) { notice("Data diubah pengguna lain — memuat ulang..."); onChanged?.(); }
      else notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitAdd = async () => {
    const nm = newName.trim();
    if (!nm || busy) return;
    setBusy(true);
    try {
      await api.createStaffName(nm);
      setNewName('');
      setAdding(false);
      await loadNames();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    const nm = editName.trim();
    if (!nm || busy) return;
    setBusy(true);
    try {
      await api.updateStaffName(editId, nm);
      setEditId(null);
      setEditName('');
      await loadNames();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it) => {
    if (!(await confirmAsync(`Hapus "${it.name}"?`, 'Paket yang sudah memakai nama ini tidak berubah (tetap tersimpan sebagai teks).'))) return;
    setBusy(true);
    try {
      await api.deleteStaffName(it.id);
      await loadNames();
    } catch (e) {
      notice(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={(e) => e?.stopPropagation?.()}>
          <View style={s.grabber} />
          <Text style={s.sheetTitle}>Nama Pemroses Done Pickup</Text>
          <Text style={s.sheetSub}>{pkg.invoice_no} · {pkg.customer_name}</Text>

          <ScrollView style={{ maxHeight: 280, marginTop: 8 }}>
            {names.length === 0 && (
              <Text style={s.nameEmpty}>
                Belum ada nama.{canManage ? ' Tambahkan lewat tombol di bawah.' : ' Hubungi admin untuk menambah daftar.'}
              </Text>
            )}
            {names.map((it) => (
              <View key={it.id} style={s.nameRow}>
                {editId === it.id ? (
                  <>
                    <TextInput
                      style={[s.input, { flex: 1, height: 36, paddingVertical: 4, marginVertical: 0 }]}
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      onSubmitEditing={submitEdit}
                      placeholder="Nama baru..."
                      placeholderTextColor={colors.faint}
                    />
                    <TouchableOpacity style={s.nameMiniBtn} onPress={submitEdit} disabled={busy}>
                      <Icon name="save" size={14} color={colors.primary} strokeWidth={2.2} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.nameMiniBtn} onPress={() => setEditId(null)} disabled={busy}>
                      <Icon name="x" size={14} color={colors.sub} strokeWidth={2.2} />
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[s.nameItem, current === it.name && s.nameItemActive]}
                      onPress={() => pick(it.name)}
                      disabled={busy}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.nameItemText, current === it.name && s.nameItemTextActive]} numberOfLines={1}>
                        {it.name}
                      </Text>
                      {current === it.name && <Icon name="check" size={14} color={colors.primary} strokeWidth={3} />}
                    </TouchableOpacity>
                    {canManage && (
                      <>
                        <TouchableOpacity style={s.nameMiniBtn} onPress={() => { setEditId(it.id); setEditName(it.name); }} disabled={busy}>
                          <Icon name="edit" size={13} color={colors.sub} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.nameMiniBtn} onPress={() => remove(it)} disabled={busy}>
                          <Icon name="trash" size={13} color={colors.danger} strokeWidth={2} />
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>
            ))}
          </ScrollView>

          {canManage &&
            (adding ? (
              <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={s.nameFormLabel}>Nama staf baru</Text>
                <TextInput
                  style={[s.input, { marginVertical: 8 }]}
                  placeholder="Tulis nama staf di sini..."
                  placeholderTextColor={colors.faint}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  onSubmitEditing={submitAdd}
                />
                <TouchableOpacity style={[s.btn, { backgroundColor: colors.ok }]} onPress={submitAdd} disabled={busy}>
                  <Text style={s.btnText}>Simpan Nama</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.btn, s.btnGhost, { marginTop: 8 }]}
                  onPress={() => { setAdding(false); setNewName(''); }}
                  disabled={busy}
                >
                  <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[s.btn, { backgroundColor: colors.primary, marginTop: 10 }]}
                onPress={() => setAdding(true)}
                disabled={busy}
              >
                <Text style={s.btnText}>+ Tambah Nama</Text>
              </TouchableOpacity>
            ))}

          {!!current && (
            <TouchableOpacity style={[s.btn, s.btnGhost, { marginTop: 8 }]} onPress={() => pick('')} disabled={busy}>
              <Text style={[s.btnText, { color: colors.danger }]}>Hapus Tanda Nama Ini</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[s.btn, s.btnGhost, { marginTop: 8 }]} onPress={onClose} disabled={busy}>
            <Text style={[s.btnText, { color: colors.ink }]}>Tutup</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
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
  selectBox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface, flexShrink: 0,
  },
  selectBoxActive: {
    backgroundColor: colors.primary, borderColor: colors.primary,
  },
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
  cardRowMeta: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8,
  },
  time: { color: colors.faint, fontSize: 10.5, fontWeight: '600' },
  codeChip: { color: colors.sub, fontSize: 11.5, fontWeight: '700', fontFamily: font.mono },
  refreshBadge: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  refreshBadgeText: { color: colors.danger, fontSize: 9, fontWeight: '800' },
  holdBadge: { backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  holdBadgeText: { color: '#B45309', fontSize: 9, fontWeight: '800' },
  cariBadge: { backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1 },
  cariBadgeText: { color: '#1D4ED8', fontSize: 9, fontWeight: '800' },
  nameTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#93C5FD',
    borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 1,
    maxWidth: 130,
  },
  nameTagText: { color: colors.sub, fontSize: 9, fontWeight: '800', maxWidth: 108 },
  driverChip: { color: colors.primary, fontSize: 11.5, fontWeight: '700' },
  nameEmpty: { color: colors.faint, fontSize: 12.5, textAlign: 'center', paddingVertical: 18 },
  nameFormLabel: { fontSize: 12.5, fontWeight: '800', color: colors.sub, marginBottom: -4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  nameItem: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.bg,
  },
  nameItemActive: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  nameItemText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '600' },
  nameItemTextActive: { color: colors.primary, fontWeight: '800' },
  nameMiniBtn: {
    width: 32, height: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
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
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt,
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
