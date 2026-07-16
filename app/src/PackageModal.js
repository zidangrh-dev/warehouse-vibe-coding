import { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Image, Platform, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api, uploadPhoto, photoUrl } from './api';
import { colors, statusLabel, statusColor, NEXT_ACTIONS, notice, confirmAsync } from './theme';

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

  const photos = pkg.photos || [];
  const driverPhotos = photos.filter((p) => p.kind === 'driver');
  const barangPhotos = photos.filter((p) => p.kind === 'barang');
  // Aturan kios: Done Pickup gojek butuh 1 foto driver + 2 foto barang.
  const needsPhotos = pkg.pickup_type === 'gojek' && pkg.status === 'driver_sampai_kios';
  const photosOk = driverPhotos.length >= 1 && barangPhotos.length >= 2;

  const addPhoto = async (kind, fromCamera) => {
    const opts = { quality: 0.6 };
    const result = fromCamera
      ? await (async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) return { canceled: true };
          return ImagePicker.launchCameraAsync(opts);
        })()
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled || !result.assets?.length) return;
    setBusy(true);
    try {
      await uploadPhoto(pkg.id, kind, result.assets[0]);
      onChanged();
      await load();
    } catch (e) { notice(e.message); }
    finally { setBusy(false); }
  };

  const removePhoto = async (photo) => {
    if (!(await confirmAsync('Hapus foto?'))) return;
    await api.deletePhoto(photo.id);
    onChanged();
    await load();
  };

  const PhotoStrip = ({ title, kind, list, need }) => (
    <View style={{ marginTop: 8 }}>
      <Text style={s.photoTitle}>
        {title}{' '}
        <Text style={{ color: list.length >= need ? colors.ok : colors.danger }}>
          ({list.length}/{need})
        </Text>
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {list.map((p) => (
          <TouchableOpacity key={p.id} onLongPress={() => canAct && removePhoto(p)}>
            <Image source={{ uri: photoUrl(p) }} style={s.photo} />
          </TouchableOpacity>
        ))}
        {canAct && (
          <>
            {Platform.OS !== 'web' && (
              <TouchableOpacity style={s.photoAdd} onPress={() => addPhoto(kind, true)} disabled={busy}>
                <Text style={s.photoAddText}>📸{'\n'}Kamera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.photoAdd} onPress={() => addPhoto(kind, false)} disabled={busy}>
              <Text style={s.photoAddText}>🖼{'\n'}Galeri</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );

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
            {!!pkg.awb_no && (
              <Field label="AWB / Resi">
                <Text style={[s.value, { fontWeight: '700' }]}>{pkg.awb_no}</Text>
              </Field>
            )}
            <Field label="Barang / Toko">
              <Text style={s.value}>
                {pkg.item_desc || '-'}
                {pkg.platform ? ` · ${pkg.platform}` : ''}
                {pkg.courier ? ` · ${pkg.courier}` : ''}
              </Text>
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

            {(needsPhotos || photos.length > 0) && (
              <Field label="Bukti foto pengambilan">
                <PhotoStrip title="Wajah driver" kind="driver" list={driverPhotos} need={1} />
                <PhotoStrip title="Foto barang" kind="barang" list={barangPhotos} need={2} />
                {canAct && <Text style={s.hint}>Tekan lama foto untuk menghapus.</Text>}
              </Field>
            )}

            {busy && <ActivityIndicator style={{ marginTop: 8 }} />}

            {canAct && actions.length > 0 && (
              <Field label="Aksi">
                {actions.map((a) => {
                  const locked = a.to === 'done_pickup' && needsPhotos && !photosOk;
                  return (
                    <TouchableOpacity
                      key={a.to}
                      style={[
                        s.actionBtn,
                        { backgroundColor: locked ? colors.border : statusColor(a.to) },
                      ]}
                      onPress={() =>
                        locked
                          ? notice('Lengkapi dulu: 1 foto wajah driver + 2 foto barang.')
                          : setStatus(a.to)
                      }
                      disabled={busy}
                    >
                      <Text style={[s.btnText, locked && { color: colors.sub }]}>
                        {locked ? '🔒 ' : ''}{a.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
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
  invoice: { fontSize: 20, fontWeight: '800', color: colors.ink },
  status: { fontWeight: '700', marginTop: 2 },
  label: { fontWeight: '700', color: colors.sub, fontSize: 12, textTransform: 'uppercase' },
  value: { color: colors.ink, fontSize: 15, marginTop: 2 },
  rowWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  link: { color: colors.primary, fontWeight: '700' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10,
    minHeight: 60, textAlignVertical: 'top', color: colors.ink, marginTop: 4,
  },
  saveNote: {
    backgroundColor: colors.primary, borderRadius: 8, padding: 10,
    alignItems: 'center', marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 16,
  },
  actionBtn: { borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 6 },
  btnText: { color: '#fff', fontWeight: '700' },
  event: { color: colors.sub, fontSize: 12, marginTop: 4 },
  photoTitle: { fontWeight: '700', color: colors.ink, fontSize: 13, marginBottom: 6 },
  photo: {
    width: 84, height: 84, borderRadius: 12, marginRight: 8,
    backgroundColor: colors.border,
  },
  photoAdd: {
    width: 84, height: 84, borderRadius: 12, marginRight: 8,
    borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary,
    backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  photoAddText: { color: colors.primary, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  hint: { color: colors.faint, fontSize: 11, marginTop: 6 },
  closeBtn: {
    backgroundColor: colors.sub, borderRadius: 8, padding: 12,
    alignItems: 'center', marginTop: 16,
  },
});
