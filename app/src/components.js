import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Linking,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius, shadow, statusLabel, statusColor, statusTint } from './theme';

export function StatusPill({ status }) {
  return (
    <View style={[s.pill, { backgroundColor: statusTint(status) }]}>
      <View style={[s.pillDot, { backgroundColor: statusColor(status) }]} />
      <Text style={[s.pillText, { color: statusColor(status) }]}>{statusLabel(status)}</Text>
    </View>
  );
}

export function PackageRow({ pkg, onPress, action }) {
  return (
    <TouchableOpacity style={s.card} onPress={() => onPress(pkg)} activeOpacity={0.7}>
      <View style={s.cardTop}>
        <View style={[s.iconBox, { backgroundColor: statusTint(pkg.status) }]}>
          <Text style={{ fontSize: 18 }}>{pkg.pickup_type === 'gojek' ? '🛵' : '📦'}</Text>
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
              <Text style={s.btnText}>💬 Kirim via WhatsApp</Text>
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
    padding: 14, marginBottom: 10, ...shadow.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  awb: { fontWeight: '800', color: colors.ink, fontSize: 15, letterSpacing: 0.2 },
  detail: { color: colors.sub, fontSize: 13, marginTop: 2 },
  cardBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border,
  },
  time: { color: colors.faint, fontSize: 12, fontWeight: '600' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10,
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontWeight: '700', fontSize: 12 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(16,24,40,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  sheet: {
    backgroundColor: colors.surface, borderRadius: radius.sheet, padding: 22,
    width: '100%', maxWidth: 380, ...shadow.float,
  },
  grabber: {
    alignSelf: 'center', width: 40, height: 4, borderRadius: 2,
    backgroundColor: colors.border, marginBottom: 14,
  },
  sheetTitle: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  sheetSub: { color: colors.sub, textAlign: 'center', marginTop: 2, marginBottom: 8 },
  qrWrap: {
    alignSelf: 'center', padding: 14, borderRadius: 20, marginVertical: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
  },
  codeText: {
    fontSize: 28, fontWeight: '800', letterSpacing: 6,
    textAlign: 'center', color: colors.ink, marginBottom: 12,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.input,
    padding: 13, fontSize: 16, marginVertical: 12, color: colors.ink,
    backgroundColor: colors.bg,
  },
  btn: {
    borderRadius: 999, padding: 14, alignItems: 'center', marginTop: 8,
    backgroundColor: colors.primary,
  },
  btnGhost: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  btnText: { color: '#fff', fontWeight: '700' },
});
