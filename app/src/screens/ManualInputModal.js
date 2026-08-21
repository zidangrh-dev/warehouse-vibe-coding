// Modal untuk input paket manual ketika scan barcode tidak ditemukan di database
import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable } from 'react-native';
import { api } from '../api';
import { notice, colors } from '../theme';
import { s } from './styles';

export default function ManualInputModal({ visible, initialInvoice, onClose, onSaved }) {
  const emptyForm = {
    invoice_no: '',
    customer_name: '',
    customer_phone: '',
    item_desc: '',
    pickup_type: 'customer',
    pickup_code: '',
  };

  const [f, setF] = useState(emptyForm);

  useEffect(() => {
    if (visible) setF((old) => ({ ...old, invoice_no: initialInvoice || '' }));
  }, [visible, initialInvoice]);

  if (!visible) return null;

  const set = (k) => (v) => setF((old) => ({ ...old, [k]: v }));

  const save = async () => {
    try {
      await api.createPackage(f);
      onSaved();
      onClose();
      setF(emptyForm);
    } catch (e) {
      notice(e.message);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.box} onPress={(e) => e?.stopPropagation?.()}>
          <Text style={s.boxTitle}>Input Paket Manual</Text>
          <TextInput
            style={s.input}
            placeholder="No Invoice *"
            placeholderTextColor={colors.faint}
            value={f.invoice_no}
            onChangeText={set('invoice_no')}
            autoCapitalize="characters"
          />
          <TextInput
            style={s.input}
            placeholder="Nama customer"
            placeholderTextColor={colors.faint}
            value={f.customer_name}
            onChangeText={set('customer_name')}
          />
          <TextInput
            style={s.input}
            placeholder="No HP"
            placeholderTextColor={colors.faint}
            value={f.customer_phone}
            onChangeText={set('customer_phone')}
            keyboardType="phone-pad"
          />
          <TextInput
            style={s.input}
            placeholder="Barang / Deskripsi"
            placeholderTextColor={colors.faint}
            value={f.item_desc}
            onChangeText={set('item_desc')}
          />
          <TextInput
            style={s.input}
            placeholder="Kode Pickup / PIN (opsional)"
            placeholderTextColor={colors.faint}
            value={f.pickup_code}
            onChangeText={set('pickup_code')}
            autoCapitalize="characters"
          />
          <View style={s.typeRow}>
            {[['customer', 'Ambil Customer'], ['gojek', 'Absen Gojek']].map(([val, label]) => (
              <TouchableOpacity
                key={val}
                style={[s.typeChip, f.pickup_type === val && s.typeChipActive]}
                onPress={() => set('pickup_type')(val)}
              >
                <Text style={f.pickup_type === val ? s.typeTextActive : s.typeText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity style={[s.bigBtn, { flex: 1, backgroundColor: colors.ok }]} onPress={save}>
              <Text style={s.btnText}>Simpan</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.bigBtn, { flex: 1, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }]}
              onPress={onClose}
            >
              <Text style={[s.btnText, { color: colors.ink }]}>Batal</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
