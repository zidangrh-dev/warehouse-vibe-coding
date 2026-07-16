import { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, Linking, Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, statusLabel, statusColor } from './theme';

export function PackageRow({ pkg, onPress, action }) {
  return (
    <TouchableOpacity style={s.row} onPress={() => onPress(pkg)}>
      <View style={[s.stripe, { backgroundColor: statusColor(pkg.status) }]} />
      <View style={{ flex: 1 }}>
        <View style={s.rowTop}>
          <Text style={s.invoice}>
            {pkg.awb_no || pkg.invoice_no} {pkg.pickup_code ? '▮▯' : ''}
          </Text>
          <Text style={[s.status, { color: statusColor(pkg.status) }]}>
            {statusLabel(pkg.status)}
          </Text>
        </View>
        <Text style={s.detail} numberOfLines={1}>
          {pkg.customer_name || '(tanpa nama)'}
          {pkg.platform ? ` · ${pkg.platform}` : ''}
          {pkg.courier ? ` · ${pkg.courier}` : ''}
          {pkg.pickup_type === 'gojek' ? ' · 🛵' : ''}
        </Text>
      </View>
      {action}
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
        <View style={s.codeBox}>
          <Text style={s.codeTitle}>Pickup Code</Text>
          <Text style={s.codeInvoice}>{pkg.invoice_no} · {pkg.customer_name}</Text>
          <View style={s.qrWrap}>
            <QRCode value={String(pkg.pickup_code)} size={180} />
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
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.subtle }]} onPress={onClose}>
            <Text style={s.btnText}>Tutup</Text>
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
        <View style={s.codeBox}>
          <Text style={s.codeTitle}>Nama Pengambil</Text>
          <TextInput
            style={s.input}
            placeholder="Nama orang yang mengambil paket"
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
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.subtle }]} onPress={onClose}>
            <Text style={s.btnText}>Batal</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 10, marginBottom: 8, padding: 10, gap: 10,
    borderWidth: 1, borderColor: colors.border,
  },
  stripe: { width: 5, alignSelf: 'stretch', borderRadius: 3 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  invoice: { fontWeight: '800', color: colors.text },
  status: { fontWeight: '700', fontSize: 12 },
  detail: { color: colors.subtle, fontSize: 13, marginTop: 2 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  codeBox: {
    backgroundColor: '#fff', borderRadius: 14, padding: 20,
    width: '100%', maxWidth: 360, alignItems: 'stretch',
  },
  codeTitle: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center' },
  codeInvoice: { color: colors.subtle, textAlign: 'center', marginBottom: 12 },
  qrWrap: { alignItems: 'center', marginVertical: 8 },
  codeText: {
    fontSize: 26, fontWeight: '800', letterSpacing: 4,
    textAlign: 'center', color: colors.text, marginVertical: 10,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 12, fontSize: 16, marginVertical: 12, color: colors.text,
  },
  btn: { borderRadius: 8, padding: 13, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700' },
});
