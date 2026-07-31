import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Linking,
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
            {pkg.pickup_code ? '  ▮▯' : ''}
          </Text>
          <Text style={s.detail} numberOfLines={1}>
            {pkg.customer_name || '(tanpa nama)'}
            {pkg.platform ? `  ·  ${pkg.platform}` : ''}
            {pkg.courier ? `  ·  ${pkg.courier}` : ''}
          </Text>
        </View>
        {action}
      </View>
      <View style={s.cardBottom}>
        <StatusPill status={pkg.status} />
        <Text style={s.time}>
          {new Date(pkg.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          {' · '}
          {new Date(pkg.updated_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Tabel padat untuk layar lebar (desktop web) — kontrak props sama dengan
// PackageRow supaya screens.js tinggal switch render mode.
export function PackageTable({ items, onPress, renderAction }) {
  return (
    <View style={s.table}>
      <View style={s.tableHeadRow}>
        <Text style={[s.th, { width: 36 }]} />
        <Text style={[s.th, { flex: 1.3 }]}>AWB / Invoice</Text>
        <Text style={[s.th, { flex: 1.4 }]}>Customer</Text>
        <Text style={[s.th, { flex: 1.1 }]}>Platform / Kurir</Text>
        <Text style={[s.th, { flex: 1 }]}>Status</Text>
        <Text style={[s.th, { flex: 0.9 }]}>Update</Text>
        <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Aksi</Text>
      </View>
      {items.map((pkg) => (
        <TouchableOpacity key={pkg.id} style={s.tr} onPress={() => onPress(pkg)} activeOpacity={0.6}>
          <View style={[s.trIconBox, { backgroundColor: statusTint(pkg.status) }]}>
            <Icon name={pkg.pickup_type === 'gojek' ? 'scooter' : 'box'} size={16} color={statusColor(pkg.status)} />
          </View>
          <Text style={[s.td, { flex: 1.3, fontWeight: '700', fontFamily: font.mono }]} numberOfLines={1}>
            {pkg.awb_no || pkg.invoice_no}
          </Text>
          <Text style={[s.td, { flex: 1.4 }]} numberOfLines={1}>{pkg.customer_name || '(tanpa nama)'}</Text>
          <Text style={[s.td, { flex: 1.1, color: colors.sub }]} numberOfLines={1}>
            {[pkg.platform, pkg.courier].filter(Boolean).join(' · ') || '—'}
          </Text>
          <View style={{ flex: 1 }}><StatusPill status={pkg.status} /></View>
          <Text style={[s.td, { flex: 0.9, color: colors.faint, fontSize: 12 }]}>
            {new Date(pkg.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
          </Text>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {renderAction ? renderAction(pkg) : null}
          </View>
        </TouchableOpacity>
      ))}
      {items.length === 0 && <Text style={s.tableEmpty}>Tidak ada data.</Text>}
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
});
