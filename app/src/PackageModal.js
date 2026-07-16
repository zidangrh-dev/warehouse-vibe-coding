import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
} from 'react-native';
import { api } from './api';
import { colors, statusLabel, statusColor, NEXT_ACTIONS, notice } from './theme';

const Field = ({ label, children }) => (
  <View style={{ marginTop: 10 }}>
    <Text style={s.label}>{label}</Text>
    {children}
  </View>
);

export default function PackageModal({ pkgId, user, onClose, onChanged }) {
  const [pkg, setPkg] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!pkgId) return;
    const p = await api.getPackage(pkgId);
    setPkg(p);
    setNote(p.admin_note || '');
  };
  useEffect(() => { load(); }, [pkgId]);

  if (!pkgId || !pkg) return null;

  const canAct = user.role === 'admin';
  const actions = NEXT_ACTIONS[pkg.status] || [];

  const setStatus = async (to) => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { status: to });
      onChanged();
      await load();
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  };

  const saveNote = async () => {
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, { admin_note: note });
      onChanged();
      notice('Catatan tersimpan');
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  };

  const togglePickupType = async () => {
    const to = pkg.pickup_type === 'gojek' ? 'customer' : 'gojek';
    // Jenis ambilan menentukan jalur status setelah paket sampai kios.
    const patch = { pickup_type: to };
    if (pkg.status === 'absen_ambil_customer' && to === 'gojek') patch.status = 'absen_gojek';
    if (pkg.status === 'absen_gojek' && to === 'customer') patch.status = 'absen_ambil_customer';
    setBusy(true);
    try {
      await api.updatePackage(pkg.id, patch);
      onChanged();
      await load();
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.sheet}>
          <ScrollView>
            <Text style={s.invoice}>{pkg.invoice_no}</Text>
            <Text style={[s.status, { color: statusColor(pkg.status) }]}>
              ● {statusLabel(pkg.status)}
            </Text>

            <Field label="Customer">
              <Text style={s.value}>
                {pkg.customer_name || '-'} {pkg.customer_phone ? `· ${pkg.customer_phone}` : ''}
              </Text>
            </Field>
            <Field label="Barang">
              <Text style={s.value}>{pkg.item_desc || '-'}</Text>
            </Field>
            <Field label="Jenis ambilan">
              <View style={s.rowWrap}>
                <Text style={s.value}>
                  {pkg.pickup_type === 'gojek' ? '🛵 Gojek' : '🧍 Customer datang'}
                </Text>
                {canAct && (
                  <TouchableOpacity onPress={togglePickupType} disabled={busy}>
                    <Text style={s.link}>ganti</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Field>
            {!!pkg.pickup_code && (
              <Field label="Pickup code">
                <Text style={[s.value, { fontWeight: '800', letterSpacing: 2 }]}>{pkg.pickup_code}</Text>
              </Field>
            )}
            {!!pkg.picker_name && (
              <Field label="Diambil oleh">
                <Text style={s.value}>{pkg.picker_name}</Text>
              </Field>
            )}

            <Field label="Admin note (data driver, dsb.)">
              <TextInput
                style={s.input}
                value={note}
                onChangeText={setNote}
                multiline
                placeholder="Nama driver, plat nomor, catatan..."
                editable={canAct}
              />
              {canAct && (
                <TouchableOpacity style={s.saveNote} onPress={saveNote} disabled={busy}>
                  <Text style={s.btnText}>Simpan Catatan</Text>
                </TouchableOpacity>
              )}
            </Field>

            {canAct && actions.length > 0 && (
              <Field label="Aksi">
                {actions.map((a) => (
                  <TouchableOpacity
                    key={a.to}
                    style={[s.actionBtn, { backgroundColor: statusColor(a.to) }]}
                    onPress={() => setStatus(a.to)}
                    disabled={busy}
                  >
                    <Text style={s.btnText}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </Field>
            )}

            <Field label="Riwayat">
              {(pkg.events || []).map((ev) => (
                <Text key={ev.id} style={s.event}>
                  • {new Date(ev.created_at).toLocaleString('id-ID')} — {ev.user_name}: {ev.action}
                  {ev.detail ? ` (${ev.detail})` : ''}
                </Text>
              ))}
            </Field>

            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.btnText}>Tutup</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  sheet: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18,
    width: '100%', maxWidth: 520, maxHeight: '90%',
  },
  invoice: { fontSize: 20, fontWeight: '800', color: colors.text },
  status: { fontWeight: '700', marginTop: 2 },
  label: { fontWeight: '700', color: colors.subtle, fontSize: 12, textTransform: 'uppercase' },
  value: { color: colors.text, fontSize: 15, marginTop: 2 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { color: colors.accent, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10,
    minHeight: 60, textAlignVertical: 'top', color: colors.text, marginTop: 4,
  },
  saveNote: {
    backgroundColor: colors.accent, borderRadius: 8, padding: 10,
    alignItems: 'center', marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 16,
  },
  actionBtn: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700' },
  event: { color: colors.subtle, fontSize: 12, marginTop: 4 },
  closeBtn: {
    backgroundColor: colors.subtle, borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 16,
  },
});
